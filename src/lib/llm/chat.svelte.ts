/**
 * チャット状態ストア（Svelte 5 runes）
 *
 * フローティングパネル（ChatPanel）と専用ルート（/chat）の両方が
 * このストアを購読する。どちらで開いても会話が継続する。
 * 会話履歴は IndexedDB（chatSessions テーブル）に永続化する。
 */

import { db } from '$lib/db/database';
import { getSelectedYear } from '$lib/stores/fiscalYear.svelte';
import { MediaQuery } from 'svelte/reactivity';
import { runAgentLoop } from './agent-loop';
import { getActiveProvider } from './config-store';
import { buildSystemPrompt } from './system-prompt';
import type { ChatMessage, ChatSession, LLMProviderConfig } from './types';

/** 永続化するセッション ID（現状は単一セッション） */
const SESSION_ID = 'default';

/**
 * デスクトップ判定（lg 以上）
 * デスクトップ: ドッキング型サイドパネル / モバイル: オーバーレイ Sheet
 */
export const isDesktop = new MediaQuery('(min-width: 1024px)');

export type ChatStatus = 'idle' | 'running' | 'error';

/** 承認待ちの破壊的操作 */
export interface PendingApproval {
	toolName: string;
	args: Record<string, unknown>;
	resolve: (approved: boolean) => void;
}

// =============================================================================
// 状態
// =============================================================================

let messages = $state<ChatMessage[]>([]);
let status = $state<ChatStatus>('idle');
let draft = $state('');
let errorMessage = $state<string | null>(null);
let pendingApproval = $state<PendingApproval | null>(null);
let activeProvider = $state<LLMProviderConfig | null>(null);
let isPanelOpen = $state(false);
/** /chat を全画面で開く直前にいたページのパス（サイドパネルに戻すときの遷移先） */
let fullPageReturnPath = $state<string | null>(null);
let initialized = false;
let abortController: AbortController | null = null;

// =============================================================================
// 内部処理
// =============================================================================

/** Svelte $state プロキシを除去してプレーン化（IndexedDB 保存用） */
function toPlainMessages(msgs: ChatMessage[]): ChatMessage[] {
	return JSON.parse(JSON.stringify(msgs)) as ChatMessage[];
}

/** 会話履歴を IndexedDB に保存 */
async function persistSession(): Promise<void> {
	const now = new Date().toISOString();
	const session: ChatSession = {
		id: SESSION_ID,
		messages: toPlainMessages(messages),
		providerId: activeProvider?.id,
		createdAt: now,
		updatedAt: now
	};
	const existing = await db.chatSessions.get(SESSION_ID);
	if (existing) session.createdAt = existing.createdAt;
	await db.chatSessions.put(session);
}

/** 表示対象メッセージ（system を除く） */
function visibleMessages(): ChatMessage[] {
	return messages.filter((m) => m.role !== 'system');
}

// =============================================================================
// 公開 API
// =============================================================================

/** ストア初期化（会話履歴・アクティブプロバイダのロード） */
export async function initChat(): Promise<void> {
	if (initialized) return;
	initialized = true;
	const [session, provider] = await Promise.all([
		db.chatSessions.get(SESSION_ID),
		getActiveProvider()
	]);
	if (session?.messages?.length) {
		messages = session.messages;
	}
	activeProvider = provider;
}

/** アクティブプロバイダを再読込（設定変更後に呼ぶ） */
export async function reloadActiveProvider(): Promise<void> {
	activeProvider = await getActiveProvider();
}

/** メッセージを送信してエージェントループを実行 */
export async function sendMessage(text: string): Promise<void> {
	const trimmed = text.trim();
	if (!trimmed || status === 'running') return;

	if (!activeProvider) {
		activeProvider = await getActiveProvider();
	}
	if (!activeProvider) {
		errorMessage = 'LLM プロバイダが未設定です。設定ページで接続先を追加してください。';
		status = 'error';
		return;
	}

	errorMessage = null;
	status = 'running';
	abortController = new AbortController();

	// system プロンプトを最新の状態で先頭に維持
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- 一時的な日付取得のみでリアクティブ性は不要
	const today = new Date().toISOString().slice(0, 10);
	const systemPrompt = buildSystemPrompt({
		today,
		selectedYear: getSelectedYear()
	});
	if (messages[0]?.role === 'system') {
		messages[0] = { role: 'system', content: systemPrompt };
	} else {
		messages.unshift({ role: 'system', content: systemPrompt });
	}

	messages.push({ role: 'user', content: trimmed });
	await persistSession();

	try {
		await runAgentLoop(
			activeProvider,
			messages,
			{
				onUpdate: () => {
					// $state 配列の push は自動反映される。永続化のみ行う
					void persistSession();
				},
				requestApproval: (toolName, args) =>
					new Promise<boolean>((resolve) => {
						pendingApproval = {
							toolName,
							args,
							resolve: (approved) => {
								pendingApproval = null;
								resolve(approved);
							}
						};
					})
			},
			abortController.signal
		);
		status = 'idle';
	} catch (e) {
		if (e instanceof DOMException && e.name === 'AbortError') {
			messages.push({ role: 'assistant', content: '（中断しました）' });
			status = 'idle';
		} else {
			errorMessage = e instanceof Error ? e.message : String(e);
			status = 'error';
		}
	} finally {
		abortController = null;
		await persistSession();
	}
}

/** 実行中のループを中断 */
export function abortChat(): void {
	abortController?.abort();
	// 承認待ちで停止している場合は却下として解決
	pendingApproval?.resolve(false);
}

/** 会話をクリア */
export async function clearChat(): Promise<void> {
	abortChat();
	messages = [];
	errorMessage = null;
	status = 'idle';
	await db.chatSessions.delete(SESSION_ID);
}

/** フローティングパネルの開閉 */
export function toggleChatPanel(open?: boolean): void {
	isPanelOpen = open ?? !isPanelOpen;
}

/**
 * /chat を全画面で開く直前のパスを記録する
 *
 * 全画面からサイドパネル表示に戻すとき、この位置に遷移して復帰する。
 * サイドバーから直接 /chat を開いた場合は未設定のままで、戻り先はホームになる。
 */
export function setChatReturnPath(path: string | null): void {
	fullPageReturnPath = path;
}

/**
 * 過去のユーザーメッセージを再実行する
 * （初回のローカルネットワーク許可等で送信が失敗した場合の再送に使う）
 */
export async function resendMessage(text: string): Promise<void> {
	await sendMessage(text);
}

/** 入力欄のドラフトに過去メッセージをセットする（編集して再送信用） */
export function setDraft(text: string): void {
	draft = text;
}

/** リアクティブなゲッター群 */
export function useChat() {
	return {
		get messages() {
			return visibleMessages();
		},
		get status() {
			return status;
		},
		get errorMessage() {
			return errorMessage;
		},
		get pendingApproval() {
			return pendingApproval;
		},
		get activeProvider() {
			return activeProvider;
		},
		get isPanelOpen() {
			return isPanelOpen;
		},
		get returnPath() {
			return fullPageReturnPath;
		},
		get draft() {
			return draft;
		},
		set draft(value: string) {
			draft = value;
		}
	};
}
