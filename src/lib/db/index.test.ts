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
	countJournalLinesByAccountCode,
	updateTaxCategoryByAccountCode,
	// 仕訳
	getJournalsByYear,
	getAvailableYears,
	getJournalById,
	addJournal,
	updateJournal,
	deleteJournal,
	deleteYearData,
	createEmptyJournal,
	validateJournal,
	// 取引先
	getAllVendors,
	searchVendors,
	// 添付ファイル
	generateAttachmentName,
	suggestDocumentType,
	// インポート/エクスポート
	validateExportData,
	importData,
	getImportPreview
} from './index';

/**
 * 全テーブルをクリアするヘルパー関数
 * テスト間の独立性を保証する
 */
async function clearAllTables() {
	await db.accounts.clear();
	await db.journals.clear();
	await db.vendors.clear();
	await db.settings.clear();
	// attachmentsテーブルは仕訳に埋め込まれているため個別クリア不要
	// （journalsクリアで一緒に削除される）
}

describe('データベース初期化', () => {
	beforeEach(async () => {
		await clearAllTables();
	});

	afterEach(async () => {
		await clearAllTables();
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
		await clearAllTables();
		await initializeDatabase();
	});

	afterEach(async () => {
		await clearAllTables();
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

	describe('countJournalLinesByAccountCode', () => {
		it('勘定科目を使用している仕訳行の件数を取得できる', async () => {
			// 仕訳を2件追加（5006を3回使用）
			await db.journals.add({
				id: 'journal-1',
				date: '2024-01-15',
				lines: [
					{ id: '1', type: 'debit', accountCode: '5006', amount: 1000, taxCategory: 'purchase_10' },
					{ id: '2', type: 'credit', accountCode: '1002', amount: 1000, taxCategory: 'na' }
				],
				vendor: 'テスト',
				description: 'テスト仕訳1',
				evidenceStatus: 'none',
				attachments: [],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			});
			await db.journals.add({
				id: 'journal-2',
				date: '2024-01-16',
				lines: [
					{ id: '3', type: 'debit', accountCode: '5006', amount: 2000, taxCategory: 'purchase_10' },
					{ id: '4', type: 'debit', accountCode: '5006', amount: 500, taxCategory: 'purchase_10' },
					{ id: '5', type: 'credit', accountCode: '1002', amount: 2500, taxCategory: 'na' }
				],
				vendor: 'テスト',
				description: 'テスト仕訳2',
				evidenceStatus: 'none',
				attachments: [],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			});

			const count = await countJournalLinesByAccountCode('5006');
			expect(count).toBe(3);

			const countNotUsed = await countJournalLinesByAccountCode('5101');
			expect(countNotUsed).toBe(0);
		});
	});

	describe('updateTaxCategoryByAccountCode', () => {
		it('指定した勘定科目の消費税区分を一括更新できる', async () => {
			// 仕訳を追加
			await db.journals.add({
				id: 'journal-1',
				date: '2024-01-15',
				lines: [
					{ id: '1', type: 'debit', accountCode: '5006', amount: 1000, taxCategory: 'purchase_10' },
					{ id: '2', type: 'credit', accountCode: '1002', amount: 1000, taxCategory: 'na' }
				],
				vendor: 'テスト',
				description: 'テスト仕訳1',
				evidenceStatus: 'none',
				attachments: [],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			});
			await db.journals.add({
				id: 'journal-2',
				date: '2024-01-16',
				lines: [
					{ id: '3', type: 'debit', accountCode: '5006', amount: 2000, taxCategory: 'purchase_10' },
					{ id: '4', type: 'credit', accountCode: '1002', amount: 2000, taxCategory: 'na' }
				],
				vendor: 'テスト',
				description: 'テスト仕訳2',
				evidenceStatus: 'none',
				attachments: [],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			});

			// 消費税区分を更新
			const updatedCount = await updateTaxCategoryByAccountCode('5006', 'purchase_8');
			expect(updatedCount).toBe(2);

			// 更新されていることを確認
			const journal1 = await db.journals.get('journal-1');
			const journal2 = await db.journals.get('journal-2');

			expect(journal1?.lines[0].taxCategory).toBe('purchase_8');
			expect(journal1?.lines[1].taxCategory).toBe('na'); // 1002は変更されない

			expect(journal2?.lines[0].taxCategory).toBe('purchase_8');
			expect(journal2?.lines[1].taxCategory).toBe('na'); // 1002は変更されない
		});

		it('同じ消費税区分の場合は更新しない', async () => {
			await db.journals.add({
				id: 'journal-1',
				date: '2024-01-15',
				lines: [
					{ id: '1', type: 'debit', accountCode: '5006', amount: 1000, taxCategory: 'purchase_10' },
					{ id: '2', type: 'credit', accountCode: '1002', amount: 1000, taxCategory: 'na' }
				],
				vendor: 'テスト',
				description: 'テスト',
				evidenceStatus: 'none',
				attachments: [],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			});

			const updatedCount = await updateTaxCategoryByAccountCode('5006', 'purchase_10');
			expect(updatedCount).toBe(0);
		});
	});
});

describe('仕訳管理', () => {
	beforeEach(async () => {
		await clearAllTables();
		await initializeDatabase();
	});

	afterEach(async () => {
		await clearAllTables();
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

		it('勘定科目が未選択の行があると無効', () => {
			const result = validateJournal({
				lines: [
					{ id: '1', type: 'debit', accountCode: '5006', amount: 1000 },
					{ id: '2', type: 'credit', accountCode: '', amount: 1000 }
				]
			});

			expect(result.isValid).toBe(false);
			expect(result.hasEmptyAccounts).toBe(true);
			expect(result.debitTotal).toBe(1000);
			expect(result.creditTotal).toBe(1000);
		});

		it('すべての勘定科目が選択済みなら hasEmptyAccounts は false', () => {
			const result = validateJournal({
				lines: [
					{ id: '1', type: 'debit', accountCode: '5006', amount: 1000 },
					{ id: '2', type: 'credit', accountCode: '1002', amount: 1000 }
				]
			});

			expect(result.hasEmptyAccounts).toBe(false);
		});
	});
});

describe('取引先管理', () => {
	beforeEach(async () => {
		await clearAllTables();
	});

	afterEach(async () => {
		await clearAllTables();
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
			const name = generateAttachmentName(
				'2024-01-15',
				'receipt',
				'コーヒー代',
				500,
				'スターバックス'
			);

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

		it('仕訳を含む有効なデータを検証できる', () => {
			const validData = {
				version: '1.0.0',
				exportedAt: '2024-01-15T00:00:00.000Z',
				fiscalYear: 2024,
				journals: [
					{
						id: 'test-id',
						date: '2024-01-15',
						lines: [],
						vendor: 'テスト',
						description: 'テスト仕訳',
						evidenceStatus: 'none',
						attachments: [],
						createdAt: '2024-01-15T00:00:00.000Z',
						updatedAt: '2024-01-15T00:00:00.000Z'
					}
				],
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

		it('仕訳にcreatedAt/updatedAtがない場合は無効', () => {
			// createdAtがない
			expect(
				validateExportData({
					version: '1.0.0',
					exportedAt: '2024-01-15T00:00:00.000Z',
					fiscalYear: 2024,
					journals: [
						{
							id: 'test-id',
							date: '2024-01-15',
							lines: [],
							updatedAt: '2024-01-15T00:00:00.000Z'
							// createdAtがない
						}
					],
					accounts: [],
					vendors: []
				})
			).toBe(false);

			// updatedAtがない
			expect(
				validateExportData({
					version: '1.0.0',
					exportedAt: '2024-01-15T00:00:00.000Z',
					fiscalYear: 2024,
					journals: [
						{
							id: 'test-id',
							date: '2024-01-15',
							lines: [],
							createdAt: '2024-01-15T00:00:00.000Z'
							// updatedAtがない
						}
					],
					accounts: [],
					vendors: []
				})
			).toBe(false);
		});

		it('仕訳にid/date/linesがない場合は無効', () => {
			// idがない
			expect(
				validateExportData({
					version: '1.0.0',
					exportedAt: '2024-01-15T00:00:00.000Z',
					fiscalYear: 2024,
					journals: [
						{
							date: '2024-01-15',
							lines: [],
							createdAt: '2024-01-15T00:00:00.000Z',
							updatedAt: '2024-01-15T00:00:00.000Z'
						}
					],
					accounts: [],
					vendors: []
				})
			).toBe(false);

			// dateがない
			expect(
				validateExportData({
					version: '1.0.0',
					exportedAt: '2024-01-15T00:00:00.000Z',
					fiscalYear: 2024,
					journals: [
						{
							id: 'test-id',
							lines: [],
							createdAt: '2024-01-15T00:00:00.000Z',
							updatedAt: '2024-01-15T00:00:00.000Z'
						}
					],
					accounts: [],
					vendors: []
				})
			).toBe(false);

			// linesがない
			expect(
				validateExportData({
					version: '1.0.0',
					exportedAt: '2024-01-15T00:00:00.000Z',
					fiscalYear: 2024,
					journals: [
						{
							id: 'test-id',
							date: '2024-01-15',
							createdAt: '2024-01-15T00:00:00.000Z',
							updatedAt: '2024-01-15T00:00:00.000Z'
						}
					],
					accounts: [],
					vendors: []
				})
			).toBe(false);
		});
	});

	describe('deleteYearData', () => {
		beforeEach(async () => {
			await clearAllTables();
			await initializeDatabase();
		});

		afterEach(async () => {
			await clearAllTables();
		});

		it('指定した年度の仕訳を削除できる', async () => {
			// 2024年の仕訳を追加
			await addJournal({
				date: '2024-03-15',
				lines: [
					{ id: '1', type: 'debit', accountCode: '5006', amount: 1000 },
					{ id: '2', type: 'credit', accountCode: '1002', amount: 1000 }
				],
				vendor: 'A社',
				description: '2024年仕訳1',
				evidenceStatus: 'none',
				attachments: []
			});

			await addJournal({
				date: '2024-06-20',
				lines: [
					{ id: '3', type: 'debit', accountCode: '5006', amount: 2000 },
					{ id: '4', type: 'credit', accountCode: '1002', amount: 2000 }
				],
				vendor: 'B社',
				description: '2024年仕訳2',
				evidenceStatus: 'none',
				attachments: []
			});

			// 2025年の仕訳を追加
			await addJournal({
				date: '2025-01-10',
				lines: [
					{ id: '5', type: 'debit', accountCode: '5006', amount: 3000 },
					{ id: '6', type: 'credit', accountCode: '1002', amount: 3000 }
				],
				vendor: 'C社',
				description: '2025年仕訳',
				evidenceStatus: 'none',
				attachments: []
			});

			// 2024年のデータを削除
			const result = await deleteYearData(2024);

			expect(result.journalCount).toBe(2);
			expect(result.attachmentCount).toBe(0);

			// 2024年の仕訳がなくなっていることを確認
			const journals2024 = await getJournalsByYear(2024);
			expect(journals2024).toHaveLength(0);

			// 2025年の仕訳は残っていることを確認
			const journals2025 = await getJournalsByYear(2025);
			expect(journals2025).toHaveLength(1);
			expect(journals2025[0].description).toBe('2025年仕訳');
		});

		it('仕訳がない年度は0件で返る', async () => {
			const result = await deleteYearData(2020);

			expect(result.journalCount).toBe(0);
			expect(result.attachmentCount).toBe(0);
		});
	});

	// テスト用のデフォルト設定
	const testSettings = {
		fiscalYearStart: 1,
		defaultCurrency: 'JPY',
		storageMode: 'indexeddb' as const,
		autoPurgeBlobAfterExport: true,
		blobRetentionDays: 30
	};

	describe('getImportPreview', () => {
		beforeEach(async () => {
			await clearAllTables();
			await initializeDatabase();
		});

		afterEach(async () => {
			await clearAllTables();
		});

		it('インポートプレビューを取得できる', async () => {
			const exportData = {
				version: '1.0.0',
				exportedAt: '2024-01-15T00:00:00.000Z',
				fiscalYear: 2024,
				journals: [
					{
						id: 'journal-1',
						date: '2024-01-15',
						lines: [
							{ id: '1', type: 'debit' as const, accountCode: '5006', amount: 1000 },
							{ id: '2', type: 'credit' as const, accountCode: '1002', amount: 1000 }
						],
						vendor: '新規取引先',
						description: 'テスト仕訳',
						evidenceStatus: 'none' as const,
						attachments: [],
						createdAt: '2024-01-15T00:00:00.000Z',
						updatedAt: '2024-01-15T00:00:00.000Z'
					}
				],
				accounts: [
					{
						code: '5200',
						name: 'カスタム科目',
						type: 'expense' as const,
						isSystem: false,
						createdAt: '2024-01-15T00:00:00.000Z'
					}
				],
				vendors: [{ id: 'v1', name: '新規取引先', createdAt: '2024-01-15T00:00:00.000Z' }],
				settings: testSettings
			};

			const preview = await getImportPreview(exportData);

			expect(preview.fiscalYear).toBe(2024);
			expect(preview.journalCount).toBe(1);
			expect(preview.newJournalCount).toBe(1);
			expect(preview.accountCount).toBe(1);
			expect(preview.newAccountCount).toBe(1);
			expect(preview.vendorCount).toBe(1);
			expect(preview.newVendorCount).toBe(1);
		});

		it('既存データがある場合は新規カウントが正しい', async () => {
			// 既存の仕訳を追加
			await addJournal({
				date: '2024-02-01',
				lines: [
					{ id: '1', type: 'debit', accountCode: '5006', amount: 500 },
					{ id: '2', type: 'credit', accountCode: '1002', amount: 500 }
				],
				vendor: '既存取引先',
				description: '既存仕訳',
				evidenceStatus: 'none',
				attachments: []
			});

			const exportData = {
				version: '1.0.0',
				exportedAt: '2024-01-15T00:00:00.000Z',
				fiscalYear: 2024,
				journals: [
					{
						id: 'new-journal',
						date: '2024-01-15',
						lines: [
							{ id: '1', type: 'debit' as const, accountCode: '5006', amount: 1000 },
							{ id: '2', type: 'credit' as const, accountCode: '1002', amount: 1000 }
						],
						vendor: '既存取引先',
						description: 'インポート仕訳',
						evidenceStatus: 'none' as const,
						attachments: [],
						createdAt: '2024-01-15T00:00:00.000Z',
						updatedAt: '2024-01-15T00:00:00.000Z'
					}
				],
				accounts: [],
				vendors: [{ id: 'v1', name: '既存取引先', createdAt: '2024-01-15T00:00:00.000Z' }],
				settings: testSettings
			};

			const preview = await getImportPreview(exportData);

			expect(preview.journalCount).toBe(1);
			expect(preview.newJournalCount).toBe(1);
			expect(preview.vendorCount).toBe(1);
			expect(preview.newVendorCount).toBe(0); // 既存取引先なので0
		});
	});

	describe('importData', () => {
		beforeEach(async () => {
			await clearAllTables();
			await initializeDatabase();
		});

		afterEach(async () => {
			await clearAllTables();
		});

		it('マージモードでインポートできる', async () => {
			// 既存の仕訳を追加
			const existingId = await addJournal({
				date: '2024-02-01',
				lines: [
					{ id: '1', type: 'debit', accountCode: '5006', amount: 500 },
					{ id: '2', type: 'credit', accountCode: '1002', amount: 500 }
				],
				vendor: '既存取引先',
				description: '既存仕訳',
				evidenceStatus: 'none',
				attachments: []
			});

			const exportData = {
				version: '1.0.0',
				exportedAt: '2024-01-15T00:00:00.000Z',
				fiscalYear: 2024,
				journals: [
					{
						id: 'new-journal',
						date: '2024-01-15',
						lines: [
							{ id: '1', type: 'debit' as const, accountCode: '5006', amount: 1000 },
							{ id: '2', type: 'credit' as const, accountCode: '1002', amount: 1000 }
						],
						vendor: '新規取引先',
						description: 'インポート仕訳',
						evidenceStatus: 'none' as const,
						attachments: [],
						createdAt: '2024-01-15T00:00:00.000Z',
						updatedAt: '2024-01-15T00:00:00.000Z'
					}
				],
				accounts: [],
				vendors: [],
				settings: testSettings
			};

			const result = await importData(exportData, 'merge');

			expect(result.success).toBe(true);
			expect(result.journalsImported).toBe(1);

			// 既存の仕訳が残っていることを確認
			const existingJournal = await getJournalById(existingId);
			expect(existingJournal).toBeDefined();
			expect(existingJournal?.description).toBe('既存仕訳');

			// 新規仕訳がインポートされていることを確認
			const journals = await getJournalsByYear(2024);
			expect(journals).toHaveLength(2);
		});

		it('上書きモードでインポートできる', async () => {
			// 既存の仕訳を追加
			await addJournal({
				date: '2024-02-01',
				lines: [
					{ id: '1', type: 'debit', accountCode: '5006', amount: 500 },
					{ id: '2', type: 'credit', accountCode: '1002', amount: 500 }
				],
				vendor: '既存取引先',
				description: '既存仕訳',
				evidenceStatus: 'none',
				attachments: []
			});

			const exportData = {
				version: '1.0.0',
				exportedAt: '2024-01-15T00:00:00.000Z',
				fiscalYear: 2024,
				journals: [
					{
						id: 'new-journal',
						date: '2024-01-15',
						lines: [
							{ id: '1', type: 'debit' as const, accountCode: '5006', amount: 1000 },
							{ id: '2', type: 'credit' as const, accountCode: '1002', amount: 1000 }
						],
						vendor: '新規取引先',
						description: 'インポート仕訳',
						evidenceStatus: 'none' as const,
						attachments: [],
						createdAt: '2024-01-15T00:00:00.000Z',
						updatedAt: '2024-01-15T00:00:00.000Z'
					}
				],
				accounts: [],
				vendors: [],
				settings: testSettings
			};

			const result = await importData(exportData, 'overwrite');

			expect(result.success).toBe(true);
			expect(result.journalsImported).toBe(1);

			// 既存の仕訳が削除されていることを確認
			const journals = await getJournalsByYear(2024);
			expect(journals).toHaveLength(1);
			expect(journals[0].description).toBe('インポート仕訳');
		});

		it('勘定科目と取引先もインポートされる', async () => {
			const exportData = {
				version: '1.0.0',
				exportedAt: '2024-01-15T00:00:00.000Z',
				fiscalYear: 2024,
				journals: [],
				accounts: [
					{
						code: '5200',
						name: 'カスタム科目',
						type: 'expense' as const,
						isSystem: false,
						createdAt: '2024-01-15T00:00:00.000Z'
					}
				],
				vendors: [{ id: 'v1', name: '新規取引先', createdAt: '2024-01-15T00:00:00.000Z' }],
				settings: testSettings
			};

			const result = await importData(exportData, 'merge');

			expect(result.success).toBe(true);
			expect(result.accountsImported).toBe(1);
			expect(result.vendorsImported).toBe(1);

			// 勘定科目がインポートされていることを確認
			const account = await db.accounts.get('5200');
			expect(account).toBeDefined();
			expect(account?.name).toBe('カスタム科目');

			// 取引先がインポートされていることを確認
			const vendors = await getAllVendors();
			const found = vendors.find((v) => v.name === '新規取引先');
			expect(found).toBeDefined();
		});
	});
});
