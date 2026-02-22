/**
 * 勘定科目管理のテスト
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	db,
	initializeDatabase,
	getAccountsByType,
	addAccount,
	updateAccount,
	deleteAccount,
	isAccountInUse,
	generateNextCode,
	isSystemAccount,
	countJournalLinesByAccountCode,
	updateTaxCategoryByAccountCode
} from './index';
import { clearAllTables } from './test-helpers';

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
