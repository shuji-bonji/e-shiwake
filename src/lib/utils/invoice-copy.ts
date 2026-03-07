import type { Invoice, InvoiceInput, InvoiceItem } from '$lib/types/invoice';
import { getNextMonthEndDate } from './invoice';

/**
 * 請求書をコピーして新規作成用のデータを生成
 * - 発行日は今日に変更
 * - 支払期限は翌月末に変更
 * - 請求書番号は空（保存時に自動採番）
 * - ステータスは下書きにリセット
 * - 仕訳紐付けはクリア
 * - 明細行のIDは新規生成
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
