/**
 * 会計ロジック用のユーティリティ型定義
 *
 * 複式簿記のルール（勘定科目タイプごとの増減方向、消費税区分の制約など）を
 * 型レベルで表現し、コンパイル時の安全性を向上させる。
 */

import type { AccountType, TaxCategory } from './index';

// ============================================================
// 増減方向（Debit/Credit と AccountType の関係）
// ============================================================

/**
 * 仕訳の借方・貸方
 */
export type DebitCredit = 'debit' | 'credit';

/**
 * 勘定科目タイプごとの「増加」方向
 *
 * 複式簿記の基本ルール:
 * - 資産・費用 → 借方で増加
 * - 負債・純資産・収益 → 貸方で増加
 */
export type IncreaseSide<T extends AccountType> = T extends 'asset' | 'expense'
	? 'debit'
	: 'credit';

/**
 * 勘定科目タイプごとの「減少」方向
 */
export type DecreaseSide<T extends AccountType> = T extends 'asset' | 'expense'
	? 'credit'
	: 'debit';

/**
 * 借方残高（正の残高）となる勘定科目タイプ
 */
export type DebitBalanceType = 'asset' | 'expense';

/**
 * 貸方残高（正の残高）となる勘定科目タイプ
 */
export type CreditBalanceType = 'liability' | 'equity' | 'revenue';

/**
 * 勘定科目タイプが借方残高型かどうかを判定する。
 *
 * 残高計算時の加減方向の決定に使用。
 * - true: 借方で増加、貸方で減少（資産・費用）
 * - false: 貸方で増加、借方で減少（負債・純資産・収益）
 *
 * @param type - 勘定科目タイプ
 * @returns 借方残高型であれば true
 */
export function isDebitBalanceType(type: AccountType): type is DebitBalanceType {
	return type === 'asset' || type === 'expense';
}

/**
 * 勘定科目タイプから増加方向を取得する。
 *
 * @param type - 勘定科目タイプ
 * @returns 'debit'（資産・費用）または 'credit'（負債・純資産・収益）
 */
export function getIncreaseSide(type: AccountType): DebitCredit {
	return isDebitBalanceType(type) ? 'debit' : 'credit';
}

/**
 * 勘定科目タイプから減少方向を取得する。
 *
 * @param type - 勘定科目タイプ
 * @returns 'credit'（資産・費用）または 'debit'（負債・純資産・収益）
 */
export function getDecreaseSide(type: AccountType): DebitCredit {
	return isDebitBalanceType(type) ? 'credit' : 'debit';
}

/**
 * 指定した仕訳方向が、勘定科目タイプにとって増加かどうかを判定する。
 *
 * @param type - 勘定科目タイプ
 * @param side - 借方 or 貸方
 * @returns 増加であれば true
 *
 * @example
 * isIncrease('asset', 'debit')   // true（資産の借方は増加）
 * isIncrease('asset', 'credit')  // false（資産の貸方は減少）
 * isIncrease('revenue', 'credit') // true（収益の貸方は増加）
 */
export function isIncrease(type: AccountType, side: DebitCredit): boolean {
	return getIncreaseSide(type) === side;
}

// ============================================================
// 残高計算のユーティリティ
// ============================================================

/**
 * 勘定科目タイプに基づいて残高を計算する。
 *
 * 借方残高型（資産・費用）: 残高 = 期首残高 + 借方合計 - 貸方合計
 * 貸方残高型（負債・純資産・収益）: 残高 = 期首残高 - 借方合計 + 貸方合計
 *
 * @param type - 勘定科目タイプ
 * @param openingBalance - 期首残高
 * @param debitTotal - 借方合計
 * @param creditTotal - 貸方合計
 * @returns 残高
 */
export function calculateBalance(
	type: AccountType,
	openingBalance: number,
	debitTotal: number,
	creditTotal: number
): number {
	if (isDebitBalanceType(type)) {
		return openingBalance + debitTotal - creditTotal;
	}
	return openingBalance - debitTotal + creditTotal;
}

// ============================================================
// 消費税区分の制約型
// ============================================================

/**
 * 売上系の消費税区分
 */
export type SalesTaxCategory = 'sales_10' | 'sales_8';

/**
 * 仕入系の消費税区分
 */
export type PurchaseTaxCategory = 'purchase_10' | 'purchase_8';

/**
 * 課税取引の消費税区分
 */
export type TaxableTaxCategory = SalesTaxCategory | PurchaseTaxCategory;

/**
 * 非課税・不課税・対象外の消費税区分
 */
export type NonTaxableCategory = 'exempt' | 'out_of_scope' | 'na';

/**
 * 費用科目に適用可能な消費税区分
 *
 * 費用は「課税仕入」「非課税」「不課税」「対象外」のいずれか。
 * 「課税売上」は費用に設定できない。
 */
export type ExpenseTaxCategory = PurchaseTaxCategory | NonTaxableCategory;

/**
 * 収益科目に適用可能な消費税区分
 *
 * 収益は「課税売上」「非課税」「不課税」「対象外」のいずれか。
 * 「課税仕入」は収益に設定できない。
 */
export type RevenueTaxCategory = SalesTaxCategory | NonTaxableCategory;

/**
 * 資産科目に適用可能な消費税区分
 *
 * 資産は「対象外」「課税仕入」のいずれか（固定資産取得時は課税仕入）。
 */
export type AssetTaxCategory = PurchaseTaxCategory | 'na';

/**
 * 負債・純資産科目に適用可能な消費税区分
 */
export type LiabilityEquityTaxCategory = 'na';

/**
 * 勘定科目タイプに対応する消費税区分の制約マッピング
 *
 * 型レベルで「この科目タイプにはこの消費税区分しか設定できない」を表現。
 */
export type AllowedTaxCategory<T extends AccountType> = T extends 'expense'
	? ExpenseTaxCategory
	: T extends 'revenue'
		? RevenueTaxCategory
		: T extends 'asset'
			? AssetTaxCategory
			: LiabilityEquityTaxCategory;

/**
 * 勘定科目タイプに応じて、許可される消費税区分の配列を返す。
 *
 * 勘定科目管理画面でのデフォルト消費税区分選択や、
 * 仕訳入力時の消費税区分バリデーションに使用。
 *
 * @param accountType - 勘定科目タイプ
 * @returns 許可される消費税区分の配列
 */
export function getAllowedTaxCategories(accountType: AccountType): TaxCategory[] {
	switch (accountType) {
		case 'expense':
			return ['purchase_10', 'purchase_8', 'exempt', 'out_of_scope', 'na'];
		case 'revenue':
			return ['sales_10', 'sales_8', 'exempt', 'out_of_scope', 'na'];
		case 'asset':
			return ['purchase_10', 'purchase_8', 'na'];
		case 'liability':
		case 'equity':
			return ['na'];
	}
}

/**
 * 消費税区分が指定した勘定科目タイプで有効かどうかを検証する。
 *
 * @param accountType - 勘定科目タイプ
 * @param taxCategory - 消費税区分
 * @returns 有効であれば true
 */
export function isValidTaxCategoryForAccount(
	accountType: AccountType,
	taxCategory: TaxCategory
): boolean {
	return getAllowedTaxCategories(accountType).includes(taxCategory);
}
