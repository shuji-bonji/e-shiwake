import type { JournalEntry, ConsumptionTaxData, ConsumptionTaxRow } from '$lib/types';
import { TaxCategoryLabels } from '$lib/types';
import { calculateTaxSummary } from './tax';
import type { BusinessInfo } from '$lib/types/blue-return-types';

/**
 * 仕訳データから消費税集計（/tax-summary ページ用）を生成する。
 *
 * 全仕訳の明細行から税率別（10%/8%）の課税売上・課税仕入を集計し、
 * 税抜金額・消費税額・納付税額（売上消費税 - 仕入消費税）を算出する。
 * 非課税・不課税の金額も参考値として含む。
 *
 * 内部的には calculateTaxSummary()（割戻し計算方式）を使用する。
 *
 * @param journals - 対象年度の仕訳一覧
 * @param fiscalYear - 会計年度（表示用）
 * @returns 消費税集計データ
 */
export function generateConsumptionTax(
	journals: JournalEntry[],
	fiscalYear: number
): ConsumptionTaxData {
	// 全仕訳行を抽出
	const allLines = journals.flatMap((j) => j.lines);

	// 税率別の集計を取得
	const summary = calculateTaxSummary(allLines);

	// 課税売上行
	const salesRows: ConsumptionTaxRow[] = [];
	if (summary.sales10TaxIncluded > 0) {
		salesRows.push({
			taxCategory: 'sales_10',
			taxCategoryLabel: TaxCategoryLabels['sales_10'],
			taxableAmount: summary.sales10TaxExcluded,
			taxAmount: summary.sales10Tax
		});
	}
	if (summary.sales8TaxIncluded > 0) {
		salesRows.push({
			taxCategory: 'sales_8',
			taxCategoryLabel: TaxCategoryLabels['sales_8'],
			taxableAmount: summary.sales8TaxExcluded,
			taxAmount: summary.sales8Tax
		});
	}

	// 課税仕入行
	const purchaseRows: ConsumptionTaxRow[] = [];
	if (summary.purchase10TaxIncluded > 0) {
		purchaseRows.push({
			taxCategory: 'purchase_10',
			taxCategoryLabel: TaxCategoryLabels['purchase_10'],
			taxableAmount: summary.purchase10TaxExcluded,
			taxAmount: summary.purchase10Tax
		});
	}
	if (summary.purchase8TaxIncluded > 0) {
		purchaseRows.push({
			taxCategory: 'purchase_8',
			taxCategoryLabel: TaxCategoryLabels['purchase_8'],
			taxableAmount: summary.purchase8TaxExcluded,
			taxAmount: summary.purchase8Tax
		});
	}

	return {
		fiscalYear,
		salesRows,
		totalTaxableSales: summary.sales10TaxExcluded + summary.sales8TaxExcluded,
		totalSalesTax: summary.totalSalesTax,
		purchaseRows,
		totalTaxablePurchases: summary.purchase10TaxExcluded + summary.purchase8TaxExcluded,
		totalPurchaseTax: summary.totalPurchaseTax,
		netTaxPayable: summary.netTax,
		exemptSales: summary.exemptSales,
		outOfScopeSales: summary.outOfScopeSales,
		exemptPurchases: summary.exemptPurchase,
		outOfScopePurchases: summary.outOfScopePurchase
	};
}

/**
 * 消費税集計用の金額フォーマット。負の値には「△」を付与する。
 *
 * @param amount - フォーマット対象の金額
 * @returns フォーマット済み文字列
 */
export function formatTaxAmount(amount: number): string {
	if (amount === 0) return '0';
	if (amount < 0) {
		return `△${Math.abs(amount).toLocaleString('ja-JP')}`;
	}
	return amount.toLocaleString('ja-JP');
}

/**
 * 消費税集計データをCSV形式の文字列に変換する。
 *
 * 課税売上→課税仕入→納付税額→非課税/不課税（参考）の順で出力。
 *
 * @param data - generateConsumptionTax() の出力
 * @returns CSV形式の文字列（改行区切り）
 */
export function consumptionTaxToCsv(data: ConsumptionTaxData): string {
	const lines: string[] = [];

	lines.push(`消費税集計表,${data.fiscalYear}年度`);
	lines.push('');

	// 課税売上
	lines.push('【課税売上】');
	lines.push('区分,税抜金額,消費税額');
	for (const row of data.salesRows) {
		lines.push(`${row.taxCategoryLabel},${row.taxableAmount},${row.taxAmount}`);
	}
	lines.push(`課税売上 合計,${data.totalTaxableSales},${data.totalSalesTax}`);
	lines.push('');

	// 課税仕入
	lines.push('【課税仕入】');
	lines.push('区分,税抜金額,消費税額');
	for (const row of data.purchaseRows) {
		lines.push(`${row.taxCategoryLabel},${row.taxableAmount},${row.taxAmount}`);
	}
	lines.push(`課税仕入 合計,${data.totalTaxablePurchases},${data.totalPurchaseTax}`);
	lines.push('');

	// 納付税額
	lines.push('【納付税額】');
	lines.push(`売上に係る消費税額,,${data.totalSalesTax}`);
	lines.push(`仕入に係る消費税額,,${data.totalPurchaseTax}`);
	lines.push(`納付すべき消費税額,,${data.netTaxPayable}`);
	lines.push('');

	// 非課税・不課税（参考）
	lines.push('【参考：非課税・不課税】');
	lines.push(`非課税売上,${data.exemptSales},`);
	lines.push(`不課税売上,${data.outOfScopeSales},`);
	lines.push(`非課税仕入,${data.exemptPurchases},`);
	lines.push(`不課税仕入,${data.outOfScopePurchases},`);

	return lines.join('\n');
}

