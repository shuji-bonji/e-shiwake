import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	generateSalesJournal,
	generateDepositJournal,
	getJournalAmount,
	calculateDepositSummary,
	compareSalesJournal,
	buildSalesJournalUpdate
} from './invoice-journal';
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
		expect(journal.description).toBe('売掛金計上 INV-2026-0001');
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
		expect(journal.description).toBe('入金 INV-2026-0001');
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

	it('入金額を指定すると借方・貸方ともその金額になる（分割入金）', () => {
		const journal = generateDepositJournal(mockInvoice, mockVendor, '2026-02-15', '1003', 50000);

		expect(journal.lines[0].amount).toBe(50000);
		expect(journal.lines[1].amount).toBe(50000);
	});
});

describe('getJournalAmount', () => {
	it('借方行の合計を返す', () => {
		const amount = getJournalAmount({
			lines: [
				{ id: 'l1', type: 'debit', accountCode: '1003', amount: 30000, taxCategory: 'na' },
				{ id: 'l2', type: 'debit', accountCode: '5001', amount: 500, taxCategory: 'na' },
				{ id: 'l3', type: 'credit', accountCode: '1005', amount: 30500, taxCategory: 'na' }
			]
		});

		expect(amount).toBe(30500);
	});
});

describe('calculateDepositSummary', () => {
	const invoice = { total: 110000 };
	const deposit = (amount: number) => ({
		lines: [
			{ id: 'd', type: 'debit' as const, accountCode: '1003', amount, taxCategory: 'na' as const },
			{ id: 'c', type: 'credit' as const, accountCode: '1005', amount, taxCategory: 'na' as const }
		]
	});

	it('入金仕訳がなければ残額は税込合計', () => {
		expect(calculateDepositSummary(invoice, [])).toEqual({
			depositedTotal: 0,
			remaining: 110000,
			isFullyDeposited: false
		});
	});

	it('分割入金の合計と残額を計算する', () => {
		expect(calculateDepositSummary(invoice, [deposit(50000), deposit(30000)])).toEqual({
			depositedTotal: 80000,
			remaining: 30000,
			isFullyDeposited: false
		});
	});

	it('全額入金済みなら残額 0 で isFullyDeposited が true', () => {
		expect(calculateDepositSummary(invoice, [deposit(110000)])).toEqual({
			depositedTotal: 110000,
			remaining: 0,
			isFullyDeposited: true
		});
	});

	it('入金が税込合計を超えても残額はマイナスにならない', () => {
		const summary = calculateDepositSummary(invoice, [deposit(120000)]);

		expect(summary.remaining).toBe(0);
		expect(summary.isFullyDeposited).toBe(true);
	});
});

describe('compareSalesJournal / buildSalesJournalUpdate', () => {
	const vendor: Vendor = {
		id: 'vendor-1',
		name: 'テスト株式会社',
		createdAt: '2026-01-01T00:00:00Z',
		updatedAt: '2026-01-01T00:00:00Z'
	};
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
		taxBreakdown: { taxable10: 100000, tax10: 10000, taxable8: 0, tax8: 0 },
		status: 'issued',
		createdAt: '2026-01-15T00:00:00Z',
		updatedAt: '2026-01-15T00:00:00Z'
	};

	beforeEach(() => {
		let n = 0;
		vi.stubGlobal('crypto', { randomUUID: vi.fn(() => `id-${++n}`) });
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('請求書から作った直後の仕訳は不一致なし（行 ID の違いは無視）', () => {
		const journal = generateSalesJournal(invoice, vendor);

		expect(compareSalesJournal(invoice, vendor, journal)).toEqual([]);
	});

	it('明細の金額が変わると「金額」の不一致を返す', () => {
		const journal = generateSalesJournal(invoice, vendor);
		const changed: Invoice = {
			...invoice,
			total: 121000,
			taxBreakdown: { taxable10: 110000, tax10: 11000, taxable8: 0, tax8: 0 }
		};

		const diffs = compareSalesJournal(changed, vendor, journal);

		expect(diffs.map((d) => d.field)).toEqual(['lines']);
		expect(diffs[0].journalValue).toContain('110,000');
		expect(diffs[0].invoiceValue).toContain('121,000');
	});

	it('発行日・取引先・請求書番号の変更をそれぞれ検出する', () => {
		const journal = generateSalesJournal(invoice, vendor);
		const changed: Invoice = {
			...invoice,
			issueDate: '2026-02-01',
			invoiceNumber: 'INV-2026-0002'
		};
		const otherVendor: Vendor = { ...vendor, id: 'vendor-2', name: '別の会社' };

		const diffs = compareSalesJournal(changed, otherVendor, journal);

		expect(diffs.map((d) => d.field)).toEqual(['date', 'vendor', 'description']);
		expect(diffs[0]).toMatchObject({ journalValue: '2026-01-15', invoiceValue: '2026-02-01' });
		expect(diffs[2].invoiceValue).toBe('売掛金計上 INV-2026-0002');
	});

	it('仕訳帳側で行の順序が入れ替わっていても不一致にしない', () => {
		const journal = generateSalesJournal(invoice, vendor);
		const reordered = { ...journal, lines: [...journal.lines].reverse() };

		expect(compareSalesJournal(invoice, vendor, reordered)).toEqual([]);
	});

	it('buildSalesJournalUpdate は date / vendor / description / lines だけを返す', () => {
		const update = buildSalesJournalUpdate(invoice, vendor);

		expect(Object.keys(update).sort()).toEqual(['date', 'description', 'lines', 'vendor']);
		expect(update.date).toBe('2026-01-15');
		expect(update.vendor).toBe('テスト株式会社');
		expect(update.lines).toHaveLength(2);
	});
});
