/**
 * 請求書から仕訳を生成するユーティリティ
 */

import type { Invoice } from '$lib/types/invoice';
import type { JournalEntry, JournalLine, Vendor } from '$lib/types';

/**
 * 請求書から売掛金計上仕訳を自動生成する
 *
 * 請求書の発行時に、売掛金を計上する仕訳を自動生成する。
 * 10%と8%の異なる税率がある場合は、それぞれ独立した売上高行として生成される。
 *
 * 仕訳構造：
 * - 借方: 売掛金（税込合計額）
 * - 貸方: 売上高10%（10%対象の税込金額、該当分がある場合）
 * - 貸方: 売上高8%（8%対象の税込金額、該当分がある場合）
 *
 * @param invoice 請求書データ
 * @param vendor 取引先情報（vendor.name が仕訳の「取引先」欄に使用される）
 * @returns 生成された仕訳データ（ID、タイムスタンプを除く）
 *
 * @example
 * const invoice = {
 *   issueDate: '2025-04-04',
 *   invoiceNumber: 'INV-2025-0001',
 *   total: 11000,
 *   taxBreakdown: { taxable10: 10000, tax10: 1000, taxable8: 0, tax8: 0 }
 * };
 * const vendor = { name: 'クライアントA' };
 * const journal = generateSalesJournal(invoice, vendor);
 * // => { date: '2025-04-04', lines: [...], vendor: 'クライアントA', description: '売掛金計上 INV-2025-0001', ... }
 */
export function generateSalesJournal(
	invoice: Invoice,
	vendor: Vendor
): Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'> {
	const lines: JournalLine[] = [];

	// 借方: 売掛金（税込合計）
	lines.push({
		id: crypto.randomUUID(),
		type: 'debit',
		accountCode: '1005', // 売掛金
		amount: invoice.total,
		taxCategory: 'na'
	});

	// 貸方: 売上高（10%分）
	if (invoice.taxBreakdown.taxable10 > 0) {
		const amount10 = invoice.taxBreakdown.taxable10 + invoice.taxBreakdown.tax10;
		lines.push({
			id: crypto.randomUUID(),
			type: 'credit',
			accountCode: '4001', // 売上高
			amount: amount10,
			taxCategory: 'sales_10'
		});
	}

	// 貸方: 売上高（8%分）
	if (invoice.taxBreakdown.taxable8 > 0) {
		const amount8 = invoice.taxBreakdown.taxable8 + invoice.taxBreakdown.tax8;
		lines.push({
			id: crypto.randomUUID(),
			type: 'credit',
			accountCode: '4001', // 売上高
			amount: amount8,
			taxCategory: 'sales_8'
		});
	}

	return {
		date: invoice.issueDate,
		lines,
		vendor: vendor.name,
		description: `売掛金計上 ${invoice.invoiceNumber}`,
		evidenceStatus: 'digital',
		attachments: []
	};
}

/**
 * 入金仕訳を自動生成する
 *
 * 請求書の入金時に、売掛金から銀行口座への資金移動を仕訳として生成する。
 * この仕訳は売掛金を決済する（売掛金残高をゼロに戻す）。
 *
 * 仕訳構造：
 * - 借方: 入金先の銀行口座（通常は普通預金、指定可能）
 * - 貸方: 売掛金（売上時の逆仕訳）
 *
 * @param invoice 請求書データ
 * @param vendor 取引先情報（vendor.name が仕訳の「取引先」欄に使用される）
 * @param depositDate 入金日（YYYY-MM-DD形式）
 * @param bankAccountCode 入金先の勘定科目コード（デフォルト: '1003' = 普通預金）
 * @returns 生成された入金仕訳データ（ID、タイムスタンプを除く）
 *
 * @example
 * const invoice = { invoiceNumber: 'INV-2025-0001', total: 11000 };
 * const vendor = { name: 'クライアントA' };
 * const journal = generateDepositJournal(invoice, vendor, '2025-05-10');
 * // => {
 * //   date: '2025-05-10',
 * //   lines: [
 * //     { type: 'debit', accountCode: '1003', amount: 11000, ... },
 * //     { type: 'credit', accountCode: '1005', amount: 11000, ... }
 * //   ],
 * //   vendor: 'クライアントA',
 * //   description: '入金 INV-2025-0001',
 * //   ...
 * // }
 */
export function generateDepositJournal(
	invoice: Invoice,
	vendor: Vendor,
	depositDate: string,
	bankAccountCode: string = '1003' // 普通預金
): Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'> {
	return {
		date: depositDate,
		lines: [
			{
				id: crypto.randomUUID(),
				type: 'debit',
				accountCode: bankAccountCode,
				amount: invoice.total,
				taxCategory: 'na'
			},
			{
				id: crypto.randomUUID(),
				type: 'credit',
				accountCode: '1005', // 売掛金
				amount: invoice.total,
				taxCategory: 'na'
			}
		],
		vendor: vendor.name,
		description: `入金 ${invoice.invoiceNumber}`,
		evidenceStatus: 'none',
		attachments: []
	};
}
