/**
 * 請求書から仕訳を生成するユーティリティ
 */

import type { Invoice } from '$lib/types/invoice';
import { formatCurrency } from '$lib/utils/invoice';
import type { JournalEntry, JournalLine, Vendor } from '$lib/types';

/** 売掛金仕訳の摘要（請求書番号を含む） */
export function salesJournalDescription(invoiceNumber: string): string {
	return `売掛金計上 ${invoiceNumber}`;
}

/** 入金仕訳の摘要（請求書番号を含む） */
export function depositJournalDescription(invoiceNumber: string): string {
	return `入金 ${invoiceNumber}`;
}

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
		description: salesJournalDescription(invoice.invoiceNumber),
		evidenceStatus: 'digital',
		attachments: [],
		invoiceId: invoice.id,
		generatedFrom: 'invoice'
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
	bankAccountCode: string = '1003', // 普通預金
	amount: number = invoice.total // 入金額（分割入金の場合は税込合計より少ない）
): Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'> {
	return {
		date: depositDate,
		lines: [
			{
				id: crypto.randomUUID(),
				type: 'debit',
				accountCode: bankAccountCode,
				amount,
				taxCategory: 'na'
			},
			{
				id: crypto.randomUUID(),
				type: 'credit',
				accountCode: '1005', // 売掛金
				amount,
				taxCategory: 'na'
			}
		],
		vendor: vendor.name,
		description: depositJournalDescription(invoice.invoiceNumber),
		evidenceStatus: 'none',
		attachments: [],
		invoiceId: invoice.id
	};
}

/**
 * 売掛金仕訳と請求書の不一致 1 件
 */
export interface SalesJournalDiff {
	/** 不一致の項目 */
	field: 'date' | 'vendor' | 'description' | 'lines';
	/** 表示用ラベル */
	label: string;
	/** 仕訳側の現在値 */
	journalValue: string;
	/** 請求書から作り直した場合の値 */
	invoiceValue: string;
}

/** 仕訳明細行を比較用の文字列にする（行 ID は無視し、順序にも依存しない） */
function linesSignature(lines: JournalLine[]): string {
	return lines
		.map((l) => `${l.type}:${l.accountCode}:${l.amount}:${l.taxCategory ?? ''}`)
		.sort()
		.join('|');
}

/** 請求書由来の仕訳で使う勘定科目の表示名 */
const ACCOUNT_NAMES: Record<string, string> = {
	'1003': '普通預金',
	'1005': '売掛金',
	'4001': '売上高'
};

/** 仕訳明細行を表示用の文字列にする（例: "借方 110,000 / 貸方 売上高 110,000"） */
function linesSummary(lines: JournalLine[]): string {
	const debit = lines.filter((l) => l.type === 'debit').reduce((s, l) => s + l.amount, 0);
	const credits = lines
		.filter((l) => l.type === 'credit')
		.map((l) => `${ACCOUNT_NAMES[l.accountCode] ?? l.accountCode} ${formatCurrency(l.amount)}`)
		.join(', ');
	return `借方 ${formatCurrency(debit)} / 貸方 ${credits}`;
}

/**
 * 作成済みの売掛金仕訳と、請求書の現在の内容から作り直した仕訳を比べ、不一致の項目を返す
 *
 * 比較するのは date / vendor / description / lines（行 ID は無視）。摘要は請求書番号を含んでいれば一致とみなす。
 * 証憑や evidenceStatus は請求書から作られる項目ではないため比較しない。
 *
 * @returns 不一致がなければ空配列
 */
export function compareSalesJournal(
	invoice: Invoice,
	vendor: Vendor,
	journal: Pick<JournalEntry, 'date' | 'vendor' | 'description' | 'lines'>
): SalesJournalDiff[] {
	const expected = generateSalesJournal(invoice, vendor);
	const diffs: SalesJournalDiff[] = [];

	if (journal.date !== expected.date) {
		diffs.push({
			field: 'date',
			label: '日付',
			journalValue: journal.date,
			invoiceValue: expected.date
		});
	}
	if (journal.vendor !== expected.vendor) {
		diffs.push({
			field: 'vendor',
			label: '取引先',
			journalValue: journal.vendor,
			invoiceValue: expected.vendor
		});
	}
	// 摘要は請求書番号を含んでいれば一致とみなす（手で「9月分」などを足した摘要を不一致にしない）
	if (
		journal.description !== expected.description &&
		!journal.description.includes(invoice.invoiceNumber)
	) {
		diffs.push({
			field: 'description',
			label: '摘要',
			journalValue: journal.description,
			invoiceValue: expected.description
		});
	}
	if (linesSignature(journal.lines) !== linesSignature(expected.lines)) {
		diffs.push({
			field: 'lines',
			label: '金額',
			journalValue: linesSummary(journal.lines),
			invoiceValue: linesSummary(expected.lines)
		});
	}
	return diffs;
}

/**
 * 請求書の現在の内容で売掛金仕訳を上書きするための更新データを返す
 *
 * 証憑（attachments）や evidenceStatus は含めないので、updateJournal() に渡しても保持される。
 */
export function buildSalesJournalUpdate(
	invoice: Invoice,
	vendor: Vendor
): Pick<JournalEntry, 'date' | 'vendor' | 'description' | 'lines'> {
	const { date, vendor: vendorName, description, lines } = generateSalesJournal(invoice, vendor);
	return { date, vendor: vendorName, description, lines };
}
