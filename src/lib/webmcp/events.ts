/**
 * WebMCP カスタムイベント
 *
 * WebMCP のツール実行後にUIを自動更新するためのイベント。
 * IndexedDB を直接操作するため、Svelte のリアクティブ状態と同期が必要。
 *
 * @experimental WebMCP Early Preview（2026年2月）
 */

/** WebMCP データ変更イベントの型 */
export type WebMCPChangeAction = 'create' | 'delete';

export interface WebMCPJournalChangeDetail {
	action: WebMCPChangeAction;
	journalId: string;
}

/** イベント名 */
export const WEBMCP_JOURNAL_CHANGE = 'webmcp:journal-change' as const;

/**
 * 仕訳変更イベントを発火する
 *
 * WebMCP ツール（create_journal / delete_journal）が
 * IndexedDB を直接操作した後に呼び出す。
 * 仕訳帳ページがリッスンしてデータを再取得する。
 */
export function dispatchJournalChange(action: WebMCPChangeAction, journalId: string): void {
	if (typeof window === 'undefined') return;

	const event = new CustomEvent<WebMCPJournalChangeDetail>(WEBMCP_JOURNAL_CHANGE, {
		detail: { action, journalId }
	});
	window.dispatchEvent(event);
	console.info(
		`[e-shiwake WebMCP] イベント発火: ${WEBMCP_JOURNAL_CHANGE} (${action}: ${journalId})`
	);
}