/**
 * 免税事業者の判定（基準期間の課税売上高が1,000万円以下か）。
 *
 * 消費税法第9条に基づき、基準期間（前々年度）の課税売上高が
 * 1,000万円以下であれば消費税の納税義務が免除される。
 *
 * @param taxableSalesAmount - 基準期間の課税売上高（税抜）
 * @returns 免税事業者であれば true
 */
export function isExemptBusiness(taxableSalesAmount: number): boolean {
	return taxableSalesAmount <= 10000000;
}

/**
 * 簡易課税制度の適用可否を判定する。
 *
 * 基準期間（前々年度）の課税売上高が5,000万円以下であれば
 * 簡易課税制度を選択可能。事前届出が必要。
 *
 * @param taxableSalesAmount - 基準期間の課税売上高（税抜）
 * @returns 簡易課税を選択可能であれば true
 */
export function canUseSimplifiedTax(taxableSalesAmount: number): boolean {
	return taxableSalesAmount <= 50000000;
}

// ============================================================
// インボイス登録期間
// ============================================================

/**
 * 仕訳の日付がインボイス登録期間内かどうかを判定する。
 *
 * @param journalDate - 仕訳の日付（YYYY-MM-DD）
 * @param startDate - 登録適用開始日（YYYY-MM-DD）
 * @param endDate - 登録適用終了日（YYYY-MM-DD、省略可）
 * @returns 登録期間内であれば true
 */
export function isWithinInvoiceRegistrationPeriod(
	journalDate: string,
	startDate?: string,
	endDate?: string
): boolean {
	// 開始日未設定の場合は常に期間内（登録番号のみ設定のケース）
	if (!startDate) return true;

	if (journalDate < startDate) return false;
	if (endDate && journalDate > endDate) return false;
	return true;
}

/**
 * インボイス登録期間と会計年度の重なり状態を判定する。
 *
 * @param fiscalYear - 会計年度
 * @param businessInfo - 事業者情報
 * @returns 登録状態（'full' | 'partial' | 'none' | 'unset'）
 */
export function getInvoiceRegistrationStatus(
	fiscalYear: number,
	businessInfo?: BusinessInfo | null
): 'full' | 'partial' | 'none' | 'unset' {
	if (!businessInfo?.invoiceRegistrationNumber) return 'unset';
	if (!businessInfo.invoiceRegistrationStart) return 'full'; // 開始日未設定 → 全期間適用とみなす

	const yearStart = `${fiscalYear}-01-01`;
	const yearEnd = `${fiscalYear}-12-31`;
	const regStart = businessInfo.invoiceRegistrationStart;
	const regEnd = businessInfo.invoiceRegistrationEnd;

	// 登録期間が年度と全く重ならない
	if (regStart > yearEnd) return 'none';
	if (regEnd && regEnd < yearStart) return 'none';

	// 年度全体をカバーしている
	if (regStart <= yearStart && (!regEnd || regEnd >= yearEnd)) return 'full';

	// 部分的に重なる
	return 'partial';
}

/**
 * インボイス登録期間外に課税売上がある仕訳を検出する。
 *
 * 年度途中でインボイス登録・脱退した場合に、
 * 期間外の課税売上仕訳をリストアップして警告表示に使う。
 *
 * @param journals - 対象年度の仕訳一覧
 * @param businessInfo - 事業者情報
 * @returns 期間外に課税売上がある仕訳の一覧
 */
export function findSalesOutsideRegistrationPeriod(
	journals: JournalEntry[],
	businessInfo?: BusinessInfo | null
): JournalEntry[] {
	if (!businessInfo?.invoiceRegistrationStart) return [];

	return journals.filter((journal) => {
		// 期間外の仕訳で、課税売上の行があるか
		if (
			isWithinInvoiceRegistrationPeriod(
				journal.date,
				businessInfo.invoiceRegistrationStart,
				businessInfo.invoiceRegistrationEnd
			)
		) {
			return false;
		}

		return journal.lines.some(
			(line) => line.taxCategory === 'sales_10' || line.taxCategory === 'sales_8'
		);
	});
}
