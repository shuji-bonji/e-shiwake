/**
 * 消費税計算ユーティリティ
 *
 * 税込経理方式を前提とした消費税計算のヘルパー関数群。
 * 日本の消費税制度（標準税率10%・軽減税率8%）に対応し、
 * 課税売上/仕入、非課税、不課税、対象外の区分管理を行う。
 *
 * 主な計算方式:
 * - 割戻し計算: 税込合計 → 税抜金額・税額を逆算（端数切り捨て）
 * - 整数演算: 浮動小数点誤差を回避するため、分子を先に乗算
 *
 * @see Issue #26 - 浮動小数点誤差と端数蓄積の修正
 */

import type { TaxCategory, TaxRate, JournalLine } from '$lib/types';

/**
 * 税区分（TaxCategory）から対応する税率を取得する。
 *
 * @param category - 消費税区分（undefined の場合は非課税扱い）
 * @returns 税率（10 / 8 / 0）
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
 * 税区分が課税対象（10%または8%）かどうかを判定する。
 *
 * @param category - 消費税区分
 * @returns 課税売上/仕入のいずれかであれば true
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
 * 税区分が課税売上（sales_10 / sales_8）かどうかを判定する。
 *
 * @param category - 消費税区分
 * @returns 課税売上であれば true
 */
export function isSalesCategory(category: TaxCategory | undefined): boolean {
	if (!category) return false;
	return category === 'sales_10' || category === 'sales_8';
}

/**
 * 税区分が課税仕入（purchase_10 / purchase_8）かどうかを判定する。
 *
 * @param category - 消費税区分
 * @returns 課税仕入であれば true
 */
export function isPurchaseCategory(category: TaxCategory | undefined): boolean {
	if (!category) return false;
	return category === 'purchase_10' || category === 'purchase_8';
}

/**
 * 税込金額から税抜金額を逆算する（割戻し計算）。
 *
 * 計算式: floor(税込金額 × 100 ÷ (100 + 税率))
 * 浮動小数点誤差を避けるため、分子を先に乗算する整数演算方式を採用。
 *
 * @param taxIncludedAmount - 税込金額（円）
 * @param rate - 税率（10 / 8 / 0）
 * @returns 税抜金額（端数切り捨て）
 *
 * @example
 * calculateTaxExcluded(11000, 10) // => 10000
 * calculateTaxExcluded(1080, 8)   // => 1000
 */
export function calculateTaxExcluded(taxIncludedAmount: number, rate: TaxRate): number {
	if (rate === 0) return taxIncludedAmount;
	return Math.floor((taxIncludedAmount * 100) / (100 + rate));
}

/**
 * 税込金額から消費税額を計算する。
 *
 * 計算式: 税込金額 - 税抜金額（calculateTaxExcluded の結果）
 * 税抜→税額の順で計算することで、端数の一貫性を保証する。
 *
 * @param taxIncludedAmount - 税込金額（円）
 * @param rate - 税率（10 / 8 / 0）
 * @returns 消費税額（端数切り捨て）
 */
export function calculateTaxAmount(taxIncludedAmount: number, rate: TaxRate): number {
	if (rate === 0) return 0;
	const taxExcluded = calculateTaxExcluded(taxIncludedAmount, rate);
	return taxIncludedAmount - taxExcluded;
}

/**
 * 税抜金額から税込金額を計算する。
 *
 * @param taxExcludedAmount - 税抜金額（円）
 * @param rate - 税率（10 / 8 / 0）
 * @returns 税込金額（端数切り捨て）
 */
export function calculateTaxIncluded(taxExcludedAmount: number, rate: TaxRate): number {
	if (rate === 0) return taxExcludedAmount;
	return Math.floor(taxExcludedAmount * (1 + rate / 100));
}

