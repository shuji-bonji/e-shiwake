import { describe, it, expect } from 'vitest';
import {
	getTaxRateFromCategory,
	isTaxable,
	isSalesCategory,
	isPurchaseCategory,
	calculateTaxExcluded,
	calculateTaxAmount,
	calculateTaxIncluded,
	calculateTaxSummary,
	getSimplifiedTaxRate,
	calculateSimplifiedTax
} from './tax';
import type { JournalLine, TaxCategory } from '$lib/types';

describe('getTaxRateFromCategory', () => {
	it('10%の売上は10を返す', () => {
		expect(getTaxRateFromCategory('sales_10')).toBe(10);
	});

	it('10%の仕入は10を返す', () => {
		expect(getTaxRateFromCategory('purchase_10')).toBe(10);
	});

	it('8%の売上は8を返す', () => {
		expect(getTaxRateFromCategory('sales_8')).toBe(8);
	});

	it('8%の仕入は8を返す', () => {
		expect(getTaxRateFromCategory('purchase_8')).toBe(8);
	});

	it('非課税は0を返す', () => {
		expect(getTaxRateFromCategory('exempt')).toBe(0);
	});

	it('不課税は0を返す', () => {
		expect(getTaxRateFromCategory('out_of_scope')).toBe(0);
	});

	it('対象外は0を返す', () => {
		expect(getTaxRateFromCategory('na')).toBe(0);
	});

	it('undefinedは0を返す', () => {
		expect(getTaxRateFromCategory(undefined)).toBe(0);
	});
});

describe('isTaxable', () => {
	it('課税売上10%はtrue', () => {
		expect(isTaxable('sales_10')).toBe(true);
	});

	it('課税仕入10%はtrue', () => {
		expect(isTaxable('purchase_10')).toBe(true);
	});

	it('課税売上8%はtrue', () => {
		expect(isTaxable('sales_8')).toBe(true);
	});

	it('課税仕入8%はtrue', () => {
		expect(isTaxable('purchase_8')).toBe(true);
	});

	it('非課税はfalse', () => {
		expect(isTaxable('exempt')).toBe(false);
	});

	it('不課税はfalse', () => {
		expect(isTaxable('out_of_scope')).toBe(false);
	});

	it('対象外はfalse', () => {
		expect(isTaxable('na')).toBe(false);
	});
});

describe('isSalesCategory', () => {
	it('sales_10はtrue', () => {
		expect(isSalesCategory('sales_10')).toBe(true);
	});

	it('sales_8はtrue', () => {
		expect(isSalesCategory('sales_8')).toBe(true);
	});

	it('purchase_10はfalse', () => {
		expect(isSalesCategory('purchase_10')).toBe(false);
	});
});

describe('isPurchaseCategory', () => {
	it('purchase_10はtrue', () => {
		expect(isPurchaseCategory('purchase_10')).toBe(true);
	});

	it('purchase_8はtrue', () => {
		expect(isPurchaseCategory('purchase_8')).toBe(true);
	});

	it('sales_10はfalse', () => {
		expect(isPurchaseCategory('sales_10')).toBe(false);
	});
});

describe('calculateTaxExcluded', () => {
	it('11,000円（税込10%）から税抜10,000円を計算', () => {
		expect(calculateTaxExcluded(11000, 10)).toBe(10000);
	});

	it('10,800円（税込8%）から税抜10,000円を計算', () => {
		expect(calculateTaxExcluded(10800, 8)).toBe(10000);
	});

	it('税率0%は同じ金額を返す', () => {
		expect(calculateTaxExcluded(10000, 0)).toBe(10000);
	});

	it('端数は切り捨て（10%の場合）', () => {
		// 整数演算により浮動小数点誤差なし: 1100 * 100 / 110 = 1000
		expect(calculateTaxExcluded(1100, 10)).toBe(1000);

		// 1,234円 → 税抜 1121円（切り捨て）
		expect(calculateTaxExcluded(1234, 10)).toBe(1121);
	});

	it('端数は切り捨て（8%の場合）', () => {
		// 整数演算により浮動小数点誤差なし: 1080 * 100 / 108 = 1000
		expect(calculateTaxExcluded(1080, 8)).toBe(1000);

		// 1,234円 → 税抜 1142円（切り捨て）
		expect(calculateTaxExcluded(1234, 8)).toBe(1142);
	});

	it('66,000円（税込10%）の浮動小数点問題が解消されている', () => {
		// Issue #26: 66000 / 1.1 = 59999.999... だが、整数演算で正しく60000になる
		expect(calculateTaxExcluded(66000, 10)).toBe(60000);
	});
});

