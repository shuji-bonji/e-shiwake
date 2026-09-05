import { describe, it, expect } from 'vitest';
import {
	deriveInvoiceSettlement,
	deriveInvoiceSettlements,
	hasReceivableLine,
	receivableCreditTotal,
	receivableDebitTotal,
	type LinkedJournal
} from './invoice-settlement';
import type { JournalLine } from '$lib/types';

const line = (type: 'debit' | 'credit', accountCode: string, amount: number): JournalLine => ({
	id: `${type}-${accountCode}-${amount}`,
	type,
	accountCode,
	amount,
	taxCategory: 'na'
});

/** 売掛金仕訳: 借方 売掛金 / 貸方 売上高 */
const sales = (id: string, amount: number, generated = false): LinkedJournal => ({
	id,
	lines: [line('debit', '1005', amount), line('credit', '4001', amount)],
	generatedFrom: generated ? 'invoice' : undefined
});

/** 入金仕訳: 借方 普通預金 / 貸方 売掛金 */
const deposit = (id: string, amount: number): LinkedJournal => ({
	id,
	lines: [line('debit', '1003', amount), line('credit', '1005', amount)]
});

const invoice = { total: 110000 };

describe('receivableDebitTotal / receivableCreditTotal / hasReceivableLine', () => {
	it('借方・貸方それぞれの 1005 の合計を返す', () => {
		expect(receivableDebitTotal(sales('s', 110000))).toBe(110000);
		expect(receivableCreditTotal(sales('s', 110000))).toBe(0);
		expect(receivableDebitTotal(deposit('d', 50000))).toBe(0);
		expect(receivableCreditTotal(deposit('d', 50000))).toBe(50000);
	});

	it('1005 の行がなければ hasReceivableLine は false', () => {
		expect(
			hasReceivableLine({ lines: [line('debit', '1003', 100), line('credit', '4001', 100)] })
		).toBe(false);
		expect(hasReceivableLine(deposit('d', 1))).toBe(true);
	});
});

describe('deriveInvoiceSettlement', () => {
	it('紐づく仕訳がなければ 未作成・未入金', () => {
		const s = deriveInvoiceSettlement(invoice, []);

		expect(s.salesJournalCreated).toBe(false);
		expect(s.generatedSalesJournalId).toBeNull();
		expect(s.depositedTotal).toBe(0);
		expect(s.remaining).toBe(110000);
		expect(s.paymentStatus).toBe('unpaid');
	});

	it('生成した売掛金仕訳があれば 作成済 で generatedSalesJournalId を返す', () => {
		const s = deriveInvoiceSettlement(invoice, [sales('s1', 110000, true)]);

		expect(s.salesJournalCreated).toBe(true);
		expect(s.salesJournalIds).toEqual(['s1']);
		expect(s.generatedSalesJournalId).toBe('s1');
	});

	it('手で切って紐づけた売掛金仕訳は 作成済 だが generatedSalesJournalId は null', () => {
		const s = deriveInvoiceSettlement(invoice, [sales('s1', 110000)]);

		expect(s.salesJournalCreated).toBe(true);
		expect(s.generatedSalesJournalId).toBeNull();
	});

	it('分割入金は合計と残額を計算し 一部入金 になる', () => {
		const s = deriveInvoiceSettlement(invoice, [
			sales('s1', 110000, true),
			deposit('d1', 50000),
			deposit('d2', 30000)
		]);

		expect(s.depositJournalIds).toEqual(['d1', 'd2']);
		expect(s.depositedTotal).toBe(80000);
		expect(s.remaining).toBe(30000);
		expect(s.paymentStatus).toBe('partial');
	});

	it('入金合計が税込合計に達すると 入金済（厳密一致）', () => {
		expect(deriveInvoiceSettlement(invoice, [deposit('d', 110000)]).paymentStatus).toBe('paid');
		expect(deriveInvoiceSettlement(invoice, [deposit('d', 109999)]).paymentStatus).toBe('partial');
	});

	it('手数料で行が割れても貸方 1005 の合計で判定する', () => {
		const withFee: LinkedJournal = {
			id: 'd',
			lines: [
				line('debit', '1003', 109560),
				line('debit', '5010', 440),
				line('credit', '1005', 110000)
			]
		};

		expect(deriveInvoiceSettlement(invoice, [withFee]).paymentStatus).toBe('paid');
	});

	it('入金が税込合計を超えても残額はマイナスにならない', () => {
		const s = deriveInvoiceSettlement(invoice, [deposit('d', 120000)]);

		expect(s.remaining).toBe(0);
		expect(s.paymentStatus).toBe('paid');
	});

	it('settledManually は紐づく入金仕訳がないときだけ 入金済 にする', () => {
		expect(deriveInvoiceSettlement({ ...invoice, settledManually: true }, []).paymentStatus).toBe(
			'paid'
		);
		expect(
			deriveInvoiceSettlement({ ...invoice, settledManually: true }, [deposit('d', 50000)])
				.paymentStatus
		).toBe('partial');
	});
});

describe('deriveInvoiceSettlements', () => {
	it('invoiceId ごとにまとめて導出する', () => {
		const result = deriveInvoiceSettlements(
			[
				{ id: 'inv-1', total: 110000 },
				{ id: 'inv-2', total: 55000 }
			],
			[
				{ ...sales('s1', 110000, true), invoiceId: 'inv-1' },
				{ ...deposit('d1', 110000), invoiceId: 'inv-1' },
				{ ...deposit('d2', 20000), invoiceId: 'inv-2' },
				{ ...deposit('d3', 5000), invoiceId: undefined }
			]
		);

		expect(result.get('inv-1')?.paymentStatus).toBe('paid');
		expect(result.get('inv-1')?.salesJournalCreated).toBe(true);
		expect(result.get('inv-2')?.paymentStatus).toBe('partial');
		expect(result.get('inv-2')?.salesJournalCreated).toBe(false);
	});
});
