/**
 * 消費税計算ユーティリティ
 *
 * 税込経理を前提とした計算ヘルパー関数群
 */

import type { TaxCategory, TaxRate, JournalLine } from '$lib/types';

/**
 * 税区分から税率を取得
 */
export function getTaxRateFromCategory(category: TaxCategory | undefined): TaxRate {
	if (!category) return 0;

	switch (category) {
		case 'sales_10':
		case 'purchase_10':
			return 10;
		case 'sales_8':
		case 'purchase_8':
			return 8;
		default:
			return 0;
	}
}

/**
 * 税区分が課税対象かどうか
 */
export function isTaxable(category: TaxCategory | undefined): boolean {
	if (!category) return false;
	return (
		category === 'sales_10' ||
		category === 'sales_8' ||
		category === 'purchase_10' ||
		category === 'purchase_8'
	);
}

/**
 * 税区分が売上系かどうか
 */
export function isSalesCategory(category: TaxCategory | undefined): boolean {
	if (!category) return false;
	return category === 'sales_10' || category === 'sales_8';
}

/**
 * 税区分が仕入系かどうか
 */
export function isPurchaseCategory(category: TaxCategory | undefined): boolean {
	if (!category) return false;
	return category === 'purchase_10' || category === 'purchase_8';
}

/**
 * 税込金額から税抜金額を計算
 * 端数は切り捨て
 */
export function calculateTaxExcluded(taxIncludedAmount: number, rate: TaxRate): number {
	if (rate === 0) return taxIncludedAmount;
	return Math.floor(taxIncludedAmount / (1 + rate / 100));
}

/**
 * 税込金額から消費税額を計算
 * 端数は切り捨て
 */
export function calculateTaxAmount(taxIncludedAmount: number, rate: TaxRate): number {
	if (rate === 0) return 0;
	const taxExcluded = calculateTaxExcluded(taxIncludedAmount, rate);
	return taxIncludedAmount - taxExcluded;
}

/**
 * 税抜金額から税込金額を計算
 */
export function calculateTaxIncluded(taxExcludedAmount: number, rate: TaxRate): number {
	if (rate === 0) return taxExcludedAmount;
	return Math.floor(taxExcludedAmount * (1 + rate / 100));
}

/**
 * 仕訳行から税込金額の合計を計算（カテゴリ別）
 */
export function calculateTaxIncludedByCategory(
	lines: JournalLine[],
	categoryFilter?: (category: TaxCategory) => boolean
): number {
	return lines
		.filter((line) => {
			if (!line.taxCategory) return false;
			if (!categoryFilter) return isTaxable(line.taxCategory);
			return categoryFilter(line.taxCategory);
		})
		.reduce((sum, line) => sum + line.amount, 0);
}

/**
 * 仕訳行から消費税額の合計を計算（カテゴリ別）
 */
export function calculateTotalTax(
	lines: JournalLine[],
	categoryFilter?: (category: TaxCategory) => boolean
): number {
	return lines
		.filter((line) => {
			if (!line.taxCategory) return false;
			if (!categoryFilter) return isTaxable(line.taxCategory);
			return categoryFilter(line.taxCategory);
		})
		.reduce((sum, line) => {
			const rate = getTaxRateFromCategory(line.taxCategory);
			return sum + calculateTaxAmount(line.amount, rate);
		}, 0);
}

/**
 * 税率別の課税売上・仕入を集計
 */
export interface TaxSummary {
	// 10%
	sales10TaxIncluded: number;
	sales10TaxExcluded: number;
	sales10Tax: number;
	purchase10TaxIncluded: number;
	purchase10TaxExcluded: number;
	purchase10Tax: number;
	// 8%（軽減税率）
	sales8TaxIncluded: number;
	sales8TaxExcluded: number;
	sales8Tax: number;
	purchase8TaxIncluded: number;
	purchase8TaxExcluded: number;
	purchase8Tax: number;
	// 非課税・不課税
	exemptSales: number;
	exemptPurchase: number;
	outOfScopeSales: number;
	outOfScopePurchase: number;
	// 合計
	totalSalesTax: number;
	totalPurchaseTax: number;
	netTax: number; // 納付税額（売上消費税 - 仕入消費税）
}

/**
 * 仕訳行から税率別の集計を作成
 */
