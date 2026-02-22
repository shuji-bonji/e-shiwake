/**
 * e-shiwake WebMCP ツール定義
 *
 * ブラウザ内でAIエージェントに公開するツール群
 * Chrome 146+ の navigator.modelContext API を使用
 *
 * @experimental WebMCP Early Preview（2026年2月）
 */

import {
	getAllAccounts,
	getAllJournals,
	getJournalsByYear,
	addJournal,
	deleteJournal,
	validateJournal,
	getAllVendors,
	searchVendors,
	getAvailableYears
} from '$lib/db';
import { generateLedger } from '$lib/utils/ledger';
import { generateTrialBalance } from '$lib/utils/trial-balance';
import { generateProfitLoss } from '$lib/utils/profit-loss';
import { generateBalanceSheet } from '$lib/utils/balance-sheet';
import { generateConsumptionTax } from '$lib/utils/consumption-tax';
import { filterJournals, parseSearchQuery } from '$lib/utils/journal-search';
import type { WebMCPToolDefinition, ToolExecutionResult } from './types';
import {
	requireString,
	optionalString,
	requireNumber,
	optionalNumber,
	requireArray
} from './validate';
import type { JournalEntry, JournalLine } from '$lib/types';

// =============================================================================
// ヘルパー関数
// =============================================================================

/** 成功レスポンスを生成 */
function ok(data: unknown): ToolExecutionResult {
	return {
		content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
	};
}

/** エラーレスポンスを生成 */
function err(message: string): ToolExecutionResult {
	return {
		content: [{ type: 'text', text: JSON.stringify({ error: message }) }]
	};
}

// =============================================================================
// 仕訳ツール
// =============================================================================

const searchJournalsTool: WebMCPToolDefinition = {
	name: 'search_journals',
	description:
		'仕訳を全年度横断で検索する。キーワード（摘要・取引先）、勘定科目名、金額、日付（YYYY-MM-DD, YYYY-MM, MM月）で検索可能。スペース区切りでAND検索。',
	inputSchema: {
		type: 'object',
		properties: {
			query: {
				type: 'string',
				description:
					'検索クエリ。例: "Amazon", "消耗品費", "10000", "2025-01", "12月", "Amazon 12月"'
			},
			fiscalYear: {
				type: 'number',
				description: '年度を指定する場合（例: 2025）。省略時は全年度を検索'
			}
		},
		required: ['query']
	},
	execute: async (input) => {
		try {
			const query = requireString(input, 'query');
			const fiscalYear = optionalNumber(input, 'fiscalYear');

			let journals: JournalEntry[];
			if (fiscalYear) {
				journals = await getJournalsByYear(fiscalYear);
			} else {
				journals = await getAllJournals();
			}

			const accounts = await getAllAccounts();
			const parsedQuery = parseSearchQuery(query, accounts);
			const results = filterJournals(journals, parsedQuery);

			return ok({
				count: results.length,
				query,
				fiscalYear: fiscalYear ?? '全年度',
				journals: results.map((j) => ({
					id: j.id,
					date: j.date,
					description: j.description,
					vendor: j.vendor,
					lines: j.lines.map((l) => ({
						type: l.type,
						accountCode: l.accountCode,
						accountName: accounts.find((a) => a.code === l.accountCode)?.name ?? l.accountCode,
						amount: l.amount,
						taxCategory: l.taxCategory
					})),
					evidenceStatus: j.evidenceStatus
				}))
			});
		} catch (e) {
			return err(`検索エラー: ${e instanceof Error ? e.message : String(e)}`);
		}
	}
};

const getJournalsByYearTool: WebMCPToolDefinition = {
	name: 'get_journals_by_year',
	description: '指定した会計年度の全仕訳を取得する',
	inputSchema: {
		type: 'object',
		properties: {
			year: {
				type: 'number',
				description: '会計年度（例: 2025）'
			}
		},
		required: ['year']
	},
	execute: async (input) => {
		try {
			const year = requireNumber(input, 'year');
			const journals = await getJournalsByYear(year);
			const accounts = await getAllAccounts();

			return ok({
				year,
				count: journals.length,
				journals: journals.map((j) => ({
					id: j.id,
					date: j.date,
					description: j.description,
					vendor: j.vendor,
					debitTotal: j.lines
						.filter((l) => l.type === 'debit')
						.reduce((sum, l) => sum + l.amount, 0),
					creditTotal: j.lines
						.filter((l) => l.type === 'credit')
						.reduce((sum, l) => sum + l.amount, 0),
					lines: j.lines.map((l) => ({
						type: l.type,
						accountName: accounts.find((a) => a.code === l.accountCode)?.name ?? l.accountCode,
						amount: l.amount
					}))
				}))
			});
		} catch (e) {
			return err(`仕訳取得エラー: ${e instanceof Error ? e.message : String(e)}`);
		}
	}
};