/**
 * 仕訳行から税込金額の合計を計算する（カテゴリでフィルタ可能）。
 *
 * @param lines - 仕訳明細行の配列
 * @param categoryFilter - 税区分のフィルタ関数（省略時は全課税対象）
 * @returns 条件に合致する行の金額合計
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
 * 仕訳行から消費税額の合計を計算する（カテゴリでフィルタ可能）。
 *
 * 各行の税率に基づいて消費税額を個別計算し、合算する。
 * ※年間集計には calculateTaxSummary() の割戻し方式を推奨。
 *
 * @param lines - 仕訳明細行の配列
 * @param categoryFilter - 税区分のフィルタ関数（省略時は全課税対象）
 * @returns 条件に合致する行の消費税額合計
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
 * 税率別の課税売上・仕入集計データ
 *
 * 10%と8%（軽減税率）ごとに税込・税抜・税額を保持し、
 * 非課税・不課税の金額も別途集計する。
 * netTax（納付税額）= 売上消費税合計 - 仕入消費税合計。
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
 * 仕訳行から税率別の消費税集計を作成する（割戻し計算方式）。
 *
 * 処理の流れ:
 * 1. 税込合計を税区分ごとに集計（sales_10, sales_8, purchase_10, purchase_8, exempt, out_of_scope）
 * 2. 税込合計から税抜金額・税額を一括で割戻し計算
 *
 * この方式は、行ごとに個別計算して合算する積上げ方式と比べて
 * Math.floor() の端数蓄積を防ぐ利点がある。
 *
 * @param lines - 仕訳明細行の配列（全年度・全仕訳の行を渡す）
 * @returns 税率別集計データ（税込・税抜・税額・納付税額）
 *
 * @see Issue #26 - 端数蓄積による消費税計算誤差の修正
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

	// Step 1: 税込合計を税区分ごとに集計
	for (const line of lines) {
		if (!line.taxCategory) continue;

		const amount = line.amount;

		switch (line.taxCategory) {
			case 'sales_10':
				summary.sales10TaxIncluded += amount;
				break;
			case 'sales_8':
				summary.sales8TaxIncluded += amount;
				break;
			case 'purchase_10':
				summary.purchase10TaxIncluded += amount;
				break;
			case 'purchase_8':
				summary.purchase8TaxIncluded += amount;
				break;
			case 'exempt':
				if (line.type === 'credit') {
					summary.exemptSales += amount;
				} else {
					summary.exemptPurchase += amount;
				}
				break;
			case 'out_of_scope':
				if (line.type === 'credit') {
					summary.outOfScopeSales += amount;
				} else {
					summary.outOfScopePurchase += amount;
				}
				break;
		}
	}

	// Step 2: 税込合計から税抜・税額を割戻し計算（端数の蓄積を防ぐ）
	summary.sales10TaxExcluded = calculateTaxExcluded(summary.sales10TaxIncluded, 10);
	summary.sales10Tax = calculateTaxAmount(summary.sales10TaxIncluded, 10);

	summary.sales8TaxExcluded = calculateTaxExcluded(summary.sales8TaxIncluded, 8);
	summary.sales8Tax = calculateTaxAmount(summary.sales8TaxIncluded, 8);

	summary.purchase10TaxExcluded = calculateTaxExcluded(summary.purchase10TaxIncluded, 10);
	summary.purchase10Tax = calculateTaxAmount(summary.purchase10TaxIncluded, 10);

	summary.purchase8TaxExcluded = calculateTaxExcluded(summary.purchase8TaxIncluded, 8);
	summary.purchase8Tax = calculateTaxAmount(summary.purchase8TaxIncluded, 8);

	// 合計を計算
	summary.totalSalesTax = summary.sales10Tax + summary.sales8Tax;
	summary.totalPurchaseTax = summary.purchase10Tax + summary.purchase8Tax;
	summary.netTax = summary.totalSalesTax - summary.totalPurchaseTax;

	return summary;
}

/**
 * 年間の消費税集計を行う（calculateTaxSummary のエイリアス）。
 *
 * 消費税集計ページ（/tax-summary）で使用される。
 * 内部的には calculateTaxSummary() をそのまま呼び出す。
 *
 * @param allLines - 対象年度の全仕訳明細行
 * @returns 税率別集計データ
 */
export function calculateAnnualTaxSummary(allLines: JournalLine[]): TaxSummary {
	return calculateTaxSummary(allLines);
}

/**
 * 簡易課税制度の事業区分（第1種〜第6種）
 *
 * 基準期間の課税売上高が5,000万円以下の事業者が選択可能。
 * 事業区分ごとに異なるみなし仕入率が適用される。
 */
export type BusinessCategory =
	| 'wholesale'
	| 'retail'
	| 'manufacturing'
	| 'other'
	| 'services'
	| 'realestate';

/**
 * 事業区分に応じたみなし仕入率（%）を取得する。
 *
 * @param category - 事業区分
 * @returns みなし仕入率（90〜40%）
 */
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
 * 簡易課税方式による納付税額を計算する。
 *
 * 売上の消費税額にみなし仕入率を掛けて仕入税額控除額とし、
 * 差額を納付税額として返す。実際の仕入額は使用しない。
 *
 * @param salesTaxIncluded - 課税売上の税込合計
 * @param businessCategory - 事業区分（みなし仕入率の決定に使用）
 * @returns 売上消費税・みなし仕入税額・納付税額
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
