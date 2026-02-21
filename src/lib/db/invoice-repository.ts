import type { Invoice, InvoiceStatus } from '$lib/types/invoice';
import { db } from './database';

// ==================== 請求書関連 ====================

/**
 * 全請求書の取得（発行日降順）
 */
export async function getAllInvoices(): Promise<Invoice[]> {
	return db.invoices.orderBy('issueDate').reverse().toArray();
}

/**
 * 請求書の取得（ID指定）
 */
export async function getInvoiceById(id: string): Promise<Invoice | undefined> {
	return db.invoices.get(id);
}

/**
 * 年度別請求書の取得
 */
export async function getInvoicesByYear(year: number): Promise<Invoice[]> {
	const startDate = `${year}-01-01`;
	const endDate = `${year}-12-31`;

	return db.invoices.where('issueDate').between(startDate, endDate, true, true).reverse().toArray();
}

/**
 * 取引先別請求書の取得
 */
export async function getInvoicesByVendor(vendorId: string): Promise<Invoice[]> {
	return db.invoices.where('vendorId').equals(vendorId).reverse().toArray();
}

/**
 * ステータス別請求書の取得
 */
export async function getInvoicesByStatus(status: InvoiceStatus): Promise<Invoice[]> {
	return db.invoices.where('status').equals(status).reverse().toArray();
}

/**
 * 請求書の追加
 */
export async function addInvoice(
	invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
	const id = crypto.randomUUID();
	const now = new Date().toISOString();

	await db.invoices.add({
		...invoice,
		id,
		createdAt: now,
		updatedAt: now
	});

	return id;
}

/**
 * 請求書の更新
 */
export async function updateInvoice(
	id: string,
	updates: Partial<Omit<Invoice, 'id' | 'createdAt'>>
): Promise<void> {
	await db.invoices.update(id, {
		...updates,
		updatedAt: new Date().toISOString()
	});
}

/**
 * 請求書の削除
 */
export async function deleteInvoice(id: string): Promise<void> {
	await db.invoices.delete(id);
}

/**
 * 次の請求書番号を生成（参考用）
 * 形式: INV-{YYYY}-{NNNN}
 */
export async function generateNextInvoiceNumber(year?: number): Promise<string> {
	const targetYear = year ?? new Date().getFullYear();
	const prefix = `INV-${targetYear}-`;

	const invoices = await db.invoices.toArray();
	const yearInvoices = invoices.filter((inv) => inv.invoiceNumber.startsWith(prefix));

	let maxNumber = 0;
	for (const inv of yearInvoices) {
		const numPart = inv.invoiceNumber.replace(prefix, '');
		const num = parseInt(numPart, 10);
		if (!isNaN(num) && num > maxNumber) {
			maxNumber = num;
		}
	}

	return `${prefix}${String(maxNumber + 1).padStart(4, '0')}`;
}
