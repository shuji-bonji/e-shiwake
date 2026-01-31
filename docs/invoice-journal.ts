/**
 * 請求書から売掛金仕訳を生成するユーティリティ
 * e-shiwake Phase 4: 請求書機能
 */

import type { Invoice, Vendor } from './invoice-types';

// 仮の型定義（実際は既存の types から import）
interface JournalLine {
	side: 'debit' | 'credit';
	accountCode: string;
	amount: number;
	taxCategory?: string;
}

interface JournalEntry {
	id: string;
	date: string;
	lines: JournalLine[];
	vendor?: string;
	description?: string;
	evidenceStatus: 'none' | 'paper' | 'electronic';
	attachments: unknown[];
	createdAt: string;
	updatedAt: string;
}

// ============================================================
// 勘定科目コード（デフォルト）
// ============================================================

const ACCOUNT_CODES = {
	/** 売掛金 */
	ACCOUNTS_RECEIVABLE: '1003',
	/** 売上高 */
	SALES: '4001',
	/** 仮受消費税 */
	CONSUMPTION_TAX_PAYABLE: '2101'
} as const;

// ============================================================
// 仕訳生成関数
// ============================================================

/**
 * 請求書から売掛金計上仕訳を生成
 *
 * 仕訳パターン:
 * 借方: 売掛金（税込金額）
 * 貸方: 売上高（税抜金額） + 仮受消費税（税額）
 *
 * @param invoice 請求書
 * @param vendor 取引先
 * @returns 仕訳データ（idとタイムスタンプは別途付与）
 */
export function generateSalesJournal(
	invoice: Invoice,
	vendor: Vendor
): Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'> {
	const lines: JournalLine[] = [];

	// 借方: 売掛金（税込合計）
	lines.push({
		side: 'debit',
		accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
		amount: invoice.total
	});

	// 貸方: 売上高（税抜合計）
	// 10%対象と8%対象を分けて計上する場合
	if (invoice.taxBreakdown.taxable10 > 0) {
		lines.push({
			side: 'credit',
			accountCode: ACCOUNT_CODES.SALES,
			amount: invoice.taxBreakdown.taxable10,
			taxCategory: 'sales_10' // 課税売上10%
		});
	}

	if (invoice.taxBreakdown.taxable8 > 0) {
		lines.push({
			side: 'credit',
			accountCode: ACCOUNT_CODES.SALES,
			amount: invoice.taxBreakdown.taxable8,
			taxCategory: 'sales_8' // 課税売上8%（軽減税率）
		});
	}

	// 貸方: 仮受消費税
	if (invoice.taxAmount > 0) {
		lines.push({
			side: 'credit',
			accountCode: ACCOUNT_CODES.CONSUMPTION_TAX_PAYABLE,
			amount: invoice.taxAmount
		});
	}

	return {
		date: invoice.issueDate,
		lines,
		vendor: vendor.name,
		description: `請求書 No.${invoice.invoiceNumber}`,
		evidenceStatus: 'electronic', // 請求書PDFを証憑として紐付け想定
		attachments: []
	};
}

/**
 * 入金時の仕訳を生成
 *
 * 仕訳パターン:
 * 借方: 普通預金（入金額）
 * 貸方: 売掛金（入金額）
 *
 * @param invoice 請求書
 * @param vendor 取引先
 * @param depositDate 入金日
 * @param bankAccountCode 入金先口座の勘定科目コード（デフォルト: 普通預金）
 * @returns 仕訳データ
 */
export function generateDepositJournal(
	invoice: Invoice,
	vendor: Vendor,
	depositDate: string,
	bankAccountCode: string = '1002' // 普通預金
): Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'> {
	const lines: JournalLine[] = [
		// 借方: 普通預金
		{
			side: 'debit',
			accountCode: bankAccountCode,
			amount: invoice.total
		},
		// 貸方: 売掛金
		{
			side: 'credit',
			accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
			amount: invoice.total
		}
	];

	return {
		date: depositDate,
		lines,
		vendor: vendor.name,
		description: `入金 請求書 No.${invoice.invoiceNumber}`,
		evidenceStatus: 'none',
		attachments: []
	};
}

// ============================================================
// 税区分の判定
// ============================================================

/**
 * 消費税区分コード
 * e-shiwake の既存の TaxCategory に合わせる
 */
export const TAX_CATEGORIES = {
	/** 課税売上 10% */
	SALES_10: 'sales_10',
	/** 課税売上 8%（軽減税率） */
	SALES_8: 'sales_8',
	/** 非課税売上 */
	SALES_EXEMPT: 'sales_exempt',
	/** 不課税 */
	OUT_OF_SCOPE: 'out_of_scope'
} as const;

/**
 * 税率から税区分を判定
 */
export function getTaxCategoryFromRate(taxRate: 10 | 8): string {
	return taxRate === 10 ? TAX_CATEGORIES.SALES_10 : TAX_CATEGORIES.SALES_8;
}
