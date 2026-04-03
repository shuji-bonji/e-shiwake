import { describe, it, expect } from 'vitest';
import {
	isDebitBalanceType,
	getIncreaseSide,
	getDecreaseSide,
	isIncrease,
	calculateBalance,
	getAllowedTaxCategories,
	isValidTaxCategoryForAccount
} from './accounting';

describe('accounting utility types', () => {
	describe('isDebitBalanceType', () => {
		it('資産は借方残高型', () => {
			expect(isDebitBalanceType('asset')).toBe(true);
		});

		it('費用は借方残高型', () => {
			expect(isDebitBalanceType('expense')).toBe(true);
		});

		it('負債は貸方残高型', () => {
			expect(isDebitBalanceType('liability')).toBe(false);
		});

		it('純資産は貸方残高型', () => {
			expect(isDebitBalanceType('equity')).toBe(false);
		});

		it('収益は貸方残高型', () => {
			expect(isDebitBalanceType('revenue')).toBe(false);
		});
	});

	describe('getIncreaseSide / getDecreaseSide', () => {
		it('資産は借方で増加、貸方で減少', () => {
			expect(getIncreaseSide('asset')).toBe('debit');
			expect(getDecreaseSide('asset')).toBe('credit');
		});

		it('費用は借方で増加、貸方で減少', () => {
			expect(getIncreaseSide('expense')).toBe('debit');
			expect(getDecreaseSide('expense')).toBe('credit');
		});

		it('負債は貸方で増加、借方で減少', () => {
			expect(getIncreaseSide('liability')).toBe('credit');
			expect(getDecreaseSide('liability')).toBe('debit');
		});

		it('純資産は貸方で増加、借方で減少', () => {
			expect(getIncreaseSide('equity')).toBe('credit');
			expect(getDecreaseSide('equity')).toBe('debit');
		});

		it('収益は貸方で増加、借方で減少', () => {
			expect(getIncreaseSide('revenue')).toBe('credit');
			expect(getDecreaseSide('revenue')).toBe('debit');
		});
	});

	describe('isIncrease', () => {
		it('資産の借方は増加', () => {
			expect(isIncrease('asset', 'debit')).toBe(true);
		});

		it('資産の貸方は減少', () => {
			expect(isIncrease('asset', 'credit')).toBe(false);
		});

		it('収益の貸方は増加', () => {
			expect(isIncrease('revenue', 'credit')).toBe(true);
		});

		it('収益の借方は減少', () => {
			expect(isIncrease('revenue', 'debit')).toBe(false);
		});
	});

	describe('calculateBalance', () => {
		it('資産: 期首100 + 借方50 - 貸方30 = 120', () => {
			expect(calculateBalance('asset', 100, 50, 30)).toBe(120);
		});

		it('負債: 期首100 - 借方30 + 貸方50 = 120', () => {
			expect(calculateBalance('liability', 100, 30, 50)).toBe(120);
		});

		it('費用: 期首0 + 借方10000 - 貸方0 = 10000', () => {
			expect(calculateBalance('expense', 0, 10000, 0)).toBe(10000);
		});

		it('収益: 期首0 - 借方0 + 貸方50000 = 50000', () => {
			expect(calculateBalance('revenue', 0, 0, 50000)).toBe(50000);
		});
	});

	describe('getAllowedTaxCategories', () => {
		it('費用科目: 課税仕入・非課税・不課税・対象外', () => {
			const allowed = getAllowedTaxCategories('expense');
			expect(allowed).toContain('purchase_10');
			expect(allowed).toContain('purchase_8');
			expect(allowed).toContain('exempt');
			expect(allowed).toContain('out_of_scope');
			expect(allowed).toContain('na');
			// 課税売上は不可
			expect(allowed).not.toContain('sales_10');
			expect(allowed).not.toContain('sales_8');
		});

		it('収益科目: 課税売上・非課税・不課税・対象外', () => {
			const allowed = getAllowedTaxCategories('revenue');
			expect(allowed).toContain('sales_10');
			expect(allowed).toContain('sales_8');
			expect(allowed).toContain('exempt');
			expect(allowed).toContain('na');
			// 課税仕入は不可
			expect(allowed).not.toContain('purchase_10');
			expect(allowed).not.toContain('purchase_8');
		});

		it('資産科目: 課税仕入・対象外', () => {
			const allowed = getAllowedTaxCategories('asset');
			expect(allowed).toContain('purchase_10');
			expect(allowed).toContain('purchase_8');
			expect(allowed).toContain('na');
			expect(allowed).not.toContain('sales_10');
			expect(allowed).not.toContain('exempt');
		});

		it('負債科目: 対象外のみ', () => {
			expect(getAllowedTaxCategories('liability')).toEqual(['na']);
		});

		it('純資産科目: 対象外のみ', () => {
			expect(getAllowedTaxCategories('equity')).toEqual(['na']);
		});
	});

	describe('isValidTaxCategoryForAccount', () => {
		it('費用に課税仕入10%は有効', () => {
			expect(isValidTaxCategoryForAccount('expense', 'purchase_10')).toBe(true);
		});

		it('費用に課税売上10%は無効', () => {
			expect(isValidTaxCategoryForAccount('expense', 'sales_10')).toBe(false);
		});

		it('収益に課税売上10%は有効', () => {
			expect(isValidTaxCategoryForAccount('revenue', 'sales_10')).toBe(true);
		});

		it('収益に課税仕入10%は無効', () => {
			expect(isValidTaxCategoryForAccount('revenue', 'purchase_10')).toBe(false);
		});

		it('負債に対象外は有効', () => {
			expect(isValidTaxCategoryForAccount('liability', 'na')).toBe(true);
		});

		it('負債に課税仕入は無効', () => {
			expect(isValidTaxCategoryForAccount('liability', 'purchase_10')).toBe(false);
		});
	});
});