export function calculateTaxSummary(lines: JournalLine[]): TaxSummary {
	const summary: TaxSummary = {
		sales10TaxIncluded: 0,
		sales10TaxExcluded: 0,
		sales10Tax: 0,
		purchase10TaxIncluded: 0,
		purchase10TaxExcluded: 0,
		purchase10Tax: 0,
		sales8TaxIncluded: 0,
		sales8TaxExcluded: 0,
		sales8Tax: 0,
		purchase8TaxIncluded: 0,
		purchase8TaxExcluded: 0,
		purchase8Tax: 0,
		exemptSales: 0,
		exemptPurchase: 0,
		outOfScopeSales: 0,
		outOfScopePurchase: 0,
		totalSalesTax: 0,
		totalPurchaseTax: 0,
		netTax: 0
	};

	for (const line of lines) {
		if (!line.taxCategory) continue;

		const amount = line.amount;
		const rate = getTaxRateFromCategory(line.taxCategory);
		const taxExcluded = calculateTaxExcluded(amount, rate);
		const tax = calculateTaxAmount(amount, rate);

		switch (line.taxCategory) {
			case 'sales_10':
				summary.sales10TaxIncluded += amount;
				summary.sales10TaxExcluded += taxExcluded;
				summary.sales10Tax += tax;
				break;
			case 'sales_8':
				summary.sales8TaxIncluded += amount;
				summary.sales8TaxExcluded += taxExcluded;
				summary.sales8Tax += tax;
				break;
			case 'purchase_10':
				summary.purchase10TaxIncluded += amount;
				summary.purchase10TaxExcluded += taxExcluded;
				summary.purchase10Tax += tax;
				break;
			case 'purchase_8':
				summary.purchase8TaxIncluded += amount;
				summary.purchase8TaxExcluded += taxExcluded;
				summary.purchase8Tax += tax;
				break;
			case 'exempt':
				// 非課税は借方/貸方で売上/仕入を判断
				if (line.type === 'credit') {
					summary.exemptSales += amount;
				} else {
					summary.exemptPurchase += amount;
				}
				break;
			case 'out_of_scope':
				// 不課税も借方/貸方で判断
				if (line.type === 'credit') {
					summary.outOfScopeSales += amount;
				} else {
					summary.outOfScopePurchase += amount;
				}
				break;
		}
	}

	// 合計を計算
	summary.totalSalesTax = summary.sales10Tax + summary.sales8Tax;
	summary.totalPurchaseTax = summary.purchase10Tax + summary.purchase8Tax;
	summary.netTax = summary.totalSalesTax - summary.totalPurchaseTax;

	return summary;
}

/**
 * 年間の消費税集計用
 * 複数の仕訳行から年間の税計算を行う
 */
export function calculateAnnualTaxSummary(allLines: JournalLine[]): TaxSummary {
	return calculateTaxSummary(allLines);
}

/**
 * 簡易課税の場合のみなし仕入率を取得
 * 事業区分によって異なる
 */
export type BusinessCategory =
	| 'wholesale'
	| 'retail'
	| 'manufacturing'
	| 'other'
	| 'services'
	| 'realestate';

export function getSimplifiedTaxRate(category: BusinessCategory): number {
	switch (category) {
		case 'wholesale':
			return 90; // 第1種: 卸売業
		case 'retail':
			return 80; // 第2種: 小売業
		case 'manufacturing':
			return 70; // 第3種: 製造業
		case 'other':
			return 60; // 第4種: その他
		case 'services':
			return 50; // 第5種: サービス業
		case 'realestate':
			return 40; // 第6種: 不動産業
		default:
			return 50;
	}
}

/**
 * 簡易課税の場合の納付税額を計算
 */
export function calculateSimplifiedTax(
	salesTaxIncluded: number,
	businessCategory: BusinessCategory
): {
	salesTax: number;
	deemedPurchaseTax: number;
	netTax: number;
} {
	const salesTaxExcluded = calculateTaxExcluded(salesTaxIncluded, 10);
	const salesTax = salesTaxIncluded - salesTaxExcluded;
	const deemedRate = getSimplifiedTaxRate(businessCategory);
	const deemedPurchaseTax = Math.floor((salesTax * deemedRate) / 100);

	return {
		salesTax,
		deemedPurchaseTax,
		netTax: salesTax - deemedPurchaseTax
	};
}
