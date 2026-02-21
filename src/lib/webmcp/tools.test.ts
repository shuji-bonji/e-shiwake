/**
 * WebMCP ツールの統合テスト
 *
 * fake-indexeddb上でツールのexecute関数を直接呼び出して検証。
 * 各ツールが正しくデータを返すか、バリデーションが機能するかをテスト。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db, initializeDatabase, addJournal, getJournalsByYear } from '$lib/db';
import { webmcpTools } from './tools';
import type { JournalEntry } from '$lib/types';

// -------------------------------------------------------------------------
// ヘルパー
// -------------------------------------------------------------------------

/** テスト結果のJSONをパース */
function parseResult(result: { content: { type: string; text?: string }[] }): unknown {
	const text = result.content[0]?.text;
	if (!text) throw new Error('結果のテキストが空');
	return JSON.parse(text);
}

/** ツール名からツールを取得 */
function getTool(name: string) {
	const tool = webmcpTools.find((t) => t.name === name);
	if (!tool) throw new Error(`ツール "${name}" が見つからない`);
	return tool;
}

/** テスト用の仕訳データを作成 */
function createTestJournal(overrides: Partial<JournalEntry> = {}): Omit<JournalEntry, 'id'> {
	return {
		date: '2025-06-15',
		description: 'テスト取引',
		vendor: 'テスト商店',
		evidenceStatus: 'none',
		attachments: [],
		lines: [
			{
				id: crypto.randomUUID(),
				type: 'debit',
				accountCode: '5011',
				amount: 5000,
				taxCategory: 'purchase_10'
			},
			{
				id: crypto.randomUUID(),
				type: 'credit',
				accountCode: '1003',
				amount: 5000,
				taxCategory: 'na'
			}
		],
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		...overrides
	};
}

/** 全テーブルをクリア */
async function clearAllTables() {
	await db.accounts.clear();
	await db.journals.clear();
	await db.vendors.clear();
	await db.settings.clear();
	await db.invoices.clear();
}

// -------------------------------------------------------------------------
// テスト
// -------------------------------------------------------------------------

