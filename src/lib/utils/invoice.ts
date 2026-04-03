/**
 * 請求書関連のユーティリティ関数
 */

import type { Invoice, InvoiceItem } from '$lib/types/invoice';

/**
 * 明細行の金額を計算する（小数点以下切り捨て）
 *
 * 数量と単価を乗算し、結果を整数で返す。
 * 小数点以下は切り捨てられる（端数処理）。
 *
 * @param quantity 数量
 * @param unitPrice 単価
 * @returns 金額（整数、小数点以下は切り捨て）
 *
 * @example
 * calculateItemAmount(3, 1000.5) // => 3001（3 × 1000.5 = 3001.5 → 3001）
 */
export function calculateItemAmount(quantity: number, unitPrice: number): number {
	return Math.floor(quantity * unitPrice);
}

/**
 * 請求書全体の金額を計算する
 *
 * 明細行の合計から、小計（税抜）、消費税合計、合計金額を計算する。
 * 税率別（10%/8%）に売上と消費税を集計し、端数処理（切り捨て）を適用する。
 *
 * @param items 明細行の配列
 * @returns 計算結果オブジェクト
 *   - `subtotal`: 税抜合計
 *   - `taxAmount`: 消費税合計
 *   - `total`: 税込合計
 *   - `taxBreakdown`: 税率別内訳
 *     - `taxable10`: 10%対象の税抜金額
 *     - `tax10`: 10%の消費税
 *     - `taxable8`: 8%対象の税抜金額
 *     - `tax8`: 8%の消費税
 *
 * @example
 * const items = [
 *   { amount: 10000, taxRate: 10 },
 *   { amount: 5000, taxRate: 8 }
 * ];
 * const result = calculateInvoiceAmounts(items);
 * // => { subtotal: 15000, taxAmount: 1300, total: 16300, taxBreakdown: {...} }
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
 * 空の請求書データを生成する
 *
 * 新規請求書作成用の初期データを返す。
 * 発行日は今日、支払期限は月末日に自動設定される。
 *
 * @returns 初期化された請求書データ（ID、タイムスタンプを除く）
 *
 * @example
 * const invoice = createEmptyInvoice();
 * // => { invoiceNumber: '', issueDate: '2025-04-04', dueDate: '2025-04-30', ... }
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
 * 空の請求書明細行を生成する
 *
 * 新規明細行追加用の初期データを返す。
 * 数量はデフォルト1、税率はデフォルト10%に設定される。
 *
 * @returns 初期化された明細行データ
 *
 * @example
 * const item = createEmptyInvoiceItem();
 * // => { id: 'uuid...', date: '', description: '', quantity: 1, unitPrice: 0, amount: 0, taxRate: 10 }
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
 * 指定日付の月末日を取得する
 *
 * タイムゾーンに非依存で月末日を計算する。
 * 例：2025-01-15 → 2025-01-31
 *
 * @param dateStr 日付文字列（YYYY-MM-DD形式）
 * @returns 月末日（YYYY-MM-DD形式）
 *
 * @example
 * getMonthEndDate('2025-01-15') // => '2025-01-31'
 * getMonthEndDate('2025-02-01') // => '2025-02-28'
 */
export function getMonthEndDate(dateStr: string): string {
	const [year, month] = dateStr.split('-').map(Number);

	// 翌月の0日 = 今月の最終日
	const lastDay = new Date(year, month, 0);
	return formatDateLocal(lastDay);
}

/**
 * 指定日付の翌月末日を取得する
 *
 * タイムゾーンに非依存で翌月末日を計算する。
 * 請求書の支払期限設定などで使用される。
 * 例：2025-01-15 → 2025-02-28
 *
 * @param dateStr 日付文字列（YYYY-MM-DD形式）
 * @returns 翌月末日（YYYY-MM-DD形式）
 *
 * @example
 * getNextMonthEndDate('2025-01-15') // => '2025-02-28'
 * getNextMonthEndDate('2025-12-01') // => '2026-01-31'
 */
export function getNextMonthEndDate(dateStr: string): string {
	const [year, month] = dateStr.split('-').map(Number);

	// 翌々月の0日 = 翌月の最終日
	const lastDay = new Date(year, month + 1, 0);
	return formatDateLocal(lastDay);
}

/**
 * 日付を日本語形式「YYYY年M月D日」に変換する
 *
 * 請求書やレポートなど、日本語表記が必要な場面で使用される。
 *
 * @param dateStr 日付文字列（YYYY-MM-DD形式）
 * @returns 日本語形式の日付文字列
 *
 * @example
 * formatDateJapanese('2025-04-04') // => '2025年4月4日'
 * formatDateJapanese('2025-12-31') // => '2025年12月31日'
 */
export function formatDateJapanese(dateStr: string): string {
	const date = new Date(dateStr);
	const year = date.getFullYear();
	const month = date.getMonth() + 1;
	const day = date.getDate();
	return `${year}年${month}月${day}日`;
}

/**
 * 金額をカンマ区切りの「¥N,NNN」形式に変換する
 *
 * 日本語ロケール（ja-JP）を使用して金額をフォーマットする。
 * `null`や`undefined`の場合は0として扱われる。
 *
 * @param amount 金額（数値、null、undefined）
 * @returns フォーマットされた金額文字列（カンマ区切り）
 *
 * @example
 * formatCurrency(1000) // => '1,000'
 * formatCurrency(1000000) // => '1,000,000'
 * formatCurrency(null) // => '0'
 * formatCurrency(undefined) // => '0'
 */
export function formatCurrency(amount: number | null | undefined): string {
	return (amount ?? 0).toLocaleString('ja-JP');
}

/**
 * 請求書番号の形式を検証する
 *
 * 請求書番号が空またはホワイトスペースのみではないことを確認する。
 *
 * @param invoiceNumber 検証対象の請求書番号
 * @returns 有効（空でない）場合`true`、無効（空またはホワイトスペースのみ）の場合`false`
 *
 * @example
 * validateInvoiceNumber('INV-2025-0001') // => true
 * validateInvoiceNumber('') // => false
 * validateInvoiceNumber('   ') // => false
 */
export function validateInvoiceNumber(invoiceNumber: string): boolean {
	return invoiceNumber.trim().length > 0;
}
