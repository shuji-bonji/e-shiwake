/**
 * 請求書関連の型定義
 */

/**
 * 請求書明細行
 */
export interface InvoiceItem {
	id: string; // UUID
	date: string; // 自由記述（"1月31日", "1月分", "1/1〜1/31"など）
	description: string; // 品名・サービス名
	quantity: number; // 数量
	unitPrice: number; // 単価
	amount: number; // 金額（自動計算: quantity × unitPrice）
	taxRate: 10 | 8; // 消費税率
}

/**
 * 請求書ステータス
 */
export type InvoiceStatus = 'draft' | 'issued';

/**
 * 請求書ステータスのラベル
 */
export const InvoiceStatusLabels: Record<InvoiceStatus, string> = {
	draft: '下書き',
	issued: '発行済み'
};

/**
 * 請求書の入金状態（紐づく仕訳から導出する。請求書には保存しない）
 */
export type InvoicePaymentStatus = 'unpaid' | 'partial' | 'paid';

/**
 * 入金状態のラベル
 */
export const InvoicePaymentStatusLabels: Record<InvoicePaymentStatus, string> = {
	unpaid: '未入金',
	partial: '一部入金',
	paid: '入金済'
};

/**
 * 請求書
 */
export interface Invoice {
	id: string; // UUID
	invoiceNumber: string; // 請求書番号（自由入力形式）
	issueDate: string; // 発行日（YYYY-MM-DD）
	dueDate: string; // 支払期限（YYYY-MM-DD）
	vendorId: string; // 取引先ID
	items: InvoiceItem[]; // 明細行
	subtotal: number; // 税抜合計
	taxAmount: number; // 消費税合計
	total: number; // 税込合計
	taxBreakdown: {
		taxable10: number; // 10%対象（税抜）
		tax10: number; // 10%消費税
		taxable8: number; // 8%対象（税抜）
		tax8: number; // 8%消費税
	};
	status: InvoiceStatus; // ステータス（書類上の状態。入金状態は仕訳から導出する）
	note?: string; // 備考
	settledManually?: boolean; // 旧「入金済み」ステータスからの移行専用。紐づく入金仕訳がないときだけ「入金済」表示に使う
	createdAt: string; // 作成日時 ISO8601
	updatedAt: string; // 更新日時 ISO8601
}

/**
 * 請求書の入力用型（ID、タイムスタンプを除く）
 */
export type InvoiceInput = Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * 請求書の更新用型
 */
export type InvoiceUpdate = Partial<Omit<Invoice, 'id' | 'createdAt'>>;
