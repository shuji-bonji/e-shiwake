/**
 * 取引先管理のテスト（基本 + 拡張機能）
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db, initializeDatabase, searchVendors, addInvoice, getVendorById } from './index';
import { clearAllTables } from './test-helpers';

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

describe('取引先管理（拡張）', () => {
	beforeEach(async () => {
		await clearAllTables();
		await initializeDatabase();
	});

	afterEach(async () => {
		await clearAllTables();
	});

	describe('addVendorWithDetails', () => {
		it('取引先を詳細情報付きで追加できる', async () => {
			const { addVendorWithDetails } = await import('./index');

			const id = await addVendorWithDetails({
				name: 'テスト株式会社',
				address: '東京都渋谷区1-2-3',
				contactName: '田中太郎',
				email: 'tanaka@test.co.jp',
				phone: '03-1234-5678',
				paymentTerms: '月末締め翌月末払い'
			});

			const vendor = await getVendorById(id);
			expect(vendor).toBeDefined();
			expect(vendor?.name).toBe('テスト株式会社');
			expect(vendor?.address).toBe('東京都渋谷区1-2-3');
			expect(vendor?.contactName).toBe('田中太郎');
			expect(vendor?.email).toBe('tanaka@test.co.jp');
			expect(vendor?.phone).toBe('03-1234-5678');
			expect(vendor?.paymentTerms).toBe('月末締め翌月末払い');
		});

		it('createdAtとupdatedAtが設定される', async () => {
			const { addVendorWithDetails } = await import('./index');

			const id = await addVendorWithDetails({
				name: 'テスト株式会社'
			});

			const vendor = await getVendorById(id);
			expect(vendor?.createdAt).toBeDefined();
			expect(vendor?.updatedAt).toBeDefined();
		});
	});

	describe('updateVendor', () => {
		it('取引先情報を更新できる', async () => {
			const { addVendorWithDetails, updateVendor } = await import('./index');

			const id = await addVendorWithDetails({
				name: '元の名前',
				address: '東京都'
			});

			await updateVendor(id, {
				name: '更新後の名前',
				address: '大阪府'
			});

			const updated = await getVendorById(id);
			expect(updated?.name).toBe('更新後の名前');
			expect(updated?.address).toBe('大阪府');
		});

		it('updatedAtが更新される', async () => {
			const { addVendorWithDetails, updateVendor } = await import('./index');

			const id = await addVendorWithDetails({ name: 'テスト' });
			const original = await getVendorById(id);
			const originalUpdatedAt = original?.updatedAt;

			// 少し待ってから更新
			await new Promise((resolve) => setTimeout(resolve, 10));
			await updateVendor(id, { name: '更新後' });

			const updated = await getVendorById(id);
			expect(updated?.updatedAt).not.toBe(originalUpdatedAt);
		});
	});

	describe('isVendorInUseByInvoice', () => {
		it('請求書で使用中の取引先を判定できる', async () => {
			const { addVendorWithDetails, isVendorInUseByInvoice } = await import('./index');

			const vendorId = await addVendorWithDetails({ name: 'テスト取引先' });

			// 請求書で使用
			await addInvoice({
				invoiceNumber: 'INV-001',
				issueDate: '2026-01-15',
				dueDate: '2026-01-31',
				vendorId,
				items: [],
				subtotal: 0,
				taxAmount: 0,
				total: 0,
				taxBreakdown: { taxable10: 0, tax10: 0, taxable8: 0, tax8: 0 },
				status: 'draft'
			});

			const inUse = await isVendorInUseByInvoice(vendorId);
			expect(inUse).toBe(true);
		});

		it('請求書で未使用の取引先を判定できる', async () => {
			const { addVendorWithDetails, isVendorInUseByInvoice } = await import('./index');

			const vendorId = await addVendorWithDetails({ name: '未使用取引先' });

			const inUse = await isVendorInUseByInvoice(vendorId);
			expect(inUse).toBe(false);
		});
	});

	describe('isVendorInUseByJournal', () => {
		it('仕訳で使用中の取引先を判定できる', async () => {
			const { addVendorWithDetails, isVendorInUseByJournal } = await import('./index');

			// 取引先を追加
			const vendorId = await addVendorWithDetails({ name: 'JournalTestCorp' });

			// 仕訳で取引先を使用（取引先名で参照）
			await db.journals.add({
				id: 'test-journal-vendor',
				date: '2026-01-15',
				lines: [
					{ id: '1', type: 'debit', accountCode: '5006', amount: 1000 },
					{ id: '2', type: 'credit', accountCode: '1002', amount: 1000 }
				],
				vendor: 'JournalTestCorp',
				description: 'テスト',
				evidenceStatus: 'none',
				attachments: [],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			});

			const inUse = await isVendorInUseByJournal(vendorId);
			expect(inUse).toBe(true);
		});

		it('仕訳で未使用の取引先を判定できる', async () => {
			const { addVendorWithDetails, isVendorInUseByJournal } = await import('./index');

			const vendorId = await addVendorWithDetails({ name: '未使用取引先' });

			const inUse = await isVendorInUseByJournal(vendorId);
			expect(inUse).toBe(false);
		});
	});

	describe('deleteVendor', () => {
		it('取引先を削除できる', async () => {
			const { addVendorWithDetails, deleteVendor } = await import('./index');

			const id = await addVendorWithDetails({ name: 'テスト取引先' });
			await deleteVendor(id);

			const deleted = await getVendorById(id);
			expect(deleted).toBeUndefined();
		});

		it('請求書で使用中の取引先は削除できない', async () => {
			const { addVendorWithDetails, deleteVendor } = await import('./index');

			const vendorId = await addVendorWithDetails({ name: 'テスト取引先' });

			await addInvoice({
				invoiceNumber: 'INV-001',
				issueDate: '2026-01-15',
				dueDate: '2026-01-31',
				vendorId,
				items: [],
				subtotal: 0,
				taxAmount: 0,
				total: 0,
				taxBreakdown: { taxable10: 0, tax10: 0, taxable8: 0, tax8: 0 },
				status: 'draft'
			});

			await expect(deleteVendor(vendorId)).rejects.toThrow(
				'この取引先は請求書で使用されているため削除できません'
			);
		});

		it('仕訳で使用中の取引先は削除できない', async () => {
			const { deleteVendor } = await import('./index');

			// 仕訳で取引先を使用（取引先名で参照）
			await db.vendors.add({
				id: 'vendor-test',
				name: 'TestCorp',
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			});

			await db.journals.add({
				id: 'test-journal',
				date: '2026-01-15',
				lines: [
					{ id: '1', type: 'debit', accountCode: '5006', amount: 1000 },
					{ id: '2', type: 'credit', accountCode: '1002', amount: 1000 }
				],
				vendor: 'TestCorp',
				description: 'テスト',
				evidenceStatus: 'none',
				attachments: [],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			});

			await expect(deleteVendor('vendor-test')).rejects.toThrow(
				'この取引先は仕訳で使用されているため削除できません'
			);
		});
	});
});
