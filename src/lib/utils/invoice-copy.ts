import type { Invoice, InvoiceInput, InvoiceItem } from '$lib/types/invoice';
import { getNextMonthEndDate } from './invoice';

/**
 * 既存請求書をコピーして新規作成用のデータを生成する
 *
 * 既存の請求書データをコピーし、新規作成に適した形に整えて返す。
 * 毎月同じ取引先に発行する場合などで、既存パターンを再利用する際に便利。
 *
 * コピー時の調整内容：
 * - 発行日は今日に変更
 * - 支払期限は翌月末日に自動設定
 * - 請求書番号は空にリセット（保存時に自動採番）
 * - ステータスは「下書き」（draft）にリセット
 * - 仕訳紐付けはクリア（journalId = undefined）
 * - 明細行のIDは新規生成される
 * - 取引先、明細行、備考は引き継がれる
 *
 * @param original コピー元の請求書データ
 * @returns 新規作成用に調整された請求書データ
 *
 * @example
 * const original = { invoiceNumber: 'INV-2025-0001', issueDate: '2025-03-01', ... };
 * const newInvoice = copyInvoiceForNew(original);
 * // newInvoice.invoiceNumber は空, issueDate は今日, dueDate は翌月末
 */
export function copyInvoiceForNew(original: Invoice): InvoiceInput {
	const today = new Date().toISOString().split('T')[0];

	return {
		invoiceNumber: '',
		issueDate: today,
		dueDate: getNextMonthEndDate(today),
		vendorId: original.vendorId,
		items: original.items.map(
			(item): InvoiceItem => ({
				...item,
				id: crypto.randomUUID()
			})
		),
		subtotal: original.subtotal,
		taxAmount: original.taxAmount,
		total: original.total,
		taxBreakdown: { ...original.taxBreakdown },
		status: 'draft',
		note: original.note,
		journalId: undefined
	};
}
