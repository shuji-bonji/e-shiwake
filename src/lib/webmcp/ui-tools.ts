/**
 * e-shiwake WebMCP UI操作型ツール定義
 *
 * データを直接操作するのではなく、UIを操作してユーザーに確認させる
 * Human-in-the-Loop パターンのツール群。
 *
 * フロー:
 *   AIエージェント → UIツール → UICommand Store → ページコンポーネント
 *   → ユーザーが確認・確定
 *
 * @experimental Phase 2: UI操作型WebMCPツール
 */

import type { WebMCPToolDefinition, ToolExecutionResult } from './types';
import { optionalString, optionalArray } from './validate';
import { dispatchUICommand } from '$lib/stores/uiCommand.svelte';
import type { PrefillJournalLine, PrefillInvoiceItem } from '$lib/stores/uiCommand.svelte';

// =============================================================================
// ヘルパー関数
// =============================================================================

/** 成功レスポンスを生成（テキストメッセージ） */
function uiOk(message: string): ToolExecutionResult {
	return {
		content: [{ type: 'text', text: message }]
	};
}

/** エラーレスポンスを生成 */
function uiErr(message: string): ToolExecutionResult {
	return {
		content: [{ type: 'text', text: `エラー: ${message}` }]
	};
}

// =============================================================================
// ページパスマッピング
// =============================================================================

const PAGE_PATHS: Record<string, string> = {
	journal: '/',
	ledger: '/ledger',
	'trial-balance': '/trial-balance',
	'profit-loss': '/profit-loss',
	'balance-sheet': '/balance-sheet',
	'tax-summary': '/tax-summary',
	'fixed-assets': '/fixed-assets',
	'blue-return': '/blue-return',
	reports: '/reports',
	invoice: '/invoice',
	vendors: '/vendors',
	accounts: '/accounts',
	data: '/data',
	help: '/help'
};

const PAGE_NAMES: Record<string, string> = {
	journal: '仕訳帳',
	ledger: '総勘定元帳',
	'trial-balance': '試算表',
	'profit-loss': '損益計算書',
	'balance-sheet': '貸借対照表',
	'tax-summary': '消費税集計',
	'fixed-assets': '固定資産台帳',
	'blue-return': '青色申告決算書',
	reports: '帳簿出力',
	invoice: '請求書一覧',
	vendors: '取引先管理',
	accounts: '勘定科目管理',
	data: 'データ管理',
	help: 'ヘルプ'
};

// =============================================================================
// UI操作型ツール定義
// =============================================================================

/**
 * ページ遷移ツール
 */
const navigateToTool: WebMCPToolDefinition = {
	name: 'navigate_to',
	description: [
		'指定したページに移動する。',
		'',
		'利用可能なページ: journal(仕訳帳), ledger(総勘定元帳), trial-balance(試算表),',
		'profit-loss(損益計算書), balance-sheet(貸借対照表), tax-summary(消費税集計),',
		'fixed-assets(固定資産台帳), blue-return(青色申告決算書), reports(帳簿出力),',
		'invoice(請求書一覧), vendors(取引先管理), accounts(勘定科目管理),',
		'data(データ管理), help(ヘルプ)'
	].join('\n'),
	inputSchema: {
		type: 'object',
		properties: {
			page: {
				type: 'string',
				description:
					'移動先ページ名。例: "journal", "ledger", "trial-balance", "profit-loss", "invoice"',
				enum: Object.keys(PAGE_PATHS)
			}
		},
		required: ['page']
	},
	execute: async (input) => {
		try {
			const page = optionalString(input, 'page');
			if (!page) return uiErr('page は必須です');

			const path = PAGE_PATHS[page];
			if (!path) {
				return uiErr(`不明なページ: "${page}"。利用可能: ${Object.keys(PAGE_PATHS).join(', ')}`);
			}

			dispatchUICommand({ type: 'navigate_to', data: { path } });

			const pageName = PAGE_NAMES[page] ?? page;
			return uiOk(`${pageName}ページに移動しました。`);
		} catch (e) {
			return uiErr(`ナビゲーションエラー: ${e instanceof Error ? e.message : String(e)}`);
		}
	}
};

/**
 * 仕訳入力フォームを開くツール
 *
 * 仕訳帳ページに新規仕訳フォームを表示し、
 * 指定されたデータでプリフィルする。
 * ユーザーは内容を確認して確定ボタンを押す。
 */
