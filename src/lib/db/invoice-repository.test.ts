/**
 * 請求書管理のテスト
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initializeDatabase } from './index';
import { clearAllTables } from './test-helpers';

// テスト用の請求書データを作成するヘルパー
function createTestInvoiceInput(overrides = {}) {
	return {
		invoiceNumber: 'INV-2026-0001',
		issueDate: '2026-01-15',
		dueDate: '2026-01-31',
		vendorId: 'vendor-1',
		items: [
			{
				id: 'item-1',
				date: '1月分',
				description: 'コンサルティング',
				quantity: 1,
				unitPrice: 100000,
				amount: 100000,
				taxRate: 10 as const
			}
		],
		subtotal: 100000,
		taxAmount: 10000,
		total: 110000,
		taxBreakdown: {
			taxable10: 100000,
			tax10: 10000,
			taxable8: 0,
			tax8: 0
		},
		status: 'draft' as const,
		...overrides
	};
}

describe('請求書管理', () => {
	beforeEach(async () => {
		await clearAllTables();
		await initializeDatabase();
	});

	afterEach(async () => {
		await clearAllTables();
	});

	describe('addInvoice', () => {
		it('請求書を追加できる', async () => {
			const { addInvoice, getInvoiceById } = await import('./index');

			const invoiceInput = createTestInvoiceInput();
			const id = await addInvoice(invoiceInput);

			expect(id).toBeDefined();

			const invoice = await getInvoiceById(id);
			expect(invoice).toBeDefined();
			expect(invoice?.invoiceNumber).toBe('INV-2026-0001');
			expect(invoice?.total).toBe(110000);
			expect(invoice?.createdAt).toBeDefined();
			expect(invoice?.updatedAt).toBeDefined();
		});
	});

	describe('updateInvoice', () => {
		it('請求書を更新できる', async () => {
			const { addInvoice, updateInvoice, getInvoiceById } = await import('./index');

			const id = await addInvoice(createTestInvoiceInput());

			await updateInvoice(id, { status: 'issued' });

			const updated = await getInvoiceById(id);
			expect(updated?.status).toBe('issued');
		});

		it('明細行を更新できる', async () => {
			const { addInvoice, updateInvoice, getInvoiceById } = await import('./index');

			const id = await addInvoice(createTestInvoiceInput());

			await updateInvoice(id, {
				items: [
					{
						id: 'item-1',
						date: '2月分',
						description: '更新後のサービス',
						quantity: 2,
						unitPrice: 50000,
						amount: 100000,
						taxRate: 10
					}
				]
			});

			const updated = await getInvoiceById(id);
			expect(updated?.items[0].description).toBe('更新後のサービス');
			expect(updated?.items[0].quantity).toBe(2);
		});
	});

	describe('deleteInvoice', () => {
		it('請求書を削除できる', async () => {
			const { addInvoice, deleteInvoice, getInvoiceById } = await import('./index');

			const id = await addInvoice(createTestInvoiceInput());
			await deleteInvoice(id);

			const deleted = await getInvoiceById(id);
			expect(deleted).toBeUndefined();
		});
	});

	describe('getInvoicesByYear', () => {
		it('年度別に請求書を取得できる', async () => {
			const { addInvoice, getInvoicesByYear } = await import('./index');

			// 2026年の請求書
			await addInvoice(createTestInvoiceInput({ issueDate: '2026-03-15' }));
			await addInvoice(
				createTestInvoiceInput({ invoiceNumber: 'INV-2026-0002', issueDate: '2026-06-20' })
			);

			// 2025年の請求書
			await addInvoice(
				createTestInvoiceInput({ invoiceNumber: 'INV-2025-0001', issueDate: '2025-12-01' })
			);

			const invoices2026 = await getInvoicesByYear(2026);
			expect(invoices2026).toHaveLength(2);

			const invoices2025 = await getInvoicesByYear(2025);
			expect(invoices2025).toHaveLength(1);
		});

		it('日付降順でソートされる', async () => {
			const { addInvoice, getInvoicesByYear } = await import('./index');

			await addInvoice(
				createTestInvoiceInput({ invoiceNumber: 'INV-2026-0001', issueDate: '2026-01-15' })
			);
			await addInvoice(
				createTestInvoiceInput({ invoiceNumber: 'INV-2026-0002', issueDate: '2026-06-20' })
			);
			await addInvoice(
				createTestInvoiceInput({ invoiceNumber: 'INV-2026-0003', issueDate: '2026-03-10' })
			);

			const invoices = await getInvoicesByYear(2026);
			expect(invoices[0].issueDate).toBe('2026-06-20');
			expect(invoices[1].issueDate).toBe('2026-03-10');
			expect(invoices[2].issueDate).toBe('2026-01-15');
		});
	});

	describe('getInvoicesByStatus', () => {
		it('ステータス別に請求書を取得できる', async () => {
			const { addInvoice, getInvoicesByStatus } = await import('./index');

			await addInvoice(createTestInvoiceInput({ status: 'draft' }));
			await addInvoice(
				createTestInvoiceInput({ invoiceNumber: 'INV-2026-0002', status: 'issued' })
			);
			await addInvoice(
				createTestInvoiceInput({ invoiceNumber: 'INV-2026-0003', status: 'issued' })
			);
			await addInvoice(createTestInvoiceInput({ invoiceNumber: 'INV-2026-0004', status: 'paid' }));

			const drafts = await getInvoicesByStatus('draft');
			expect(drafts).toHaveLength(1);

			const issued = await getInvoicesByStatus('issued');
			expect(issued).toHaveLength(2);

			const paid = await getInvoicesByStatus('paid');
			expect(paid).toHaveLength(1);
		});
	});

	describe('getInvoicesByVendor', () => {
		it('取引先別に請求書を取得できる', async () => {
			const { addInvoice, getInvoicesByVendor } = await import('./index');

			await addInvoice(createTestInvoiceInput({ vendorId: 'vendor-1' }));
			await addInvoice(
				createTestInvoiceInput({ invoiceNumber: 'INV-2026-0002', vendorId: 'vendor-1' })
			);
			await addInvoice(
				createTestInvoiceInput({ invoiceNumber: 'INV-2026-0003', vendorId: 'vendor-2' })
			);

			const vendor1Invoices = await getInvoicesByVendor('vendor-1');
			expect(vendor1Invoices).toHaveLength(2);

			const vendor2Invoices = await getInvoicesByVendor('vendor-2');
			expect(vendor2Invoices).toHaveLength(1);
		});
	});

	describe('generateNextInvoiceNumber', () => {
		it('最初の請求書番号を生成できる', async () => {
			const { generateNextInvoiceNumber } = await import('./index');

			const number = await generateNextInvoiceNumber(2026);
			expect(number).toBe('INV-2026-0001');
		});

		it('連番で請求書番号を生成できる', async () => {
			const { addInvoice, generateNextInvoiceNumber } = await import('./index');

			await addInvoice(
				createTestInvoiceInput({ invoiceNumber: 'INV-2026-0001', issueDate: '2026-01-15' })
			);
			await addInvoice(
				createTestInvoiceInput({ invoiceNumber: 'INV-2026-0002', issueDate: '2026-02-15' })
			);

			const number = await generateNextInvoiceNumber(2026);
			expect(number).toBe('INV-2026-0003');
		});

		it('年度が異なる場合は別カウント', async () => {
			const { addInvoice, generateNextInvoiceNumber } = await import('./index');

			await addInvoice(
				createTestInvoiceInput({ invoiceNumber: 'INV-2025-0005', issueDate: '2025-12-15' })
			);

			const number2026 = await generateNextInvoiceNumber(2026);
			expect(number2026).toBe('INV-2026-0001');
		});

		it('年度を省略すると現在年度を使用', async () => {
			const { generateNextInvoiceNumber } = await import('./index');

			const number = await generateNextInvoiceNumber();
			const currentYear = new Date().getFullYear();
			expect(number).toBe(`INV-${currentYear}-0001`);
		});
	});
});
