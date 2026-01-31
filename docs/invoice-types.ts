/**
 * 請求書関連の型定義
 * e-shiwake Phase 4: 請求書機能
 */

// ============================================================
// 請求書明細
// ============================================================

/**
 * 請求書明細行
 */
export interface InvoiceItem {
	/** 日付（自由記述: "1月31日", "1月分", "1/1〜1/31" など） */
	date: string;
	/** 品目・詳細 */
	description: string;
	/** 数量 */
	quantity: number;
	/** 単価 */
	unitPrice: number;
	/** 金額（quantity × unitPrice で自動計算） */
	amount: number;
	/** 税率（10 or 8） */
	taxRate: 10 | 8;
}

// ============================================================
// 請求書
// ============================================================

/**
 * 請求書ステータス
 */
export type InvoiceStatus = 'draft' | 'issued' | 'paid';

/**
 * 請求書
 */
export interface Invoice {
	/** 一意識別子（UUID） */
	id: string;
	/** 請求書番号（例: "14104"） */
	invoiceNumber: string;
	/** 発行日（ISO形式: "2026-01-31"） */
	issueDate: string;
	/** 支払期限（ISO形式: "2026-03-06"） */
	dueDate: string;
	/** 取引先ID */
	vendorId: string;

	/** 明細行 */
	items: InvoiceItem[];

	/** 税抜合計（自動計算） */
	subtotal: number;
	/** 消費税合計（自動計算） */
	taxAmount: number;
	/** 税込合計（自動計算） */
	total: number;

	/** 税率別内訳（10%対象、8%対象） */
	taxBreakdown: {
		/** 10%対象（税抜） */
		taxable10: number;
		/** 10%消費税 */
		tax10: number;
		/** 8%対象（税抜） */
		taxable8: number;
		/** 8%消費税 */
		tax8: number;
	};

	/** ステータス */
	status: InvoiceStatus;
	/** 備考 */
	note?: string;
	/** 連携した仕訳ID（売掛金計上時） */
	journalId?: string;

	/** 作成日時 */
	createdAt: string;
	/** 更新日時 */
	updatedAt: string;
}

// ============================================================
// 取引先（拡張版）
// ============================================================

/**
 * 取引先
 * 既存のVendor型を拡張し、請求書に必要な情報を追加
 */
export interface Vendor {
	/** 一意識別子（UUID） */
	id: string;
	/** 取引先名（例: "株式会社ヘルスベイシス"） */
	name: string;
	/** 住所（任意） */
	address?: string;
	/** 支払条件（例: "月末締め翌月末払い"） */
	paymentTerms?: string;
	/** 備考 */
	note?: string;
	/** 作成日時 */
	createdAt: string;
	/** 更新日時 */
	updatedAt: string;
}

// ============================================================
// 事業者情報（請求書の発行元）
// ============================================================

/**
 * 事業者情報
 * 請求書に印字する自分の情報
 * settingsテーブルに保存
 */
export interface BusinessInfo {
	/** 氏名・屋号 */
	name: string;
	/** 郵便番号 */
	postalCode?: string;
	/** 住所 */
	address?: string;
	/** 電話番号 */
	phone?: string;
	/** メールアドレス */
	email?: string;
	/** 適格請求書発行事業者登録番号（T + 13桁） */
	invoiceRegistrationNumber?: string;
	/** 振込先銀行名 */
	bankName?: string;
	/** 振込先支店名 */
	bankBranch?: string;
	/** 口座種別 */
	accountType?: '普通' | '当座';
	/** 口座番号 */
	accountNumber?: string;
	/** 口座名義 */
	accountHolder?: string;
	/** 印影画像（Base64） */
	sealImage?: string;
}

// ============================================================
// ユーティリティ型
// ============================================================

/**
 * 請求書作成時の入力データ
 */
export type InvoiceInput = Omit<
	Invoice,
	'id' | 'subtotal' | 'taxAmount' | 'total' | 'taxBreakdown' | 'createdAt' | 'updatedAt'
>;

/**
 * 請求書更新時の入力データ
 */
export type InvoiceUpdate = Partial<Omit<Invoice, 'id' | 'createdAt'>>;

/**
 * 取引先作成時の入力データ
 */
export type VendorInput = Omit<Vendor, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * 取引先更新時の入力データ
 */
export type VendorUpdate = Partial<Omit<Vendor, 'id' | 'createdAt'>>;