const createJournalTool: WebMCPToolDefinition = {
	name: 'create_journal',
	description:
		'複合仕訳を作成する。借方合計と貸方合計は一致させること。勘定科目コードは4桁（例: 1001=現金, 5005=旅費交通費）。',
	inputSchema: {
		type: 'object',
		properties: {
			date: {
				type: 'string',
				description: '取引日（YYYY-MM-DD形式）'
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
					'借方明細行の配列。各行は { accountCode: "5005", amount: 1200, taxCategory?: "purchase_10" }',
				items: { type: 'object' }
			},
			creditLines: {
				type: 'array',
				description:
					'貸方明細行の配列。各行は { accountCode: "1001", amount: 1200, taxCategory?: "na" }',
				items: { type: 'object' }
			}
		},
		required: ['date', 'description', 'debitLines', 'creditLines']
	},
	execute: async (input) => {
		try {
			const date = requireString(input, 'date');
			const description = requireString(input, 'description');
			const vendor = optionalString(input, 'vendor') ?? '';
			const debitLines = requireArray<{
				accountCode: string;
				amount: number;
				taxCategory?: string;
				memo?: string;
			}>(input, 'debitLines');
			const creditLines = requireArray<{
				accountCode: string;
				amount: number;
				taxCategory?: string;
				memo?: string;
			}>(input, 'creditLines');

			// 仕訳明細行を構築
			const lines: JournalLine[] = [
				...debitLines.map((l) => ({
					id: crypto.randomUUID(),
					type: 'debit' as const,
					accountCode: l.accountCode,
					amount: l.amount,
					taxCategory: (l.taxCategory ?? 'na') as JournalLine['taxCategory'],
					memo: l.memo
				})),
				...creditLines.map((l) => ({
					id: crypto.randomUUID(),
					type: 'credit' as const,
					accountCode: l.accountCode,
					amount: l.amount,
					taxCategory: (l.taxCategory ?? 'na') as JournalLine['taxCategory'],
					memo: l.memo
				}))
			];

			// バリデーション
			const validation = validateJournal({ lines });
			if (!validation.isValid) {
				const errors: string[] = [];
				if (validation.hasEmptyAccounts) errors.push('勘定科目が未選択の行があります');
				if (validation.debitTotal !== validation.creditTotal)
					errors.push(`借方合計(${validation.debitTotal}) ≠ 貸方合計(${validation.creditTotal})`);
				if (validation.debitTotal === 0) errors.push('金額が0です');
				return err(`バリデーションエラー: ${errors.join(', ')}`);
			}

			// 仕訳を作成
			const journal: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'> = {
				date,
				description,
				vendor,
				lines,
				evidenceStatus: 'none',
				attachments: []
			};

			const id = await addJournal(journal);

			return ok({
				success: true,
				id,
				message: `仕訳を作成しました: ${date} ${description}`,
				debitTotal: debitLines.reduce((sum, l) => sum + l.amount, 0),
				creditTotal: creditLines.reduce((sum, l) => sum + l.amount, 0)
			});
		} catch (e) {
			return err(`仕訳作成エラー: ${e instanceof Error ? e.message : String(e)}`);
		}
	}
};

const deleteJournalTool: WebMCPToolDefinition = {
	name: 'delete_journal',
	description: '仕訳を削除する',
	inputSchema: {
		type: 'object',
		properties: {
			id: {
				type: 'string',
				description: '削除する仕訳のID'
			}
		},
		required: ['id']
	},
	execute: async (input) => {
		try {
			const id = requireString(input, 'id');
			await deleteJournal(id);
			return ok({ success: true, message: `仕訳 ${id} を削除しました` });
		} catch (e) {
			return err(`削除エラー: ${e instanceof Error ? e.message : String(e)}`);
		}
	}
};

// =============================================================================
// 勘定科目・取引先ツール
// =============================================================================

