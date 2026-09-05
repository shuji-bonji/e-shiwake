/**
 * 仕訳編集画面の「対応する請求書」選択欄で使う候補と警告（純粋関数）
 *
 * 設計: docs/design/invoice-settlement.md §4.3
 */

import type { Invoice, InvoicePaymentStatus, InvoiceStatus } from '$lib/types/invoice';
import type { JournalEntry, Vendor } from '$lib/types';
import { deriveInvoiceSettlements, receivableDebitTotal } from './invoice-settlement';
import { salesJournalDescription, depositJournalDescription } from './invoice-journal';

/** 選択欄に出す請求書 1 件 */
export interface InvoiceLinkOption {
	id: string;
	invoiceNumber: string;
	issueDate: string;
	total: number;
	/** 請求書の取引先名（取引先が削除されていれば空文字） */
	vendorName: string;
	/** 書類ステータス。新たに紐づけられるのは 'issued' だけ */
	status: InvoiceStatus;
	paymentStatus: InvoicePaymentStatus;
	/** この請求書に紐づく売掛金仕訳の ID */
	salesJournalIds: string[];
}

/**
 * 選択欄の候補を作る（発行日の新しい順）
 *
 * 全請求書を含める（下書きのまま売掛金仕訳を生成した場合など、紐づけ先が発行済みとは限らないため）。
 * 新たに選べるのは発行済みだけで、その絞り込みは selectableOptions() で行う。
 *
 * @param invoices - 全請求書
 * @param vendors - 取引先（ID → 名前の解決に使う）
 * @param journalsWithInvoiceId - invoiceId を持つ仕訳（全件）
 */
export function buildInvoiceLinkOptions(
	invoices: Invoice[],
	vendors: Pick<Vendor, 'id' | 'name'>[],
	journalsWithInvoiceId: Pick<JournalEntry, 'id' | 'lines' | 'generatedFrom' | 'invoiceId'>[]
): InvoiceLinkOption[] {
	const vendorName = new Map(vendors.map((v) => [v.id, v.name]));
	const settlements = deriveInvoiceSettlements(invoices, journalsWithInvoiceId);

	return invoices
		.map((inv) => {
			const s = settlements.get(inv.id);
			return {
				id: inv.id,
				invoiceNumber: inv.invoiceNumber,
				issueDate: inv.issueDate,
				total: inv.total,
				vendorName: vendorName.get(inv.vendorId) ?? '',
				status: inv.status,
				paymentStatus: s?.paymentStatus ?? 'unpaid',
				salesJournalIds: s?.salesJournalIds ?? []
			};
		})
		.sort((a, b) => b.issueDate.localeCompare(a.issueDate));
}

/**
 * 新たに紐づけられる候補（発行済みだけ）を、仕訳の取引先名で絞る。取引先が空なら発行済み全件
 */
export function filterOptionsByVendor(
	options: InvoiceLinkOption[],
	vendorName: string
): InvoiceLinkOption[] {
	const issued = options.filter((o) => o.status === 'issued');
	const name = vendorName.trim();
	if (!name) return issued;
	return issued.filter((o) => o.vendorName === name);
}

/**
 * 仕訳を請求書に紐づけるときの警告（保存は止めない）
 *
 * - 借方 1005 のある仕訳で、既に別の売掛金仕訳が紐づく請求書を選んだ → 二重計上の可能性
 * - 借方 1005 の合計が請求書の税込合計と異なる
 * - 仕訳の取引先名が請求書の取引先名と異なる
 */
export function getInvoiceLinkWarnings(
	journal: Pick<JournalEntry, 'id' | 'lines' | 'vendor'>,
	option: InvoiceLinkOption
): string[] {
	const warnings: string[] = [];
	const debit = receivableDebitTotal(journal);

	if (debit > 0) {
		const others = option.salesJournalIds.filter((id) => id !== journal.id);
		if (others.length > 0) {
			warnings.push(
				`この請求書には既に売掛金仕訳が紐づいています（${others.length} 件）。売上が二重計上になる可能性があります`
			);
		}
		if (debit !== option.total) {
			warnings.push(
				`請求書と金額が異なります（仕訳 ${debit.toLocaleString('ja-JP')} 円 ／ 請求書 ${option.total.toLocaleString('ja-JP')} 円）`
			);
		}
	}

	if (journal.vendor.trim() && option.vendorName && journal.vendor.trim() !== option.vendorName) {
		warnings.push(
			`請求書と取引先が異なります（仕訳 ${journal.vendor} ／ 請求書 ${option.vendorName}）`
		);
	}

	return warnings;
}

/**
 * 請求書に紐づけたときの摘要を決める
 *
 * - 既存の摘要に請求書番号が含まれていれば、利用者の書いた摘要をそのまま残す
 * - それ以外は、借方 1005 なら「売掛金計上 INV-…」、貸方 1005 なら「入金 INV-…」に置き換える
 *   （請求書のボタンが生成する仕訳と同じ形にし、請求書側の不一致表示を減らす）
 */
export function descriptionForLinkedJournal(
	journal: Pick<JournalEntry, 'lines' | 'description'>,
	invoiceNumber: string
): string {
	const current = journal.description.trim();
	if (invoiceNumber && current.includes(invoiceNumber)) return journal.description;
	return receivableDebitTotal(journal) > 0
		? salesJournalDescription(invoiceNumber)
		: depositJournalDescription(invoiceNumber);
}
