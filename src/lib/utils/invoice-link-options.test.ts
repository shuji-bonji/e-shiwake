import { describe, it, expect } from 'vitest';
import {
	buildInvoiceLinkOptions,
	filterOptionsByVendor,
	getInvoiceLinkWarnings,
	descriptionForLinkedJournal,
	type InvoiceLinkOption
} from './invoice-link-options';
import type { Invoice } from '$lib/types/invoice';
import type { JournalLine } from '$lib/types';

const invoice = (over: Partial<Invoice>): Invoice => ({
	id: 'inv-1',
	invoiceNumber: 'INV-2026-0001',
	issueDate: '2026-01-15',
	dueDate: '2026-01-31',
	vendorId: 'v-1',
	items: [],
	subtotal: 100000,
	taxAmount: 10000,
	total: 110000,
	taxBreakdown: { taxable10: 100000, tax10: 10000, taxable8: 0, tax8: 0 },
	status: 'issued',
	createdAt: '',
	updatedAt: '',
	...over
});

const line = (type: 'debit' | 'credit', accountCode: string, amount: number): JournalLine => ({
	id: `${type}-${accountCode}`,
	type,
	accountCode,
	amount,
	taxCategory: 'na'
});

const vendors = [{ id: 'v-1', name: 'テスト商事' }];

describe('buildInvoiceLinkOptions', () => {
	it('全請求書を発行日の新しい順に並べ、取引先名・ステータス・決済状態を付ける', () => {
		const options = buildInvoiceLinkOptions(
			[
				invoice({ id: 'a', issueDate: '2026-01-01', status: 'draft' }),
				invoice({ id: 'b', issueDate: '2026-02-01' }),
				invoice({ id: 'c', issueDate: '2026-03-01' })
			],
			vendors,
			[
				{
					id: 's1',
					lines: [line('debit', '1005', 110000), line('credit', '4001', 110000)],
					generatedFrom: 'invoice',
					invoiceId: 'c'
				},
				{
					id: 'd1',
					lines: [line('debit', '1003', 110000), line('credit', '1005', 110000)],
					invoiceId: 'b'
				}
			]
		);

		expect(options.map((o) => o.id)).toEqual(['c', 'b', 'a']);
		expect(options[0]).toMatchObject({
			vendorName: 'テスト商事',
			status: 'issued',
			salesJournalIds: ['s1']
		});
		expect(options[1].paymentStatus).toBe('paid');
		expect(options[2].status).toBe('draft');
	});
});

describe('filterOptionsByVendor', () => {
	const opt = (id: string, vendorName: string, status: 'draft' | 'issued'): InvoiceLinkOption => ({
		id,
		invoiceNumber: id,
		issueDate: '',
		total: 0,
		vendorName,
		status,
		paymentStatus: 'unpaid',
		salesJournalIds: []
	});
	const options = [opt('1', 'A社', 'issued'), opt('2', 'B社', 'issued'), opt('3', 'A社', 'draft')];

	it('発行済みのうち取引先名が一致するものだけ返し、空なら発行済み全件', () => {
		expect(filterOptionsByVendor(options, 'A社').map((o) => o.id)).toEqual(['1']);
		expect(filterOptionsByVendor(options, '  ').map((o) => o.id)).toEqual(['1', '2']);
	});
});

describe('getInvoiceLinkWarnings', () => {
	const option: InvoiceLinkOption = {
		id: 'inv-1',
		invoiceNumber: 'INV-2026-0001',
		issueDate: '2026-01-15',
		total: 110000,
		vendorName: 'テスト商事',
		status: 'issued',
		paymentStatus: 'unpaid',
		salesJournalIds: []
	};

	it('金額・取引先が一致する売掛金仕訳なら警告なし', () => {
		const journal = {
			id: 'j',
			vendor: 'テスト商事',
			lines: [line('debit', '1005', 110000), line('credit', '4001', 110000)]
		};

		expect(getInvoiceLinkWarnings(journal, option)).toEqual([]);
	});

	it('既に別の売掛金仕訳が紐づく請求書を選ぶと二重計上の警告', () => {
		const journal = {
			id: 'j',
			vendor: 'テスト商事',
			lines: [line('debit', '1005', 110000), line('credit', '4001', 110000)]
		};

		const warnings = getInvoiceLinkWarnings(journal, { ...option, salesJournalIds: ['other'] });

		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toContain('既に売掛金仕訳が紐づいています');
	});

	it('自分自身が紐づいている場合は二重計上の警告を出さない', () => {
		const journal = {
			id: 'j',
			vendor: 'テスト商事',
			lines: [line('debit', '1005', 110000), line('credit', '4001', 110000)]
		};

		expect(getInvoiceLinkWarnings(journal, { ...option, salesJournalIds: ['j'] })).toEqual([]);
	});

	it('金額と取引先の食い違いをそれぞれ警告する', () => {
		const journal = {
			id: 'j',
			vendor: '別の会社',
			lines: [line('debit', '1005', 100000), line('credit', '4001', 100000)]
		};

		const warnings = getInvoiceLinkWarnings(journal, option);

		expect(warnings).toHaveLength(2);
		expect(warnings[0]).toContain('金額が異なります');
		expect(warnings[1]).toContain('取引先が異なります');
	});

	it('入金仕訳（貸方 1005）は金額の警告を出さない（分割入金があるため）', () => {
		const journal = {
			id: 'j',
			vendor: 'テスト商事',
			lines: [line('debit', '1003', 50000), line('credit', '1005', 50000)]
		};

		expect(getInvoiceLinkWarnings(journal, option)).toEqual([]);
	});
});

describe('descriptionForLinkedJournal', () => {
	it('借方 1005 なら「売掛金計上 INV-…」、貸方 1005 なら「入金 INV-…」にする', () => {
		const sales = { description: '', lines: [line('debit', '1005', 1), line('credit', '4001', 1)] };
		const deposit = {
			description: '',
			lines: [line('debit', '1003', 1), line('credit', '1005', 1)]
		};

		expect(descriptionForLinkedJournal(sales, 'INV-2026-0001')).toBe('売掛金計上 INV-2026-0001');
		expect(descriptionForLinkedJournal(deposit, 'INV-2026-0001')).toBe('入金 INV-2026-0001');
	});

	it('既存の摘要に請求書番号が含まれていればそのまま残す', () => {
		const sales = {
			description: '売掛金計上 INV-2026-0001 9月分',
			lines: [line('debit', '1005', 1), line('credit', '4001', 1)]
		};

		expect(descriptionForLinkedJournal(sales, 'INV-2026-0001')).toBe(
			'売掛金計上 INV-2026-0001 9月分'
		);
	});

	it('請求書番号を含まない摘要は置き換える', () => {
		const sales = {
			description: '9月分',
			lines: [line('debit', '1005', 1), line('credit', '4001', 1)]
		};

		expect(descriptionForLinkedJournal(sales, 'INV-2026-0001')).toBe('売掛金計上 INV-2026-0001');
	});
});
