/**
 * 仕訳管理のテスト
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	initializeDatabase,
	getJournalsByYear,
	getAvailableYears,
	getJournalById,
	addJournal,
	updateJournal,
	deleteJournal,
	createEmptyJournal,
	validateJournal,
	getAllVendors
} from './index';
import { clearAllTables } from './test-helpers';

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
