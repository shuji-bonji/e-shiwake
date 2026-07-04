/**
 * エージェントループ（ブラウザ内 tool calling ループ）
 *
 * /v1/chat/completions を tool_calls が空になるまで繰り返す素朴な実装。
 * 破壊的ツール（delete_journal）は実行前にユーザー承認を挟む（HITL）。
 */

import { chatCompletion } from './provider';
import { executeTool, getOpenAIToolSchemas, isDestructiveTool } from './tool-bridge';
import type { LLMProviderConfig, ChatMessage, ChatToolCall } from './types';

/** ループの安全上限（無限ループ防止） */
const MAX_ITERATIONS = 10;

export interface AgentLoopCallbacks {
	/** messages が更新されるたびに呼ばれる（UI 反映・永続化用） */
	onUpdate?: () => void;
	/**
	 * 破壊的ツールの実行承認をユーザーに求める。
	 * true で実行、false で却下。
	 */
	requestApproval: (toolName: string, args: Record<string, unknown>) => Promise<boolean>;
}

/**
 * エージェントループを実行する
 *
 * messages 配列を直接変更（push）していく。呼び出し側は
 * $state の配列を渡せばリアクティブに UI へ反映される。
 */
export async function runAgentLoop(
	cfg: LLMProviderConfig,
	messages: ChatMessage[],
	callbacks: AgentLoopCallbacks,
	signal?: AbortSignal
): Promise<void> {
	const tools = getOpenAIToolSchemas();

	for (let i = 0; i < MAX_ITERATIONS; i++) {
		const res = await chatCompletion(cfg, messages, tools, signal);
		const msg = res.choices[0].message;

		// assistant メッセージを正規化して追加
		messages.push({
			role: 'assistant',
			content: msg.content ?? null,
			...(msg.tool_calls?.length ? { tool_calls: msg.tool_calls } : {})
		});
		callbacks.onUpdate?.();

		// tool_calls がなければ通常応答 → 終了
		if (!msg.tool_calls?.length) return;

		for (const call of msg.tool_calls) {
			if (signal?.aborted) throw new DOMException('中断されました', 'AbortError');
			const text = await handleToolCall(call, callbacks);
			messages.push({
				role: 'tool',
				tool_call_id: call.id,
				content: text
			});
			callbacks.onUpdate?.();
		}
	}

	// 上限到達
	messages.push({
		role: 'assistant',
		content: `（ツール実行が ${MAX_ITERATIONS} 回の上限に達したため処理を打ち切りました）`
	});
	callbacks.onUpdate?.();
}

/** 1 件の tool_call を処理する（承認 → 実行） */
async function handleToolCall(call: ChatToolCall, callbacks: AgentLoopCallbacks): Promise<string> {
	let args: Record<string, unknown>;
	try {
		args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
	} catch {
		return `エラー: ツール引数の JSON が不正です: ${call.function.arguments}`;
	}

	if (isDestructiveTool(call.function.name)) {
		const approved = await callbacks.requestApproval(call.function.name, args);
		if (!approved) {
			return 'ユーザーがこの操作を却下しました。実行していません。';
		}
	}

	return executeTool(call.function.name, args);
}