describe('calculateTaxAmount', () => {
	it('11,000円（税込10%）から消費税1,000円を計算', () => {
		expect(calculateTaxAmount(11000, 10)).toBe(1000);
	});

	it('10,800円（税込8%）から消費税800円を計算', () => {
		expect(calculateTaxAmount(10800, 8)).toBe(800);
	});

	it('税率0%は0円', () => {
		expect(calculateTaxAmount(10000, 0)).toBe(0);
	});
});

describe('calculateTaxIncluded', () => {
	it('税抜10,000円（10%）から税込11,000円を計算', () => {
		expect(calculateTaxIncluded(10000, 10)).toBe(11000);
	});

	it('税抜10,000円（8%）から税込10,800円を計算', () => {
		expect(calculateTaxIncluded(10000, 8)).toBe(10800);
	});

	it('税率0%は同じ金額を返す', () => {
		expect(calculateTaxIncluded(10000, 0)).toBe(10000);
	});
});

describe('calculateTaxSummary', () => {
	const createLine = (
		type: 'debit' | 'credit',
		amount: number,
		taxCategory: TaxCategory
	): JournalLine => ({
		id: crypto.randomUUID(),
		type,
		accountCode: '1001',
		amount,
		taxCategory
	});

	it('売上10%の集計', () => {
		const lines: JournalLine[] = [createLine('credit', 11000, 'sales_10')];

		const summary = calculateTaxSummary(lines);

		expect(summary.sales10TaxIncluded).toBe(11000);
		expect(summary.sales10TaxExcluded).toBe(10000);
		expect(summary.sales10Tax).toBe(1000);
	});

	it('仕入10%の集計', () => {
		const lines: JournalLine[] = [createLine('debit', 5500, 'purchase_10')];

		const summary = calculateTaxSummary(lines);

		expect(summary.purchase10TaxIncluded).toBe(5500);
		expect(summary.purchase10TaxExcluded).toBe(5000);
		expect(summary.purchase10Tax).toBe(500);
	});

	it('売上8%（軽減税率）の集計', () => {
		const lines: JournalLine[] = [createLine('credit', 10800, 'sales_8')];

		const summary = calculateTaxSummary(lines);

		expect(summary.sales8TaxIncluded).toBe(10800);
		expect(summary.sales8TaxExcluded).toBe(10000);
		expect(summary.sales8Tax).toBe(800);
	});

	it('仕入8%（軽減税率）の集計', () => {
		const lines: JournalLine[] = [createLine('debit', 2160, 'purchase_8')];

		const summary = calculateTaxSummary(lines);

		expect(summary.purchase8TaxIncluded).toBe(2160);
		// 整数演算により正確: 2160 * 100 / 108 = 2000
		expect(summary.purchase8TaxExcluded).toBe(2000);
		expect(summary.purchase8Tax).toBe(160);
	});

	it('複数行の集計', () => {
		const lines: JournalLine[] = [
			createLine('credit', 11000, 'sales_10'), // 売上10%
			createLine('credit', 10800, 'sales_8'), // 売上8%
			createLine('debit', 5500, 'purchase_10'), // 仕入10%
			createLine('debit', 2160, 'purchase_8') // 仕入8%
		];

		const summary = calculateTaxSummary(lines);

		expect(summary.totalSalesTax).toBe(1800); // 1000 + 800
		expect(summary.totalPurchaseTax).toBe(660); // 500 + 160
		expect(summary.netTax).toBe(1140); // 1800 - 660
	});

	it('Issue #26: 複数行の売上で消費税が正しく計算される（割戻し計算）', () => {
		// 売上 99,000 + 66,000 = 165,000（税込10%）
		// 行ごとに計算すると: 9,000 + 6,001 = 15,001（誤り）
		// 合計から計算すると: 165,000 - floor(165,000 * 100 / 110) = 15,000（正しい）
		const lines: JournalLine[] = [
			createLine('credit', 99000, 'sales_10'),
			createLine('credit', 66000, 'sales_10')
		];

		const summary = calculateTaxSummary(lines);

		expect(summary.sales10TaxIncluded).toBe(165000);
		expect(summary.sales10TaxExcluded).toBe(150000);
		expect(summary.sales10Tax).toBe(15000); // 15,001ではなく15,000
		expect(summary.totalSalesTax).toBe(15000);
	});

	it('多数の行でも端数が蓄積しない', () => {
		// 33,001円 × 4行 + 32,996円 = 165,000（税込10%）
		const lines: JournalLine[] = [
			createLine('debit', 33001, 'purchase_10'),
			createLine('debit', 33001, 'purchase_10'),
			createLine('debit', 33001, 'purchase_10'),
			createLine('debit', 33001, 'purchase_10'),
			createLine('debit', 32996, 'purchase_10')
		];

		const summary = calculateTaxSummary(lines);

		expect(summary.purchase10TaxIncluded).toBe(165000);
		expect(summary.purchase10TaxExcluded).toBe(150000);
		expect(summary.purchase10Tax).toBe(15000);
	});

	it('非課税・不課税の集計', () => {
		const lines: JournalLine[] = [
			createLine('credit', 50000, 'exempt'), // 非課税売上
			createLine('debit', 10000, 'exempt'), // 非課税仕入
			createLine('credit', 20000, 'out_of_scope'), // 不課税売上
			createLine('debit', 5000, 'out_of_scope') // 不課税仕入
		];

		const summary = calculateTaxSummary(lines);

		expect(summary.exemptSales).toBe(50000);
		expect(summary.exemptPurchase).toBe(10000);
		expect(summary.outOfScopeSales).toBe(20000);
		expect(summary.outOfScopePurchase).toBe(5000);
		expect(summary.totalSalesTax).toBe(0);
		expect(summary.totalPurchaseTax).toBe(0);
	});

	it('taxCategoryがundefinedの行はスキップ', () => {
		const lines: JournalLine[] = [
			{
				id: crypto.randomUUID(),
				type: 'debit',
				accountCode: '1001',
				amount: 10000
			}
		];

		const summary = calculateTaxSummary(lines);

		expect(summary.sales10TaxIncluded).toBe(0);
		expect(summary.purchase10TaxIncluded).toBe(0);
	});
});