const listAccountsTool: WebMCPToolDefinition = {
	name: 'list_accounts',
	description:
		'勘定科目マスタ一覧を取得する。カテゴリ: asset(資産), liability(負債), equity(純資産), revenue(収益), expense(費用)',
	inputSchema: {
		type: 'object',
		properties: {
			type: {
				type: 'string',
				description: 'カテゴリでフィルタ。省略時は全科目',
				enum: ['asset', 'liability', 'equity', 'revenue', 'expense']
			}
		}
	},
	execute: async (input) => {
		try {
			const accounts = await getAllAccounts();
			const type = optionalString(input, 'type');
			const filtered = type ? accounts.filter((a) => a.type === type) : accounts;

			return ok({
				count: filtered.length,
				accounts: filtered.map((a) => ({
					code: a.code,
					name: a.name,
					type: a.type,
					isSystem: a.isSystem,
					defaultTaxCategory: a.defaultTaxCategory
				}))
			});
		} catch (e) {
			return err(`勘定科目取得エラー: ${e instanceof Error ? e.message : String(e)}`);
		}
	}
};

const listVendorsTool: WebMCPToolDefinition = {
	name: 'list_vendors',
	description: '取引先一覧を取得する',
	inputSchema: {
		type: 'object',
		properties: {
			query: {
				type: 'string',
				description: '取引先名で検索（省略時は全件）'
			}
		}
	},
	execute: async (input) => {
		try {
			const query = optionalString(input, 'query');
			const vendors = query ? await searchVendors(query) : await getAllVendors();

			return ok({
				count: vendors.length,
				vendors: vendors.map((v) => ({
					id: v.id,
					name: v.name
				}))
			});
		} catch (e) {
			return err(`取引先取得エラー: ${e instanceof Error ? e.message : String(e)}`);
		}
	}
};

// =============================================================================
// 帳簿生成ツール
// =============================================================================

const generateLedgerTool: WebMCPToolDefinition = {
	name: 'generate_ledger',
	description: '指定した勘定科目の総勘定元帳を生成する',
	inputSchema: {
		type: 'object',
		properties: {
			accountCode: {
				type: 'string',
				description: '勘定科目コード（例: "1001"）'
			},
			fiscalYear: {
				type: 'number',
				description: '会計年度'
			}
		},
		required: ['accountCode', 'fiscalYear']
	},
	execute: async (input) => {
		try {
			const accountCode = requireString(input, 'accountCode');
			const year = requireNumber(input, 'fiscalYear');
			const journals = await getJournalsByYear(year);
			const accounts = await getAllAccounts();
			const account = accounts.find((a) => a.code === accountCode);

			if (!account) {
				return err(`勘定科目 ${accountCode} が見つかりません`);
			}

			const ledger = generateLedger(journals, accountCode, accounts);

			return ok({
				accountCode,
				accountName: account.name,
				fiscalYear: year,
				entries: ledger.entries,
				closingBalance: ledger.closingBalance
			});
		} catch (e) {
			return err(`元帳生成エラー: ${e instanceof Error ? e.message : String(e)}`);
		}
	}
};

const generateTrialBalanceTool: WebMCPToolDefinition = {
	name: 'generate_trial_balance',
	description: '試算表（合計残高試算表）を生成する',
	inputSchema: {
		type: 'object',
		properties: {
			fiscalYear: {
				type: 'number',
				description: '会計年度'
			}
		},
		required: ['fiscalYear']
	},
	execute: async (input) => {
		try {
			const year = requireNumber(input, 'fiscalYear');
			const journals = await getJournalsByYear(year);
			const accounts = await getAllAccounts();
			const tb = generateTrialBalance(journals, accounts);

			return ok({
				fiscalYear: year,
				rows: tb.rows.map((r) => ({
					accountCode: r.accountCode,
					accountName: r.accountName,
					accountType: r.accountType,
					debitTotal: r.debitTotal,
					creditTotal: r.creditTotal,
					debitBalance: r.debitBalance,
					creditBalance: r.creditBalance
				})),
				totalDebit: tb.totalDebit,
				totalCredit: tb.totalCredit,
				totalDebitBalance: tb.totalDebitBalance,
				totalCreditBalance: tb.totalCreditBalance,
				isBalanced: tb.isBalanced
			});
		} catch (e) {
			return err(`試算表生成エラー: ${e instanceof Error ? e.message : String(e)}`);
		}
	}
};

