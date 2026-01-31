/**
 * 請求書関連のユーティリティ関数
 */

import type { Invoice, InvoiceItem } from '$lib/types/invoice';

/**
 * 明細行の金額を計算（小数点以下切り捨て）
 */
export function calculateItemAmount(quantity: number, unitPrice: number): number {
	return Math.floor(quantity * unitPrice);
}

/**
 * 請求書の合計金額を計算
 */
export function calculateInvoiceAmounts(items: InvoiceItem[]): {
	subtotal: number;
	taxAmount: number;
	total: number;
	taxBreakdown: {
		taxable10: number;
		tax10: number;
		taxable8: number;
		tax8: number;
	};
} {
	let taxable10 = 0;
	let taxable8 = 0;

	for (const item of items) {
		if (item.taxRate === 10) {
			taxable10 += item.amount;
		} else if (item.taxRate === 8) {
			taxable8 += item.amount;
		}
	}

	// 消費税は端数切り捨て
	const tax10 = Math.floor(taxable10 * 0.1);
	const tax8 = Math.floor(taxable8 * 0.08);

	const subtotal = taxable10 + taxable8;
	const taxAmount = tax10 + tax8;
	const total = subtotal + taxAmount;

	return {
		subtotal,
		taxAmount,
		total,
		taxBreakdown: {
			taxable10,
			tax10,
			taxable8,
			tax8
		}
	};
}

/**
 * 空の請求書を作成
 */
export function createEmptyInvoice(): Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'> {
	const today = new Date().toISOString().slice(0, 10);
	// デフォルトの支払期限は月末
	const dueDate = getMonthEndDate(today);

	return {
		invoiceNumber: '',
		issueDate: today,
		dueDate,
		vendorId: '',
		items: [],
		subtotal: 0,
		taxAmount: 0,
		total: 0,
		taxBreakdown: {
			taxable10: 0,
			tax10: 0,
			taxable8: 0,
			tax8: 0
		},
		status: 'draft'
	};
}

/**
 * 空の明細行を作成
 */
export function createEmptyInvoiceItem(): InvoiceItem {
	return {
		id: crypto.randomUUID(),
		date: '',
		description: '',
		quantity: 1,
		unitPrice: 0,
		amount: 0,
		taxRate: 10
	};
}

/**
 * 日付をYYYY-MM-DD形式にフォーマット（タイムゾーン非依存）
 */
function formatDateLocal(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

/**
 * 月末の日付を取得
 */
export function getMonthEndDate(dateStr: string): string {
	const [year, month] = dateStr.split('-').map(Number);

	// 翌月の0日 = 今月の最終日
	const lastDay = new Date(year, month, 0);
	return formatDateLocal(lastDay);
}

/**
 * 翌月末の日付を取得
 */
export function getNextMonthEndDate(dateStr: string): string {
	const [year, month] = dateStr.split('-').map(Number);

	// 翌々月の0日 = 翌月の最終日
	const lastDay = new Date(year, month + 1, 0);
	return formatDateLocal(lastDay);
}

/**
 * 日付を日本語形式に変換
 */
export function formatDateJapanese(dateStr: string): string {
	const date = new Date(dateStr);
	const year = date.getFullYear();
	const month = date.getMonth() + 1;
	const day = date.getDate();
	return `${year}年${month}月${day}日`;
}

/**
 * 金額をカンマ区切りに変換
 * null/undefinedの場合は0として扱う
 */
export function formatCurrency(amount: number | null | undefined): string {
	return (amount ?? 0).toLocaleString('ja-JP');
}

/**
 * 請求書番号の検証（空でないこと）
 */
export function validateInvoiceNumber(invoiceNumber: string): boolean {
	return invoiceNumber.trim().length > 0;
}