describe('getSimplifiedTaxRate', () => {
	it('卸売業は90%', () => {
		expect(getSimplifiedTaxRate('wholesale')).toBe(90);
	});

	it('小売業は80%', () => {
		expect(getSimplifiedTaxRate('retail')).toBe(80);
	});

	it('製造業は70%', () => {
		expect(getSimplifiedTaxRate('manufacturing')).toBe(70);
	});

	it('その他は60%', () => {
		expect(getSimplifiedTaxRate('other')).toBe(60);
	});

	it('サービス業は50%', () => {
		expect(getSimplifiedTaxRate('services')).toBe(50);
	});

	it('不動産業は40%', () => {
		expect(getSimplifiedTaxRate('realestate')).toBe(40);
	});
});

describe('calculateSimplifiedTax', () => {
	it('サービス業（みなし仕入率50%）の簡易課税計算', () => {
		// 税込売上 1,100,000円
		const result = calculateSimplifiedTax(1100000, 'services');

		// 整数演算により正確な計算
		expect(result.salesTax).toBe(100000);
		expect(result.deemedPurchaseTax).toBe(50000);
		expect(result.netTax).toBe(50000);
	});

	it('小売業（みなし仕入率80%）の簡易課税計算', () => {
		// 税込売上 1,100,000円
		const result = calculateSimplifiedTax(1100000, 'retail');

		// 整数演算により正確な計算
		expect(result.salesTax).toBe(100000);
		expect(result.deemedPurchaseTax).toBe(80000);
		expect(result.netTax).toBe(20000);
	});
});
