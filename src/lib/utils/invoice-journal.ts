/**
 * 請求書から仕訳を生成するユーティリティ
 */

import type { Invoice } from '$lib/types/invoice';
import type { JournalEntry, JournalLine, Vendor } from '$lib/types';

/**
 * 売掛金仕訳を生成（請求書発行時）
 *
 * 借方: 売掛金（税込合計）
 * 貸方: 売上高（税率別）
 *
 * @param invoice 請求書
 * @param vendor 取引先
 * @returns 仕訳データ（ID、タイムスタンプを除く）
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
		description: `請求書 ${invoice.invoiceNumber}`,
		evidenceStatus: 'digital',
		attachments: []
	};
}

/**
 * 入金仕訳を生成（入金時）
 *
 * 借方: 普通預金（税込合計）
 * 貸方: 売掛金（税込合計）
 *
 * @param invoice 請求書
 * @param vendor 取引先
 * @param depositDate 入金日（YYYY-MM-DD）
 * @param bankAccountCode 入金先の勘定科目コード（デフォルト: 普通預金）
 * @returns 仕訳データ（ID、タイムスタンプを除く）
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
		description: `入金 請求書 ${invoice.invoiceNumber}`,
		evidenceStatus: 'none',
		attachments: []
	};
}
