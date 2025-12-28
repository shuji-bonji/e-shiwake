/**
 * データベース層のユニットテスト
 *
 * fake-indexeddbを使用してIndexedDBをモック
 * 各テストの前後でDBをクリーンアップ
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	db,
	initializeDatabase,
	// 勘定科目
	getAllAccounts,
	getAccountsByType,
	addAccount,
	updateAccount,
	deleteAccount,
	isAccountInUse,
	generateNextCode,
	isSystemAccount,
	// 仕訳
	getJournalsByYear,
	getAvailableYears,
	getJournalById,
	addJournal,
	updateJournal,
	deleteJournal,
	createEmptyJournal,
	validateJournal,
	// 取引先
	getAllVendors,
	searchVendors,
	// 添付ファイル
	generateAttachmentName,
	suggestDocumentType,
	// インポート
	validateExportData
} from './index';
import type { JournalEntry, Account } from '$lib/types';

describe('データベース初期化', () => {
	beforeEach(async () => {
		// テスト前にDBをクリア
		await db.accounts.clear();
		await db.journals.clear();
		await db.vendors.clear();
		await db.settings.clear();
	});

	afterEach(async () => {
		// テスト後にDBをクリア
		await db.accounts.clear();
		await db.journals.clear();
		await db.vendors.clear();
		await db.settings.clear();
	});

	it('初回起動時にデフォルト勘定科目が登録される', async () => {
		await initializeDatabase();

		const accounts = await getAllAccounts();
		expect(accounts.length).toBeGreaterThan(0);

		// システム科目が登録されていることを確認
		const cashAccount = accounts.find((a) => a.code === '1001');
		expect(cashAccount).toBeDefined();
		expect(cashAccount?.name).toBe('現金');
		expect(cashAccount?.isSystem).toBe(true);
	});

	it('2回目以降の初期化では重複登録されない', async () => {
		await initializeDatabase();
		const countFirst = await db.accounts.count();

		await initializeDatabase();
		const countSecond = await db.accounts.count();

		expect(countFirst).toBe(countSecond);
	});
});

describe('勘定科目管理', () => {
	beforeEach(async () => {
		await db.accounts.clear();
		await db.journals.clear();
		await db.vendors.clear();
		await initializeDatabase();
	});

	afterEach(async () => {
		await db.accounts.clear();
		await db.journals.clear();
		await db.vendors.clear();
	});

	describe('getAccountsByType', () => {
		it('カテゴリ別に勘定科目を取得できる', async () => {
			const assets = await getAccountsByType('asset');
			expect(assets.length).toBeGreaterThan(0);
			expect(assets.every((a) => a.type === 'asset')).toBe(true);

			const expenses = await getAccountsByType('expense');
			expect(expenses.length).toBeGreaterThan(0);
			expect(expenses.every((a) => a.type === 'expense')).toBe(true);
		});
	});

	describe('addAccount', () => {
		it('ユーザー科目を追加できる', async () => {
			const code = await addAccount({
				code: '5101',
				name: 'テスト科目',
				type: 'expense'
			});

			expect(code).toBe('5101');

			const account = await db.accounts.get('5101');
			expect(account).toBeDefined();
			expect(account?.name).toBe('テスト科目');
			expect(account?.isSystem).toBe(false);
		});
	});

	describe('updateAccount', () => {
		it('勘定科目名を更新できる', async () => {
			await addAccount({
				code: '5101',
				name: '元の名前',
				type: 'expense'
			});

			await updateAccount('5101', { name: '新しい名前' });

			const updated = await db.accounts.get('5101');
			expect(updated?.name).toBe('新しい名前');
		});
	});

	describe('deleteAccount', () => {
		it('ユーザー科目を削除できる', async () => {
			await addAccount({
				code: '5101',
				name: 'テスト科目',
				type: 'expense'
			});

			await deleteAccount('5101');

			const deleted = await db.accounts.get('5101');
			expect(deleted).toBeUndefined();
		});

		it('システム科目は削除できない', async () => {
			await expect(deleteAccount('1001')).rejects.toThrow('システム勘定科目は削除できません');
		});
	});

	describe('isAccountInUse', () => {
		it('使用中の科目を判定できる', async () => {
			// 仕訳で科目を使用
			await db.journals.add({
				id: 'test-journal',
				date: '2024-01-15',
				lines: [
					{ id: '1', type: 'debit', accountCode: '5006', amount: 1000 },
					{ id: '2', type: 'credit', accountCode: '1002', amount: 1000 }
				],
				vendor: 'テスト',
				description: 'テスト仕訳',
				evidenceStatus: 'none',
				attachments: [],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			});

			const inUse = await isAccountInUse('5006');
			expect(inUse).toBe(true);

			const notInUse = await isAccountInUse('5101');
			expect(notInUse).toBe(false);
		});
	});

	describe('generateNextCode', () => {
		it('次のコードを生成できる', async () => {
			// 最初のユーザー科目
			const firstCode = await generateNextCode('expense');
			expect(firstCode).toBe('5100');

			// 追加後、次のコードが生成される
			await addAccount({ code: '5100', name: 'テスト1', type: 'expense' });
			const secondCode = await generateNextCode('expense');
			expect(secondCode).toBe('5101');
		});
	});

	describe('isSystemAccount', () => {
		it('システム科目を判定できる', () => {
			expect(isSystemAccount('1001')).toBe(true); // 現金
			expect(isSystemAccount('5006')).toBe(true); // 消耗品費
			expect(isSystemAccount('5100')).toBe(false); // ユーザー追加
			expect(isSystemAccount('5101')).toBe(false); // ユーザー追加
		});
	});
});

describe('仕訳管理', () => {
	beforeEach(async () => {
		await db.accounts.clear();
		await db.journals.clear();
		await db.vendors.clear();
		await initializeDatabase();
	});

	afterEach(async () => {
		await db.accounts.clear();
		await db.journals.clear();
		await db.vendors.clear();
	});

	describe('createEmptyJournal', () => {
		it('空の仕訳を作成できる', () => {
			const journal = createEmptyJournal();

			expect(journal.date).toBe(new Date().toISOString().slice(0, 10));
			expect(journal.lines).toHaveLength(2);
			expect(journal.lines[0].type).toBe('debit');
			expect(journal.lines[1].type).toBe('credit');
			expect(journal.vendor).toBe('');
			expect(journal.description).toBe('');
			expect(journal.evidenceStatus).toBe('none');
			expect(journal.attachments).toHaveLength(0);
		});
	});

	describe('addJournal', () => {
		it('仕訳を追加できる', async () => {
			const id = await addJournal({
				date: '2024-05-15',
				lines: [
					{ id: '1', type: 'debit', accountCode: '5006', amount: 1000 },
					{ id: '2', type: 'credit', accountCode: '1002', amount: 1000 }
				],
				vendor: 'Amazon',
				description: 'テスト購入',
				evidenceStatus: 'none',
				attachments: []
			});

			expect(id).toBeDefined();

			const journal = await getJournalById(id);
			expect(journal).toBeDefined();
			expect(journal?.vendor).toBe('Amazon');
		});

		it('取引先が自動登録される', async () => {
			await addJournal({
				date: '2024-05-15',
				lines: [
					{ id: '1', type: 'debit', accountCode: '5006', amount: 1000 },
					{ id: '2', type: 'credit', accountCode: '1002', amount: 1000 }
				],
				vendor: '新規取引先',
				description: 'テスト',
				evidenceStatus: 'none',
				attachments: []
			});

			const vendors = await getAllVendors();
			const found = vendors.find((v) => v.name === '新規取引先');
			expect(found).toBeDefined();
		});
	});

	describe('updateJournal', () => {
		it('仕訳を更新できる', async () => {
			const id = await addJournal({
				date: '2024-05-15',
				lines: [
					{ id: '1', type: 'debit', accountCode: '5006', amount: 1000 },
					{ id: '2', type: 'credit', accountCode: '1002', amount: 1000 }
				],
				vendor: 'Amazon',
				description: '元の摘要',
				evidenceStatus: 'none',
				attachments: []
			});

			await updateJournal(id, { description: '更新後の摘要' });

			const updated = await getJournalById(id);
			expect(updated?.description).toBe('更新後の摘要');
		});
	});

	describe('deleteJournal', () => {
		it('仕訳を削除できる', async () => {
			const id = await addJournal({
				date: '2024-05-15',
				lines: [
					{ id: '1', type: 'debit', accountCode: '5006', amount: 1000 },
					{ id: '2', type: 'credit', accountCode: '1002', amount: 1000 }
				],
				vendor: 'Amazon',
				description: 'テスト',
				evidenceStatus: 'none',
				attachments: []
			});

			await deleteJournal(id);

			const deleted = await getJournalById(id);
			expect(deleted).toBeUndefined();
		});
	});

	describe('getJournalsByYear', () => {
		it('年度別に仕訳を取得できる', async () => {
			// 2024年の仕訳
			await addJournal({
				date: '2024-03-15',
				lines: [
					{ id: '1', type: 'debit', accountCode: '5006', amount: 1000 },
					{ id: '2', type: 'credit', accountCode: '1002', amount: 1000 }
				],
				vendor: 'A',
				description: '2024年仕訳',
				evidenceStatus: 'none',
				attachments: []
			});

			// 2025年の仕訳
			await addJournal({
				date: '2025-01-10',
				lines: [
					{ id: '3', type: 'debit', accountCode: '5006', amount: 2000 },
					{ id: '4', type: 'credit', accountCode: '1002', amount: 2000 }
				],
				vendor: 'B',
				description: '2025年仕訳',
				evidenceStatus: 'none',
				attachments: []
			});

			const journals2024 = await getJournalsByYear(2024);
			expect(journals2024).toHaveLength(1);
			expect(journals2024[0].description).toBe('2024年仕訳');

			const journals2025 = await getJournalsByYear(2025);
			expect(journals2025).toHaveLength(1);
			expect(journals2025[0].description).toBe('2025年仕訳');
		});

		it('日付降順でソートされる', async () => {
			await addJournal({
				date: '2024-01-15',
				lines: [
					{ id: '1', type: 'debit', accountCode: '5006', amount: 1000 },
					{ id: '2', type: 'credit', accountCode: '1002', amount: 1000 }
				],
				vendor: 'A',
				description: '1月',
				evidenceStatus: 'none',
				attachments: []
			});

			await addJournal({
				date: '2024-06-20',
				lines: [
					{ id: '3', type: 'debit', accountCode: '5006', amount: 2000 },
					{ id: '4', type: 'credit', accountCode: '1002', amount: 2000 }
				],
				vendor: 'B',
				description: '6月',
				evidenceStatus: 'none',
				attachments: []
			});

			await addJournal({
				date: '2024-03-10',
				lines: [
					{ id: '5', type: 'debit', accountCode: '5006', amount: 3000 },
					{ id: '6', type: 'credit', accountCode: '1002', amount: 3000 }
				],
				vendor: 'C',
				description: '3月',
				evidenceStatus: 'none',
				attachments: []
			});

			const journals = await getJournalsByYear(2024);
			expect(journals[0].description).toBe('6月');
			expect(journals[1].description).toBe('3月');
			expect(journals[2].description).toBe('1月');
		});
	});

	describe('getAvailableYears', () => {
		it('仕訳がない場合は現在年度のみ返す', async () => {
			const years = await getAvailableYears();
			const currentYear = new Date().getFullYear();

			expect(years).toContain(currentYear);
		});

		it('仕訳から年度を抽出する', async () => {
			await addJournal({
				date: '2023-05-15',
				lines: [
					{ id: '1', type: 'debit', accountCode: '5006', amount: 1000 },
					{ id: '2', type: 'credit', accountCode: '1002', amount: 1000 }
				],
				vendor: 'A',
				description: '2023年',
				evidenceStatus: 'none',
				attachments: []
			});

			await addJournal({
				date: '2024-03-10',
				lines: [
					{ id: '3', type: 'debit', accountCode: '5006', amount: 2000 },
					{ id: '4', type: 'credit', accountCode: '1002', amount: 2000 }
				],
				vendor: 'B',
				description: '2024年',
				evidenceStatus: 'none',
				attachments: []
			});

			const years = await getAvailableYears();
			const currentYear = new Date().getFullYear();

			expect(years).toContain(2023);
			expect(years).toContain(2024);
			expect(years).toContain(currentYear); // 現在年度は常に含まれる
		});

		it('現在年度は常に含まれる', async () => {
			// 過去の仕訳のみ追加
			await addJournal({
				date: '2020-05-15',
				lines: [
					{ id: '1', type: 'debit', accountCode: '5006', amount: 1000 },
					{ id: '2', type: 'credit', accountCode: '1002', amount: 1000 }
				],
				vendor: 'A',
				description: '2020年',
				evidenceStatus: 'none',
				attachments: []
			});

			const years = await getAvailableYears();
			const currentYear = new Date().getFullYear();

			expect(years).toContain(currentYear);
			expect(years).toContain(2020);
		});

		it('降順でソートされる', async () => {
			await addJournal({
				date: '2022-01-01',
				lines: [
					{ id: '1', type: 'debit', accountCode: '5006', amount: 1000 },
					{ id: '2', type: 'credit', accountCode: '1002', amount: 1000 }
				],
				vendor: 'A',
				description: '2022年',
				evidenceStatus: 'none',
				attachments: []
			});

			await addJournal({
				date: '2024-01-01',
				lines: [
					{ id: '3', type: 'debit', accountCode: '5006', amount: 2000 },
					{ id: '4', type: 'credit', accountCode: '1002', amount: 2000 }
				],
				vendor: 'B',
				description: '2024年',
				evidenceStatus: 'none',
				attachments: []
			});

			const years = await getAvailableYears();

			// 降順であることを確認
			for (let i = 0; i < years.length - 1; i++) {
				expect(years[i]).toBeGreaterThan(years[i + 1]);
			}
		});
	});

	describe('validateJournal', () => {
		it('借方と貸方が一致する仕訳は有効', () => {
			const result = validateJournal({
				lines: [
					{ id: '1', type: 'debit', accountCode: '5006', amount: 1000 },
					{ id: '2', type: 'credit', accountCode: '1002', amount: 1000 }
				]
			});

			expect(result.isValid).toBe(true);
			expect(result.debitTotal).toBe(1000);
			expect(result.creditTotal).toBe(1000);
		});

		it('借方と貸方が一致しない仕訳は無効', () => {
			const result = validateJournal({
				lines: [
					{ id: '1', type: 'debit', accountCode: '5006', amount: 1000 },
					{ id: '2', type: 'credit', accountCode: '1002', amount: 500 }
				]
			});

			expect(result.isValid).toBe(false);
			expect(result.debitTotal).toBe(1000);
			expect(result.creditTotal).toBe(500);
		});

		it('金額が0の仕訳は無効', () => {
			const result = validateJournal({
				lines: [
					{ id: '1', type: 'debit', accountCode: '5006', amount: 0 },
					{ id: '2', type: 'credit', accountCode: '1002', amount: 0 }
				]
			});

			expect(result.isValid).toBe(false);
		});

		it('複合仕訳も検証できる', () => {
			// 家事按分の例: 通信費8000 + 事業主貸2000 = 普通預金10000
			const result = validateJournal({
				lines: [
					{ id: '1', type: 'debit', accountCode: '5004', amount: 8000 },
					{ id: '2', type: 'debit', accountCode: '1005', amount: 2000 },
					{ id: '3', type: 'credit', accountCode: '1002', amount: 10000 }
				]
			});

			expect(result.isValid).toBe(true);
			expect(result.debitTotal).toBe(10000);
			expect(result.creditTotal).toBe(10000);
		});
	});
});

describe('取引先管理', () => {
	beforeEach(async () => {
		await db.vendors.clear();
	});

	afterEach(async () => {
		await db.vendors.clear();
	});

	describe('searchVendors', () => {
		it('部分一致で検索できる', async () => {
			await db.vendors.bulkAdd([
				{ id: '1', name: 'Amazon', createdAt: new Date().toISOString() },
				{ id: '2', name: 'Apple', createdAt: new Date().toISOString() },
				{ id: '3', name: 'Google', createdAt: new Date().toISOString() }
			]);

			const results = await searchVendors('A');
			expect(results).toHaveLength(2);
			expect(results.map((v) => v.name)).toContain('Amazon');
			expect(results.map((v) => v.name)).toContain('Apple');
		});

		it('大文字小文字を区別しない', async () => {
			await db.vendors.add({ id: '1', name: 'Amazon', createdAt: new Date().toISOString() });

			const results = await searchVendors('amazon');
			expect(results).toHaveLength(1);
			expect(results[0].name).toBe('Amazon');
		});

		it('空クエリは全件返す', async () => {
			await db.vendors.bulkAdd([
				{ id: '1', name: 'A', createdAt: new Date().toISOString() },
				{ id: '2', name: 'B', createdAt: new Date().toISOString() }
			]);

			const results = await searchVendors('');
			expect(results).toHaveLength(2);
		});
	});
});

describe('添付ファイル', () => {
	describe('generateAttachmentName', () => {
		it('正しいファイル名を生成する', () => {
			const name = generateAttachmentName('2024-01-15', 'receipt', 'コーヒー代', 500, 'スターバックス');

			expect(name).toBe('2024-01-15_領収書_コーヒー代_500円_スターバックス.pdf');
		});

		it('特殊文字がサニタイズされる', () => {
			const name = generateAttachmentName('2024-01-15', 'receipt', 'テスト/購入', 1000, 'A*B?C');

			expect(name).not.toContain('/');
			expect(name).not.toContain('*');
			expect(name).not.toContain('?');
		});

		it('空の摘要・取引先はデフォルト値になる', () => {
			const name = generateAttachmentName('2024-01-15', 'receipt', '', 1000, '');

			expect(name).toContain('未分類');
			expect(name).toContain('不明');
		});

		it('金額がカンマ区切りでフォーマットされる', () => {
			const name = generateAttachmentName('2024-01-15', 'receipt', 'テスト', 1234567, 'テスト社');

			expect(name).toContain('1,234,567円');
		});
	});

	describe('suggestDocumentType', () => {
		it('費用系は領収書を提案', () => {
			expect(suggestDocumentType('expense')).toBe('receipt');
		});

		it('収益系は請求書を提案', () => {
			expect(suggestDocumentType('revenue')).toBe('invoice');
		});

		it('その他はotherを返す', () => {
			expect(suggestDocumentType('asset')).toBe('other');
			expect(suggestDocumentType('liability')).toBe('other');
			expect(suggestDocumentType(null)).toBe('other');
		});
	});
});

describe('インポート/エクスポート', () => {
	describe('validateExportData', () => {
		it('有効なデータを検証できる', () => {
			const validData = {
				version: '1.0.0',
				exportedAt: '2024-01-15T00:00:00.000Z',
				fiscalYear: 2024,
				journals: [],
				accounts: [],
				vendors: [],
				settings: {}
			};

			expect(validateExportData(validData)).toBe(true);
		});

		it('無効なデータを検出できる', () => {
			expect(validateExportData(null)).toBe(false);
			expect(validateExportData({})).toBe(false);
			expect(validateExportData({ version: '1.0.0' })).toBe(false);
			expect(
				validateExportData({
					version: '1.0.0',
					exportedAt: '2024-01-15',
					fiscalYear: '2024', // 数値でないといけない
					journals: [],
					accounts: [],
					vendors: []
				})
			).toBe(false);
		});
	});
});
