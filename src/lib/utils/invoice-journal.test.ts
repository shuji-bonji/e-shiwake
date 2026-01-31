import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateSalesJournal, generateDepositJournal } from './invoice-journal';
import type { Invoice } from '$lib/types/invoice';
import type { Vendor } from '$lib/types';

describe('generateSalesJournal', () => {
	const mockVendor: Vendor = {
		id: 'vendor-1',
		name: 'テスト株式会社',
		createdAt: '2026-01-01T00:00:00Z',
		updatedAt: '2026-01-01T00:00:00Z'
	};

	beforeEach(() => {
		vi.stubGlobal('crypto', {
			randomUUID: vi
				.fn()
				.mockReturnValueOnce('line-1')
				.mockReturnValueOnce('line-2')
				.mockReturnValueOnce('line-3')
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('10%税率のみの請求書から売掛金仕訳を生成する', () => {
		const invoice: Invoice = {
			id: 'inv-1',
			invoiceNumber: 'INV-2026-0001',
			issueDate: '2026-01-15',
			dueDate: '2026-01-31',
			vendorId: 'vendor-1',
			items: [],
			subtotal: 100000,
			taxAmount: 10000,
			total: 110000,
			taxBreakdown: {
				taxable10: 100000,
				tax10: 10000,
				taxable8: 0,
				tax8: 0
			},
			status: 'issued',
			createdAt: '2026-01-15T00:00:00Z',
			updatedAt: '2026-01-15T00:00:00Z'
		};

		const journal = generateSalesJournal(invoice, mockVendor);

		// 借方: 売掛金
		expect(journal.lines[0].type).toBe('debit');
		expect(journal.lines[0].accountCode).toBe('1005');
		expect(journal.lines[0].amount).toBe(110000);
		expect(journal.lines[0].taxCategory).toBe('na');

		// 貸方: 売上高（10%）
		expect(journal.lines[1].type).toBe('credit');
		expect(journal.lines[1].accountCode).toBe('4001');
		expect(journal.lines[1].amount).toBe(110000);
		expect(journal.lines[1].taxCategory).toBe('sales_10');

		// 共通項目
		expect(journal.date).toBe('2026-01-15');
		expect(journal.vendor).toBe('テスト株式会社');
		expect(journal.description).toBe('請求書 INV-2026-0001');
		expect(journal.evidenceStatus).toBe('digital');
		expect(journal.attachments).toEqual([]);
	});

	it('8%税率のみの請求書から売掛金仕訳を生成する', () => {
		const invoice: Invoice = {
			id: 'inv-2',
			invoiceNumber: 'INV-2026-0002',
			issueDate: '2026-01-20',
			dueDate: '2026-01-31',
			vendorId: 'vendor-1',
			items: [],
			subtotal: 50000,
			taxAmount: 4000,
			total: 54000,
			taxBreakdown: {
				taxable10: 0,
				tax10: 0,
				taxable8: 50000,
				tax8: 4000
			},
			status: 'issued',
			createdAt: '2026-01-20T00:00:00Z',
			updatedAt: '2026-01-20T00:00:00Z'
		};

		const journal = generateSalesJournal(invoice, mockVendor);

		expect(journal.lines).toHaveLength(2);

		// 借方: 売掛金
		expect(journal.lines[0].type).toBe('debit');
		expect(journal.lines[0].amount).toBe(54000);

		// 貸方: 売上高（8%）
		expect(journal.lines[1].type).toBe('credit');
		expect(journal.lines[1].accountCode).toBe('4001');
		expect(journal.lines[1].amount).toBe(54000);
		expect(journal.lines[1].taxCategory).toBe('sales_8');
	});

	it('10%と8%混合の請求書から売掛金仕訳を生成する', () => {
		const invoice: Invoice = {
			id: 'inv-3',
			invoiceNumber: 'INV-2026-0003',
			issueDate: '2026-01-25',
			dueDate: '2026-02-28',
			vendorId: 'vendor-1',
			items: [],
			subtotal: 150000,
			taxAmount: 14000,
			total: 164000,
			taxBreakdown: {
				taxable10: 100000,
				tax10: 10000,
				taxable8: 50000,
				tax8: 4000
			},
			status: 'issued',
			createdAt: '2026-01-25T00:00:00Z',
			updatedAt: '2026-01-25T00:00:00Z'
		};

		const journal = generateSalesJournal(invoice, mockVendor);

		expect(journal.lines).toHaveLength(3);

		// 借方: 売掛金（税込合計）
		expect(journal.lines[0].type).toBe('debit');
		expect(journal.lines[0].accountCode).toBe('1005');
		expect(journal.lines[0].amount).toBe(164000);

		// 貸方: 売上高（10%）= 100000 + 10000
		expect(journal.lines[1].type).toBe('credit');
		expect(journal.lines[1].accountCode).toBe('4001');
		expect(journal.lines[1].amount).toBe(110000);
		expect(journal.lines[1].taxCategory).toBe('sales_10');

		// 貸方: 売上高（8%）= 50000 + 4000
		expect(journal.lines[2].type).toBe('credit');
		expect(journal.lines[2].accountCode).toBe('4001');
		expect(journal.lines[2].amount).toBe(54000);
		expect(journal.lines[2].taxCategory).toBe('sales_8');
	});

	it('IDとタイムスタンプは含まれない', () => {
		const invoice: Invoice = {
			id: 'inv-1',
			invoiceNumber: 'INV-2026-0001',
			issueDate: '2026-01-15',
			dueDate: '2026-01-31',
			vendorId: 'vendor-1',
			items: [],
			subtotal: 100000,
			taxAmount: 10000,
			total: 110000,
			taxBreakdown: {
				taxable10: 100000,
				tax10: 10000,
				taxable8: 0,
				tax8: 0
			},
			status: 'issued',
			createdAt: '2026-01-15T00:00:00Z',
			updatedAt: '2026-01-15T00:00:00Z'
		};

		const journal = generateSalesJournal(invoice, mockVendor);

		expect('id' in journal).toBe(false);
		expect('createdAt' in journal).toBe(false);
		expect('updatedAt' in journal).toBe(false);
	});
});

describe('generateDepositJournal', () => {
	const mockVendor: Vendor = {
		id: 'vendor-1',
		name: 'テスト株式会社',
		createdAt: '2026-01-01T00:00:00Z',
		updatedAt: '2026-01-01T00:00:00Z'
	};

	const mockInvoice: Invoice = {
		id: 'inv-1',
		invoiceNumber: 'INV-2026-0001',
		issueDate: '2026-01-15',
		dueDate: '2026-01-31',
		vendorId: 'vendor-1',
		items: [],
		subtotal: 100000,
		taxAmount: 10000,
		total: 110000,
		taxBreakdown: {
			taxable10: 100000,
			tax10: 10000,
			taxable8: 0,
			tax8: 0
		},
		status: 'paid',
		createdAt: '2026-01-15T00:00:00Z',
		updatedAt: '2026-01-15T00:00:00Z'
	};

	beforeEach(() => {
		vi.stubGlobal('crypto', {
			randomUUID: vi.fn().mockReturnValueOnce('line-1').mockReturnValueOnce('line-2')
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('入金仕訳を生成する（普通預金デフォルト）', () => {
		const journal = generateDepositJournal(mockInvoice, mockVendor, '2026-02-15');

		expect(journal.lines).toHaveLength(2);

		// 借方: 普通預金
		expect(journal.lines[0].type).toBe('debit');
		expect(journal.lines[0].accountCode).toBe('1003'); // 普通預金
		expect(journal.lines[0].amount).toBe(110000);
		expect(journal.lines[0].taxCategory).toBe('na');

		// 貸方: 売掛金
		expect(journal.lines[1].type).toBe('credit');
		expect(journal.lines[1].accountCode).toBe('1005'); // 売掛金
		expect(journal.lines[1].amount).toBe(110000);
		expect(journal.lines[1].taxCategory).toBe('na');

		// 共通項目
		expect(journal.date).toBe('2026-02-15');
		expect(journal.vendor).toBe('テスト株式会社');
		expect(journal.description).toBe('入金 請求書 INV-2026-0001');
		expect(journal.evidenceStatus).toBe('none');
		expect(journal.attachments).toEqual([]);
	});

	it('入金先の勘定科目を指定できる', () => {
		const journal = generateDepositJournal(mockInvoice, mockVendor, '2026-02-15', '1001'); // 現金

		expect(journal.lines[0].accountCode).toBe('1001');
	});

	it('入金日を正しく設定する', () => {
		const journal = generateDepositJournal(mockInvoice, mockVendor, '2026-03-01');

		expect(journal.date).toBe('2026-03-01');
	});

	it('IDとタイムスタンプは含まれない', () => {
		const journal = generateDepositJournal(mockInvoice, mockVendor, '2026-02-15');

		expect('id' in journal).toBe(false);
		expect('createdAt' in journal).toBe(false);
		expect('updatedAt' in journal).toBe(false);
	});
});