const generateProfitLossTool: WebMCPToolDefinition = {
	name: 'generate_profit_loss',
	description: '損益計算書を生成する',
	inputSchema: {
		type: 'object',
		properties: {
			fiscalYear: {
				type: 'number',
				description: '会計年度'
			}
		},
		required: ['fiscalYear']
	},
	execute: async (input) => {
		try {
			const year = requireNumber(input, 'fiscalYear');
			const journals = await getJournalsByYear(year);
			const accounts = await getAllAccounts();
			const pl = generateProfitLoss(journals, accounts, year);

			return ok({
				fiscalYear: year,
				salesRevenue: pl.salesRevenue,
				otherRevenue: pl.otherRevenue,
				totalRevenue: pl.totalRevenue,
				costOfSales: pl.costOfSales,
				operatingExpenses: pl.operatingExpenses,
				totalExpenses: pl.totalExpenses,
				grossProfit: pl.grossProfit,
				operatingIncome: pl.operatingIncome,
				netIncome: pl.netIncome
			});
		} catch (e) {
			return err(`損益計算書生成エラー: ${e instanceof Error ? e.message : String(e)}`);
		}
	}
};

const generateBalanceSheetTool: WebMCPToolDefinition = {
	name: 'generate_balance_sheet',
	description: '貸借対照表を生成する',
	inputSchema: {
		type: 'object',
		properties: {
			fiscalYear: {
				type: 'number',
				description: '会計年度'
			}
		},
		required: ['fiscalYear']
	},
	execute: async (input) => {
		try {
			const year = requireNumber(input, 'fiscalYear');
			const journals = await getJournalsByYear(year);
			const accounts = await getAllAccounts();
			// まず損益計算書で当期純利益を求める
			const pl = generateProfitLoss(journals, accounts, year);
			const bs = generateBalanceSheet(journals, accounts, year, pl.netIncome);

			return ok({
				fiscalYear: year,
				currentAssets: bs.currentAssets,
				fixedAssets: bs.fixedAssets,
				totalAssets: bs.totalAssets,
				currentLiabilities: bs.currentLiabilities,
				fixedLiabilities: bs.fixedLiabilities,
				totalLiabilities: bs.totalLiabilities,
				equity: bs.equity,
				retainedEarnings: bs.retainedEarnings,
				totalEquity: bs.totalEquity,
				totalLiabilitiesAndEquity: bs.totalLiabilitiesAndEquity,
				isBalanced: bs.totalAssets === bs.totalLiabilitiesAndEquity
			});
		} catch (e) {
			return err(`貸借対照表生成エラー: ${e instanceof Error ? e.message : String(e)}`);
		}
	}
};

const calculateTaxTool: WebMCPToolDefinition = {
	name: 'calculate_consumption_tax',
	description: '消費税集計を計算する（課税売上・課税仕入・納付税額）',
	inputSchema: {
		type: 'object',
		properties: {
			fiscalYear: {
				type: 'number',
				description: '会計年度'
			}
		},
		required: ['fiscalYear']
	},
	execute: async (input) => {
		try {
			const year = requireNumber(input, 'fiscalYear');
			const journals = await getJournalsByYear(year);
			const tax = generateConsumptionTax(journals, year);

			return ok(tax);
		} catch (e) {
			return err(`消費税計算エラー: ${e instanceof Error ? e.message : String(e)}`);
		}
	}
};

// =============================================================================
// ユーティリティツール
// =============================================================================

const getAvailableYearsTool: WebMCPToolDefinition = {
	name: 'get_available_years',
	description: 'データが存在する会計年度の一覧を取得する',
	inputSchema: {
		type: 'object',
		properties: {}
	},
	execute: async () => {
		try {
			const years = await getAvailableYears();
			return ok({ years, count: years.length });
		} catch (e) {
			return err(`年度取得エラー: ${e instanceof Error ? e.message : String(e)}`);
		}
	}
};

// =============================================================================
// エクスポート
// =============================================================================

/**
 * e-shiwake WebMCP ツール一覧
 *
 * カテゴリ:
 * - 仕訳管理: search_journals, get_journals_by_year, create_journal, delete_journal
 * - マスタ参照: list_accounts, list_vendors
 * - 帳簿生成: generate_ledger, generate_trial_balance, generate_profit_loss, generate_balance_sheet
 * - 税務: calculate_consumption_tax
 * - ユーティリティ: get_available_years
 */
export const webmcpTools: WebMCPToolDefinition[] = [
	// 仕訳管理
	searchJournalsTool,
	getJournalsByYearTool,
	createJournalTool,
	deleteJournalTool,
	// マスタ参照
	listAccountsTool,
	listVendorsTool,
	// 帳簿生成
	generateLedgerTool,
	generateTrialBalanceTool,
	generateProfitLossTool,
	generateBalanceSheetTool,
	// 税務
	calculateTaxTool,
	// ユーティリティ
	getAvailableYearsTool
];
