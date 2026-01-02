import type { JournalEntry, ConsumptionTaxData, ConsumptionTaxRow } from '$lib/types';
import { TaxCategoryLabels } from '$lib/types';
import { calculateTaxSummary } from './tax';

/**
 * 仕訳から消費税集計データを生成
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
 * 金額をフォーマット（カンマ区切り、負の値は△表示）
 */
export function formatTaxAmount(amount: number): string {
	if (amount === 0) return '0';
	if (amount < 0) {
		return `△${Math.abs(amount).toLocaleString('ja-JP')}`;
	}
	return amount.toLocaleString('ja-JP');
}

/**
 * 消費税集計をCSV形式に変換
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
 * 免税事業者かどうかの判定用
 * 前々年度の課税売上高が1000万円以下なら免税
 */
export function isExemptBusiness(taxableSalesAmount: number): boolean {
	return taxableSalesAmount <= 10000000;
}

/**
 * 簡易課税の適用可否
 * 前々年度の課税売上高が5000万円以下なら選択可能
 */
export function canUseSimplifiedTax(taxableSalesAmount: number): boolean {
	return taxableSalesAmount <= 50000000;
}
