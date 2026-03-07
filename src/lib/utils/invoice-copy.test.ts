import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { copyInvoiceForNew } from './invoice-copy';
import type { Invoice } from '$lib/types/invoice';

describe('copyInvoiceForNew', () => {
	const originalInvoice: Invoice = {
		id: 'original-invoice-id',
		invoiceNumber: 'INV-2025-0003',
		issueDate: '2025-01-15',
		dueDate: '2025-02-28',
		vendorId: 'vendor-123',
		items: [
			{
				id: 'item-1',
				date: '1月分',
				description: 'システム開発',
				quantity: 1,
				unitPrice: 500000,
				amount: 500000,
				taxRate: 10
			},
			{
				id: 'item-2',
				date: '1月分',
				description: '交通費',
				quantity: 3,
				unitPrice: 1200,
				amount: 3600,
				taxRate: 10
			}
		],
		subtotal: 503600,
		taxAmount: 50360,
		total: 553960,
		taxBreakdown: {
			taxable10: 503600,
			tax10: 50360,
			taxable8: 0,
			tax8: 0
		},
		status: 'issued',
		note: '振込手数料はご負担ください。',
		journalId: 'journal-abc',
		createdAt: '2025-01-10T10:00:00Z',
		updatedAt: '2025-01-15T14:00:00Z'
	};

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2025-03-10T12:00:00Z'));

		vi.stubGlobal('crypto', {
			randomUUID: vi.fn().mockReturnValueOnce('new-item-1').mockReturnValueOnce('new-item-2')
		});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('発行日を今日に変更する', () => {
		const copied = copyInvoiceForNew(originalInvoice);
		expect(copied.issueDate).toBe('2025-03-10');
	});

	it('支払期限を翌月末に設定する', () => {
		const copied = copyInvoiceForNew(originalInvoice);
		expect(copied.dueDate).toBe('2025-04-30');
	});

	it('請求書番号を空にする（保存時に自動採番）', () => {
		const copied = copyInvoiceForNew(originalInvoice);
		expect(copied.invoiceNumber).toBe('');
	});

	it('ステータスをdraftにリセットする', () => {
		const copied = copyInvoiceForNew(originalInvoice);
		expect(copied.status).toBe('draft');
	});

	it('仕訳紐付けをクリアする', () => {
		const copied = copyInvoiceForNew(originalInvoice);
		expect(copied.journalId).toBeUndefined();
	});

	it('取引先IDを引き継ぐ', () => {
		const copied = copyInvoiceForNew(originalInvoice);
		expect(copied.vendorId).toBe('vendor-123');
	});

	it('明細行をコピーする（新しいIDで）', () => {
		const copied = copyInvoiceForNew(originalInvoice);
		expect(copied.items).toHaveLength(2);

		// 内容は同じ
		expect(copied.items[0].description).toBe('システム開発');
		expect(copied.items[0].quantity).toBe(1);
		expect(copied.items[0].unitPrice).toBe(500000);
		expect(copied.items[0].amount).toBe(500000);
		expect(copied.items[0].taxRate).toBe(10);

		expect(copied.items[1].description).toBe('交通費');
		expect(copied.items[1].quantity).toBe(3);
		expect(copied.items[1].unitPrice).toBe(1200);

		// IDは新しく生成される
		expect(copied.items[0].id).toBe('new-item-1');
		expect(copied.items[1].id).toBe('new-item-2');
	});

	it('金額情報を引き継ぐ', () => {
		const copied = copyInvoiceForNew(originalInvoice);
		expect(copied.subtotal).toBe(503600);
		expect(copied.taxAmount).toBe(50360);
		expect(copied.total).toBe(553960);
	});

	it('消費税内訳を引き継ぐ', () => {
		const copied = copyInvoiceForNew(originalInvoice);
		expect(copied.taxBreakdown).toEqual({
			taxable10: 503600,
			tax10: 50360,
			taxable8: 0,
			tax8: 0
		});
	});

	it('備考を引き継ぐ', () => {
		const copied = copyInvoiceForNew(originalInvoice);
		expect(copied.note).toBe('振込手数料はご負担ください。');
	});

	it('元の請求書を変更しない', () => {
		const originalStatus = originalInvoice.status;
		const originalJournalId = originalInvoice.journalId;
		const originalItemId = originalInvoice.items[0].id;

		copyInvoiceForNew(originalInvoice);

		expect(originalInvoice.status).toBe(originalStatus);
		expect(originalInvoice.journalId).toBe(originalJournalId);
		expect(originalInvoice.items[0].id).toBe(originalItemId);
	});

	it('IDとタイムスタンプは含まれない', () => {
		const copied = copyInvoiceForNew(originalInvoice);

		expect('id' in copied).toBe(false);
		expect('createdAt' in copied).toBe(false);
		expect('updatedAt' in copied).toBe(false);
	});

	it('taxBreakdownが元のオブジェクトと別の参照である', () => {
		const copied = copyInvoiceForNew(originalInvoice);
		expect(copied.taxBreakdown).not.toBe(originalInvoice.taxBreakdown);
	});
});