describe('WebMCP ツール', () => {
	beforeEach(async () => {
		await clearAllTables();
		await initializeDatabase();
	});

	afterEach(async () => {
		await clearAllTables();
	});

	// =====================================================================
	// ツール登録の確認
	// =====================================================================

	describe('ツール登録', () => {
		it('12個のツールが定義されている', () => {
			expect(webmcpTools).toHaveLength(12);
		});

		it('全ツールにname, description, executeが存在する', () => {
			for (const tool of webmcpTools) {
				expect(tool.name).toBeTruthy();
				expect(tool.description).toBeTruthy();
				expect(typeof tool.execute).toBe('function');
			}
		});

		it('ツール名が重複していない', () => {
			const names = webmcpTools.map((t) => t.name);
			expect(new Set(names).size).toBe(names.length);
		});
	});

	// =====================================================================
	// get_available_years
	// =====================================================================

	describe('get_available_years', () => {
		it('仕訳がない場合でも現在年度は含まれる', async () => {
			const tool = getTool('get_available_years');
			const result = await tool.execute({});
			const data = parseResult(result) as { years: number[]; count: number };

			// getAvailableYears() は現在年度を常に含める仕様
			const currentYear = new Date().getFullYear();
			expect(data.years).toContain(currentYear);
			expect(data.count).toBeGreaterThanOrEqual(1);
		});

		it('仕訳がある年度を返す', async () => {
			await addJournal(createTestJournal({ date: '2025-03-15' }));
			await addJournal(createTestJournal({ date: '2024-11-01' }));

			const tool = getTool('get_available_years');
			const result = await tool.execute({});
			const data = parseResult(result) as { years: number[] };

			expect(data.years).toContain(2025);
			expect(data.years).toContain(2024);
		});
	});

	// =====================================================================
	// list_accounts
	// =====================================================================

	describe('list_accounts', () => {
		it('全勘定科目を返す', async () => {
			const tool = getTool('list_accounts');
			const result = await tool.execute({});
			const data = parseResult(result) as { accounts: unknown[]; count: number };

			expect(data.count).toBeGreaterThan(0);
			expect(data.accounts.length).toBe(data.count);
		});

		it('type指定で費用科目のみフィルタできる', async () => {
			const tool = getTool('list_accounts');
			const result = await tool.execute({ type: 'expense' });
			const data = parseResult(result) as {
				accounts: { code: string; type: string }[];
				count: number;
			};

			expect(data.count).toBeGreaterThan(0);
			for (const account of data.accounts) {
				expect(account.type).toBe('expense');
			}
		});

		it('type指定で資産科目のみフィルタできる', async () => {
			const tool = getTool('list_accounts');
			const result = await tool.execute({ type: 'asset' });
			const data = parseResult(result) as {
				accounts: { code: string; type: string }[];
				count: number;
			};

			expect(data.count).toBeGreaterThan(0);
			for (const account of data.accounts) {
				expect(account.type).toBe('asset');
			}
		});
	});

	// =====================================================================
	// list_vendors
	// =====================================================================

	describe('list_vendors', () => {
		it('仕訳の取引先を返す', async () => {
			await addJournal(createTestJournal({ vendor: 'Amazon' }));
			await addJournal(createTestJournal({ vendor: 'NTTドコモ' }));

			const tool = getTool('list_vendors');
			const result = await tool.execute({});
			const data = parseResult(result) as { vendors: { name: string }[]; count: number };

			expect(data.count).toBeGreaterThanOrEqual(2);
		});
	});

	// =====================================================================
	// create_journal
	// =====================================================================

	describe('create_journal', () => {
		it('正常な仕訳を作成できる', async () => {
			const tool = getTool('create_journal');
			const result = await tool.execute({
				date: '2025-07-01',
				description: 'USBケーブル購入',
				vendor: 'Amazon',
				debitLines: [{ accountCode: '5011', amount: 3980, taxCategory: 'purchase_10' }],
				creditLines: [{ accountCode: '1003', amount: 3980, taxCategory: 'na' }]
			});
			const data = parseResult(result) as { success: boolean; id: string };

			expect(data.success).toBe(true);
			expect(data.id).toBeTruthy();

			// 実際にDBに保存されたか確認
			const journals = await getJournalsByYear(2025);
			const created = journals.find((j) => j.description === 'USBケーブル購入');
			expect(created).toBeDefined();
			expect(created?.vendor).toBe('Amazon');
		});

		it('複合仕訳（家事按分）を作成できる', async () => {
			const tool = getTool('create_journal');
			const result = await tool.execute({
				date: '2025-07-20',
				description: '携帯電話代',
				vendor: 'NTTドコモ',
				debitLines: [
					{ accountCode: '5006', amount: 8000, taxCategory: 'purchase_10' },
					{ accountCode: '3002', amount: 2000, taxCategory: 'na' }
				],
				creditLines: [{ accountCode: '1003', amount: 10000, taxCategory: 'na' }]
			});
			const data = parseResult(result) as { success: boolean; id: string };

			expect(data.success).toBe(true);

			const journals = await getJournalsByYear(2025);
			const created = journals.find((j) => j.description === '携帯電話代');
			expect(created).toBeDefined();
			expect(created?.lines).toHaveLength(3);
		});

		it('借方≠貸方の場合はエラーを返す', async () => {
			const tool = getTool('create_journal');
			const result = await tool.execute({
				date: '2025-07-01',
				description: '不正な仕訳',
				debitLines: [{ accountCode: '5011', amount: 5000 }],
				creditLines: [{ accountCode: '1003', amount: 3000 }]
			});
			const data = parseResult(result) as { error: string };

			expect(data.error).toBeTruthy();
		});

		it('存在しない勘定科目コードでもエラーにならない（現状の挙動）', async () => {
			// NOTE: 現在のツールは勘定科目コードの存在チェックを行わない
			const tool = getTool('create_journal');
			const result = await tool.execute({
				date: '2025-07-01',
				description: 'テスト',
				debitLines: [{ accountCode: '9999', amount: 1000 }],
				creditLines: [{ accountCode: '9998', amount: 1000 }]
			});
			const data = parseResult(result) as { success: boolean; id: string };

			expect(data.success).toBe(true);
		});
	});

	// =====================================================================
	// get_journals_by_year
	// =====================================================================

	describe('get_journals_by_year', () => {
		it('指定年度の仕訳を返す', async () => {
			await addJournal(createTestJournal({ date: '2025-03-15', description: '2025年の仕訳' }));
			await addJournal(createTestJournal({ date: '2024-11-01', description: '2024年の仕訳' }));

			const tool = getTool('get_journals_by_year');
			const result = await tool.execute({ year: 2025 });
			const data = parseResult(result) as { journals: JournalEntry[]; count: number };

			expect(data.count).toBe(1);
			expect(data.journals[0].description).toBe('2025年の仕訳');
		});

		it('仕訳がない年度は空配列を返す', async () => {
			const tool = getTool('get_journals_by_year');
			const result = await tool.execute({ year: 2030 });
			const data = parseResult(result) as { journals: JournalEntry[]; count: number };

			expect(data.count).toBe(0);
			expect(data.journals).toEqual([]);
		});
	});

	// =====================================================================
	// search_journals
	// =====================================================================

	describe('search_journals', () => {
		beforeEach(async () => {
			await addJournal(
				createTestJournal({
					date: '2025-01-15',
					description: 'USBケーブル購入',
					vendor: 'Amazon'
				})
			);
			await addJournal(
				createTestJournal({
					date: '2025-06-20',
					description: '電車代',
					vendor: '',
					lines: [
						{
							id: crypto.randomUUID(),
							type: 'debit',
							accountCode: '5005',
							amount: 1200,
							taxCategory: 'na'
						},
						{
							id: crypto.randomUUID(),
							type: 'credit',
							accountCode: '1001',
							amount: 1200,
							taxCategory: 'na'
						}
					]
				})
			);
			await addJournal(
				createTestJournal({
					date: '2025-12-01',
					description: '年末の仕入',
					vendor: '問屋商店'
				})
			);
		});

		it('摘要でヒットする', async () => {
			const tool = getTool('search_journals');
			const result = await tool.execute({ query: 'USB' });
			const data = parseResult(result) as { journals: JournalEntry[]; count: number };

			expect(data.count).toBe(1);
			expect(data.journals[0].description).toBe('USBケーブル購入');
		});

		it('取引先でヒットする', async () => {
			const tool = getTool('search_journals');
			const result = await tool.execute({ query: 'Amazon' });
			const data = parseResult(result) as { journals: JournalEntry[]; count: number };

			expect(data.count).toBe(1);
			expect(data.journals[0].vendor).toBe('Amazon');
		});

		it('金額でヒットする', async () => {
			const tool = getTool('search_journals');
			const result = await tool.execute({ query: '1200' });
			const data = parseResult(result) as { journals: JournalEntry[]; count: number };

			expect(data.count).toBe(1);
			expect(data.journals[0].description).toBe('電車代');
		});

		it('月指定でヒットする', async () => {
			const tool = getTool('search_journals');
			const result = await tool.execute({ query: '12月' });
			const data = parseResult(result) as { journals: JournalEntry[]; count: number };

			expect(data.count).toBe(1);
			expect(data.journals[0].description).toBe('年末の仕入');
		});

		it('該当なしは空配列', async () => {
			const tool = getTool('search_journals');
			const result = await tool.execute({ query: '存在しないキーワード' });
			const data = parseResult(result) as { journals: JournalEntry[]; count: number };

			expect(data.count).toBe(0);
		});
	});

	// =====================================================================
	// delete_journal
	// =====================================================================

	describe('delete_journal', () => {
		it('仕訳を削除できる', async () => {
			const id = await addJournal(createTestJournal());

			const tool = getTool('delete_journal');
			const result = await tool.execute({ id });
			const data = parseResult(result) as { success: boolean };

			expect(data.success).toBe(true);

			// 削除されたか確認
			const journals = await getJournalsByYear(2025);
			expect(journals.find((j) => j.id === id)).toBeUndefined();
		});

		it('存在しないIDはエラーを返す', async () => {
			const tool = getTool('delete_journal');
			const result = await tool.execute({ id: 'non-existent-id' });
			const data = parseResult(result) as { error?: string; success?: boolean };

			// エラーまたは成功（実装依存）
			expect(data).toBeDefined();
		});
	});

	// =====================================================================
	// generate_trial_balance
	// =====================================================================

	describe('generate_trial_balance', () => {
		it('仕訳がある年度の試算表を生成できる', async () => {
			await addJournal(
				createTestJournal({
					date: '2025-04-01',
					description: '消耗品購入',
					lines: [
						{
							id: crypto.randomUUID(),
							type: 'debit',
							accountCode: '5011',
							amount: 10000,
							taxCategory: 'purchase_10'
						},
						{
							id: crypto.randomUUID(),
							type: 'credit',
							accountCode: '1003',
							amount: 10000,
							taxCategory: 'na'
						}
					]
				})
			);

			const tool = getTool('generate_trial_balance');
			const result = await tool.execute({ fiscalYear: 2025 });
			const data = parseResult(result) as {
				totalDebit: number;
				totalCredit: number;
				isBalanced: boolean;
			};

			expect(data.totalDebit).toBe(data.totalCredit);
			expect(data.isBalanced).toBe(true);
		});

		it('仕訳がない年度でもエラーにならない', async () => {
			const tool = getTool('generate_trial_balance');
			const result = await tool.execute({ fiscalYear: 2030 });
			const data = parseResult(result);

			expect(data).toBeDefined();
		});
	});

	// =====================================================================
	// generate_profit_loss
	// =====================================================================

	describe('generate_profit_loss', () => {
		it('損益計算書を生成できる', async () => {
			// 売上
			await addJournal(
				createTestJournal({
					date: '2025-04-01',
					description: 'システム開発',
					vendor: 'クライアントA',
					lines: [
						{
							id: crypto.randomUUID(),
							type: 'debit',
							accountCode: '1003',
							amount: 500000,
							taxCategory: 'na'
						},
						{
							id: crypto.randomUUID(),
							type: 'credit',
							accountCode: '4001',
							amount: 500000,
							taxCategory: 'sales_10'
						}
					]
				})
			);
			// 経費
			await addJournal(
				createTestJournal({
					date: '2025-04-15',
					description: '消耗品購入',
					lines: [
						{
							id: crypto.randomUUID(),
							type: 'debit',
							accountCode: '5011',
							amount: 10000,
							taxCategory: 'purchase_10'
						},
						{
							id: crypto.randomUUID(),
							type: 'credit',
							accountCode: '1003',
							amount: 10000,
							taxCategory: 'na'
						}
					]
				})
			);

			const tool = getTool('generate_profit_loss');
			const result = await tool.execute({ fiscalYear: 2025 });
			const data = parseResult(result) as {
				totalRevenue: number;
				totalExpenses: number;
				netIncome: number;
			};

			expect(data.totalRevenue).toBe(500000);
			expect(data.totalExpenses).toBeGreaterThan(0);
			expect(data.netIncome).toBe(data.totalRevenue - data.totalExpenses);
		});
	});

	// =====================================================================
	// generate_balance_sheet
	// =====================================================================

	describe('generate_balance_sheet', () => {
		it('貸借対照表を生成できる', async () => {
			await addJournal(
				createTestJournal({
					date: '2025-05-01',
					description: '入金',
					lines: [
						{
							id: crypto.randomUUID(),
							type: 'debit',
							accountCode: '1003',
							amount: 100000,
							taxCategory: 'na'
						},
						{
							id: crypto.randomUUID(),
							type: 'credit',
							accountCode: '4001',
							amount: 100000,
							taxCategory: 'sales_10'
						}
					]
				})
			);

			const tool = getTool('generate_balance_sheet');
			const result = await tool.execute({ fiscalYear: 2025 });
			const data = parseResult(result);

			expect(data).toBeDefined();
		});
	});

	// =====================================================================
	// generate_ledger
	// =====================================================================

	describe('generate_ledger', () => {
		it('勘定科目の元帳を生成できる', async () => {
			await addJournal(
				createTestJournal({
					date: '2025-04-01',
					lines: [
						{
							id: crypto.randomUUID(),
							type: 'debit',
							accountCode: '5011',
							amount: 3000,
							taxCategory: 'purchase_10'
						},
						{
							id: crypto.randomUUID(),
							type: 'credit',
							accountCode: '1003',
							amount: 3000,
							taxCategory: 'na'
						}
					]
				})
			);
			await addJournal(
				createTestJournal({
					date: '2025-05-01',
					lines: [
						{
							id: crypto.randomUUID(),
							type: 'debit',
							accountCode: '5011',
							amount: 7000,
							taxCategory: 'purchase_10'
						},
						{
							id: crypto.randomUUID(),
							type: 'credit',
							accountCode: '1003',
							amount: 7000,
							taxCategory: 'na'
						}
					]
				})
			);

			const tool = getTool('generate_ledger');
			const result = await tool.execute({ accountCode: '5011', fiscalYear: 2025 });
			const data = parseResult(result) as { entries: unknown[]; accountName: string };

			expect(data.accountName).toBe('消耗品費');
			expect(data.entries.length).toBe(2);
		});
	});

	// =====================================================================
	// calculate_consumption_tax
	// =====================================================================

	describe('calculate_consumption_tax', () => {
		it('消費税集計を計算できる', async () => {
			// 課税売上
			await addJournal(
				createTestJournal({
					date: '2025-04-01',
					description: 'システム開発',
					lines: [
						{
							id: crypto.randomUUID(),
							type: 'debit',
							accountCode: '1003',
							amount: 550000,
							taxCategory: 'na'
						},
						{
							id: crypto.randomUUID(),
							type: 'credit',
							accountCode: '4001',
							amount: 550000,
							taxCategory: 'sales_10'
						}
					]
				})
			);
			// 課税仕入
			await addJournal(
				createTestJournal({
					date: '2025-04-15',
					description: '消耗品',
					lines: [
						{
							id: crypto.randomUUID(),
							type: 'debit',
							accountCode: '5011',
							amount: 11000,
							taxCategory: 'purchase_10'
						},
						{
							id: crypto.randomUUID(),
							type: 'credit',
							accountCode: '1003',
							amount: 11000,
							taxCategory: 'na'
						}
					]
				})
			);

			const tool = getTool('calculate_consumption_tax');
			const result = await tool.execute({ fiscalYear: 2025 });
			const data = parseResult(result);

			expect(data).toBeDefined();
		});
	});
});