const openJournalEditorTool: WebMCPToolDefinition = {
	name: 'open_journal_editor',
	description: [
		'仕訳入力フォームを開き、指定データでプリフィルする。',
		'ユーザーが内容を確認して確定ボタンを押すまでデータは保存されない。',
		'',
		'プリフィル項目: 日付、摘要、取引先、借方明細、貸方明細',
		'借方/貸方の明細行は { accountCode, amount, taxCategory?, memo? } の配列。',
		'',
		'勘定科目コード例: 1001=現金, 1002=売掛金, 1003=普通預金, 2002=未払金,',
		'3001=事業主貸, 4001=売上高, 5003=消耗品費, 5005=旅費交通費, 5018=情報処理費',
		'',
		'消費税区分: purchase_10(課仕10%), purchase_8(課仕8%), sales_10(課売10%),',
		'sales_8(課売8%), exempt(非課税), out_of_scope(不課税), na(対象外)'
	].join('\n'),
	inputSchema: {
		type: 'object',
		properties: {
			date: {
				type: 'string',
				description: '取引日（YYYY-MM-DD形式）。省略時は今日の日付'
			},
			description: {
				type: 'string',
				description: '摘要（取引内容の説明）'
			},
			vendor: {
				type: 'string',
				description: '取引先名'
			},
			debitLines: {
				type: 'array',
				description:
					'借方明細行の配列。各行: { accountCode: "5005", amount: 1200, taxCategory?: "purchase_10", memo?: "" }',
				items: { type: 'object' }
			},
			creditLines: {
				type: 'array',
				description:
					'貸方明細行の配列。各行: { accountCode: "1001", amount: 1200, taxCategory?: "na", memo?: "" }',
				items: { type: 'object' }
			}
		}
	},
	execute: async (input) => {
		try {
			const date = optionalString(input, 'date');
			const description = optionalString(input, 'description');
			const vendor = optionalString(input, 'vendor');
			const debitLines = optionalArray<PrefillJournalLine>(input, 'debitLines');
			const creditLines = optionalArray<PrefillJournalLine>(input, 'creditLines');

			// 仕訳帳ページへのナビゲーション（別ページにいる場合）
			dispatchUICommand({ type: 'navigate_to', data: { path: '/' } });

			// 少し遅延させてからエディタコマンドを発行（ナビゲーション完了を待つ）
			await new Promise((resolve) => setTimeout(resolve, 100));

			dispatchUICommand({
				type: 'open_journal_editor',
				data: {
					date,
					description,
					vendor,
					debitLines,
					creditLines
				}
			});

			const parts: string[] = ['仕訳入力フォームを開きました。'];
			if (description) parts.push(`摘要: ${description}`);
			if (vendor) parts.push(`取引先: ${vendor}`);
			if (debitLines?.length) {
				const total = debitLines.reduce((sum, l) => sum + (l.amount ?? 0), 0);
				parts.push(`借方合計: ${total.toLocaleString()}円`);
			}
			parts.push('内容を確認して確定ボタンを押してください。');

			return uiOk(parts.join('\n'));
		} catch (e) {
			return uiErr(`仕訳エディタ起動エラー: ${e instanceof Error ? e.message : String(e)}`);
		}
	}
};

/**
 * 検索クエリをセットするツール
 *
 * 仕訳帳の検索ボックスにクエリを設定し、検索結果を表示する。
 */
const setSearchQueryTool: WebMCPToolDefinition = {
	name: 'set_search_query',
	description: [
		'仕訳帳の検索ボックスにクエリを設定し、検索結果を表示する。',
		'',
		'検索可能: 摘要・取引先（テキスト部分一致）、勘定科目名、金額、',
		'日付（YYYY-MM-DD, YYYY-MM, MM月, M/D）。',
		'スペース区切りでAND検索が可能。',
		'',
		'例: "Amazon", "消耗品費", "10000", "2026-02", "12月", "Amazon 12月"'
	].join('\n'),
	inputSchema: {
		type: 'object',
		properties: {
			query: {
				type: 'string',
				description: '検索クエリ'
			}
		},
		required: ['query']
	},
	execute: async (input) => {
		try {
			const query = optionalString(input, 'query');
			if (!query) return uiErr('query は必須です');

			// 仕訳帳ページへのナビゲーション（別ページにいる場合）
			dispatchUICommand({ type: 'navigate_to', data: { path: '/' } });

			await new Promise((resolve) => setTimeout(resolve, 100));

			dispatchUICommand({ type: 'set_search_query', data: { query } });

			return uiOk(`検索クエリ「${query}」をセットしました。検索結果が表示されています。`);
		} catch (e) {
			return uiErr(`検索クエリセットエラー: ${e instanceof Error ? e.message : String(e)}`);
		}
	}
};

