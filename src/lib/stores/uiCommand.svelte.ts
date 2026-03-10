/**
 * UICommand Store
 *
 * WebMCPツールからUIコンポーネントへのコマンド通信を担う。
 * AIエージェントがUI操作（フォーム入力・ナビゲーション・検索等）を
 * 行う際の中間層として機能する。
 *
 * フロー:
 *   AIエージェント → WebMCPツール → dispatchUICommand() → $state更新
 *   → ページの$effectが検知 → UI操作実行 → clearPendingCommand()
 *
 * @experimental Phase 2: UI操作型WebMCPツール
 */

// =============================================================================
// UICommand 型定義（Discriminated Union）
// =============================================================================

/** 仕訳明細行のプリフィルデータ */
export interface PrefillJournalLine {
	accountCode: string;
	amount: number;
	taxCategory?: string;
	memo?: string;
}

/** 請求書明細行のプリフィルデータ */
export interface PrefillInvoiceItem {
	description: string;
	quantity: number;
	unitPrice: number;
	taxRate: 10 | 8;
}

/** 仕訳入力フォームを開くコマンド */
export interface OpenJournalEditorCommand {
	type: 'open_journal_editor';
	data: {
		date?: string;
		description?: string;
		vendor?: string;
		debitLines?: PrefillJournalLine[];
		creditLines?: PrefillJournalLine[];
	};
}

/** ページ遷移コマンド */
export interface NavigateToCommand {
	type: 'navigate_to';
	data: {
		path: string;
	};
}

/** 検索クエリセットコマンド */
export interface SetSearchQueryCommand {
	type: 'set_search_query';
	data: {
		query: string;
	};
}

/** 仕訳削除確認コマンド */
export interface ConfirmDeleteJournalCommand {
	type: 'confirm_delete_journal';
	data: {
		id: string;
	};
}

/** 請求書エディタを開くコマンド */
export interface OpenInvoiceEditorCommand {
	type: 'open_invoice_editor';
	data: {
		vendorId?: string;
		items?: PrefillInvoiceItem[];
		note?: string;
		dueDate?: string;
	};
}

/** 全UIコマンドの Union 型 */
export type UICommand =
	| OpenJournalEditorCommand
	| NavigateToCommand
	| SetSearchQueryCommand
	| ConfirmDeleteJournalCommand
	| OpenInvoiceEditorCommand;

// =============================================================================
// Store 実装
// =============================================================================

/** 未処理のUIコマンド */
let pendingCommand = $state<UICommand | null>(null);

/**
 * UIコマンドを発行する
 *
 * WebMCPツール内から呼び出し、ページコンポーネントに処理を委譲する。
 * 前のコマンドが未処理の場合は上書きされる。
 */
export function dispatchUICommand(command: UICommand): void {
	pendingCommand = command;
	console.info(`[e-shiwake UICommand] コマンド発行: ${command.type}`, command.data);
}

/**
 * 処理済みのコマンドをクリアする
 *
 * ページコンポーネントがコマンドを処理した後に呼び出す。
 */
export function clearPendingCommand(): void {
	if (pendingCommand) {
		console.info(`[e-shiwake UICommand] コマンドクリア: ${pendingCommand.type}`);
	}
	pendingCommand = null;
}

/**
 * UICommand ストアのリアクティブゲッター
 *
 * ページコンポーネントで $effect 内から使用する。
 *
 * @example
 * ```svelte
 * <script>
 *   import { useUICommand, clearPendingCommand } from '$lib/stores/uiCommand.svelte';
 *   const uiCommand = useUICommand();
 *
 *   $effect(() => {
 *     const cmd = uiCommand.pending;
 *     if (cmd?.type === 'set_search_query') {
 *       searchQuery = cmd.data.query;
 *       clearPendingCommand();
 *     }
 *   });
 * </script>
 * ```
 */
export function useUICommand() {
	return {
		get pending() {
			return pendingCommand;
		}
	};
}
