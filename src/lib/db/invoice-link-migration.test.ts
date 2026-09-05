import { describe, it, expect } from 'vitest';
import { normalizeLegacyInvoice, type LegacyInvoice } from './invoice-link-migration';

const base: LegacyInvoice = {
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

describe('normalizeLegacyInvoice', () => {
	it('新形式の請求書はそのまま（紐づけなし）', () => {
		const { invoice, links } = normalizeLegacyInvoice(base);

		expect(invoice).toEqual(base);
		expect(links).toEqual([]);
		expect('journalId' in invoice).toBe(false);
	});

	it("status 'paid' は issued + settledManually に写す", () => {
		const { invoice } = normalizeLegacyInvoice({ ...base, status: 'paid' });

		expect(invoice.status).toBe('issued');
		expect(invoice.settledManually).toBe(true);
	});

	it('journalId は generatedFrom 付きの紐づけになり、請求書からは消える', () => {
		const { invoice, links } = normalizeLegacyInvoice({ ...base, journalId: 'j-sales' });

		expect(links).toEqual([{ journalId: 'j-sales', invoiceId: 'inv-1', generatedFrom: 'invoice' }]);
		expect('journalId' in invoice).toBe(false);
	});

	it('depositJournalIds は generatedFrom なしの紐づけになる', () => {
		const { invoice, links } = normalizeLegacyInvoice({
			...base,
			depositJournalIds: ['j-d1', 'j-d2']
		});

		expect(links).toEqual([
			{ journalId: 'j-d1', invoiceId: 'inv-1' },
			{ journalId: 'j-d2', invoiceId: 'inv-1' }
		]);
		expect('depositJournalIds' in invoice).toBe(false);
	});

	it('既に settledManually を持つ新形式はそのまま保つ', () => {
		const { invoice } = normalizeLegacyInvoice({ ...base, settledManually: true });

		expect(invoice.settledManually).toBe(true);
	});
});