/**
 * 仕訳削除確認ダイアログを表示するツール
 *
 * 指定された仕訳をハイライトし、削除確認ダイアログを表示する。
 * ユーザーが確認ボタンを押すまで削除は実行されない。
 */
const confirmDeleteJournalTool: WebMCPToolDefinition = {
	name: 'confirm_delete_journal',
	description: [
		'仕訳の削除確認ダイアログを表示する。',
		'ユーザーが確認ボタンを押すまで削除は実行されない（Human-in-the-Loop）。',
		'',
		'仕訳IDは search_journals や get_journals_by_year の結果から取得すること。'
	].join('\n'),
	inputSchema: {
		type: 'object',
		properties: {
			id: {
				type: 'string',
				description: '削除対象の仕訳ID（UUID）'
			}
		},
		required: ['id']
	},
	execute: async (input) => {
		try {
			const id = optionalString(input, 'id');
			if (!id) return uiErr('id は必須です');

			// 仕訳帳ページへのナビゲーション（別ページにいる場合）
			dispatchUICommand({ type: 'navigate_to', data: { path: '/' } });

			await new Promise((resolve) => setTimeout(resolve, 100));

			dispatchUICommand({ type: 'confirm_delete_journal', data: { id } });

			return uiOk(
				`仕訳の削除確認ダイアログを表示しました。内容を確認して削除ボタンを押してください。`
			);
		} catch (e) {
			return uiErr(`削除確認エラー: ${e instanceof Error ? e.message : String(e)}`);
		}
	}
};

/**
 * 請求書エディタを開くツール
 *
 * 新規請求書エディタを表示し、指定されたデータでプリフィルする。
 */
const openInvoiceEditorTool: WebMCPToolDefinition = {
	name: 'open_invoice_editor',
	description: [
		'新規請求書エディタを開き、指定データでプリフィルする。',
		'ユーザーが内容を確認して保存するまでデータは確定されない。',
		'',
		'明細行: { description: "品名", quantity: 1, unitPrice: 100000, taxRate: 10 }',
		'taxRate は 10（10%）または 8（8%軽減税率）。'
	].join('\n'),
	inputSchema: {
		type: 'object',
		properties: {
			vendorId: {
				type: 'string',
				description: '取引先ID（list_vendorsで取得可能）'
			},
			items: {
				type: 'array',
				description:
					'明細行の配列。各行: { description: "品名", quantity: 1, unitPrice: 100000, taxRate: 10 }',
				items: { type: 'object' }
			},
			note: {
				type: 'string',
				description: '備考'
			},
			dueDate: {
				type: 'string',
				description: '支払期限（YYYY-MM-DD形式）'
			}
		}
	},
	execute: async (input) => {
		try {
			const vendorId = optionalString(input, 'vendorId');
			const items = optionalArray<PrefillInvoiceItem>(input, 'items');
			const note = optionalString(input, 'note');
			const dueDate = optionalString(input, 'dueDate');

			// 新規請求書ページへナビゲート
			dispatchUICommand({ type: 'navigate_to', data: { path: '/invoice/new' } });

			await new Promise((resolve) => setTimeout(resolve, 200));

			dispatchUICommand({
				type: 'open_invoice_editor',
				data: {
					vendorId,
					items,
					note,
					dueDate
				}
			});

			const parts: string[] = ['請求書エディタを開きました。'];
			if (items?.length) {
				parts.push(`明細行: ${items.length}件`);
				const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
				parts.push(`税抜合計: ${total.toLocaleString()}円`);
			}
			parts.push('内容を確認してください。');

			return uiOk(parts.join('\n'));
		} catch (e) {
			return uiErr(`請求書エディタ起動エラー: ${e instanceof Error ? e.message : String(e)}`);
		}
	}
};

// =============================================================================
// エクスポート
// =============================================================================

/**
 * e-shiwake WebMCP UI操作型ツール一覧
 *
 * カテゴリ:
 * - ナビゲーション: navigate_to
 * - 仕訳UI操作: open_journal_editor, set_search_query, confirm_delete_journal
 * - 請求書UI操作: open_invoice_editor
 */
export const webmcpUITools: WebMCPToolDefinition[] = [
	navigateToTool,
	openJournalEditorTool,
	setSearchQueryTool,
	confirmDeleteJournalTool,
	openInvoiceEditorTool
];
