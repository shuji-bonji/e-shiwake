/**
 * 請求書の入金状態・売掛金仕訳の有無を、紐づく仕訳（invoiceId が一致する仕訳）から導出する
 *
 * 請求書は仕訳を所有しない。真実は仕訳帳にあり、ここでは集計するだけ。
 * 設計: docs/design/invoice-settlement.md
 */

import type { Invoice, InvoicePaymentStatus } from '$lib/types/invoice';
import type { JournalEntry } from '$lib/types';

/** 売掛金の勘定科目コード */
export const ACCOUNTS_RECEIVABLE_CODE = '1005';

/** 導出に必要な仕訳の項目 */
export type LinkedJournal = Pick<JournalEntry, 'id' | 'lines' | 'generatedFrom'>;

/**
 * 請求書の決済状態（導出値）
 */
export interface InvoiceSettlement {
	/** 売掛金仕訳（借方に 1005 売掛金がある仕訳）が 1 件以上紐づいているか */
	salesJournalCreated: boolean;
	/** 紐づく売掛金仕訳の ID（複数あり得る） */
	salesJournalIds: string[];
	/** 請求書の「売掛金仕訳」ボタンが生成した売掛金仕訳の ID（請求書の変更に追従する対象）。なければ null */
	generatedSalesJournalId: string | null;
	/** 紐づく入金仕訳（貸方に 1005 売掛金がある仕訳）の ID */
	depositJournalIds: string[];
	/** 貸方 1005 売掛金の合計 */
	depositedTotal: number;
	/** 未入金残額（税込合計 − 入金合計。マイナスにはならない） */
	remaining: number;
	/** 入金状態 */
	paymentStatus: InvoicePaymentStatus;
}

/** 仕訳の借方 1005 の合計 */
export function receivableDebitTotal(journal: Pick<JournalEntry, 'lines'>): number {
	return journal.lines
		.filter((l) => l.type === 'debit' && l.accountCode === ACCOUNTS_RECEIVABLE_CODE)
		.reduce((sum, l) => sum + l.amount, 0);
}

/** 仕訳の貸方 1005 の合計 */
export function receivableCreditTotal(journal: Pick<JournalEntry, 'lines'>): number {
	return journal.lines
		.filter((l) => l.type === 'credit' && l.accountCode === ACCOUNTS_RECEIVABLE_CODE)
		.reduce((sum, l) => sum + l.amount, 0);
}

/** 仕訳に 1005 売掛金の行があるか（請求書との紐づけ欄を出す条件） */
export function hasReceivableLine(journal: Pick<JournalEntry, 'lines'>): boolean {
	return journal.lines.some((l) => l.accountCode === ACCOUNTS_RECEIVABLE_CODE);
}

/**
 * 紐づく仕訳から請求書の決済状態を導出する
 *
 * @param invoice - 請求書（total と settledManually を使う）
 * @param linkedJournals - invoiceId === invoice.id の仕訳
 *
 * 判定:
 * - unpaid: 入金合計 = 0（settledManually でない）
 * - partial: 0 < 入金合計 < 税込合計
 * - paid: 入金合計 ≥ 税込合計、または（入金合計 = 0 かつ settledManually）
 *
 * @example
 * ```typescript
 * // total 110,000、入金仕訳 50,000 が 1 件
 * deriveInvoiceSettlement(invoice, [deposit]).paymentStatus; // 'partial'
 * ```
 */
export function deriveInvoiceSettlement(
	invoice: Pick<Invoice, 'total' | 'settledManually'>,
	linkedJournals: LinkedJournal[]
): InvoiceSettlement {
	const salesJournals = linkedJournals.filter((j) => receivableDebitTotal(j) > 0);
	const depositJournals = linkedJournals.filter((j) => receivableCreditTotal(j) > 0);

	const generated = salesJournals.find((j) => j.generatedFrom === 'invoice');
	const depositedTotal = depositJournals.reduce((sum, j) => sum + receivableCreditTotal(j), 0);
	const remaining = Math.max(0, invoice.total - depositedTotal);

	let paymentStatus: InvoicePaymentStatus;
	if (depositedTotal <= 0) {
		paymentStatus = invoice.settledManually ? 'paid' : 'unpaid';
	} else if (depositedTotal < invoice.total) {
		paymentStatus = 'partial';
	} else {
		paymentStatus = 'paid';
	}

	return {
		salesJournalCreated: salesJournals.length > 0,
		salesJournalIds: salesJournals.map((j) => j.id),
		generatedSalesJournalId: generated?.id ?? null,
		depositJournalIds: depositJournals.map((j) => j.id),
		depositedTotal,
		remaining,
		paymentStatus
	};
}

/**
 * 複数の請求書に対して、紐づく仕訳をまとめて導出する（請求書一覧用）
 *
 * @param invoices - 請求書
 * @param journalsWithInvoiceId - invoiceId を持つ仕訳（全件）
 */
export function deriveInvoiceSettlements(
	invoices: Pick<Invoice, 'id' | 'total' | 'settledManually'>[],
	journalsWithInvoiceId: (LinkedJournal & Pick<JournalEntry, 'invoiceId'>)[]
): Map<string, InvoiceSettlement> {
	const byInvoice = new Map<string, LinkedJournal[]>();
	for (const j of journalsWithInvoiceId) {
		if (!j.invoiceId) continue;
		const list = byInvoice.get(j.invoiceId) ?? [];
		list.push(j);
		byInvoice.set(j.invoiceId, list);
	}
	const result = new Map<string, InvoiceSettlement>();
	for (const invoice of invoices) {
		result.set(invoice.id, deriveInvoiceSettlement(invoice, byInvoice.get(invoice.id) ?? []));
	}
	return result;
}
