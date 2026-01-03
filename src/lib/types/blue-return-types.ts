/**
 * 青色申告決算書関連の型定義
 *
 * 青色申告決算書（一般用）4ページ分のデータ構造を定義
 */

// ============================================================
// 事業者情報
// ============================================================

/**
 * 事業者情報
 */
export interface BusinessInfo {
	name: string; // 氏名
	tradeName?: string; // 屋号
	address: string; // 住所
	businessType: string; // 事業の種類
	phoneNumber?: string; // 電話番号
}

// ============================================================
// 固定資産・減価償却
// ============================================================

/**
 * 固定資産のカテゴリ
 */
export type FixedAssetCategory =
	| 'building' // 建物
	| 'structure' // 構築物
	| 'machinery' // 機械装置
	| 'vehicle' // 車両運搬具
	| 'equipment' // 工具器具備品
	| 'other'; // その他

/**
 * 減価償却の方法
 */
export type DepreciationMethod =
	| 'straight-line' // 定額法
	| 'declining-balance'; // 定率法

/**
 * 固定資産
 */
export interface FixedAsset {
	id: string; // UUID
	name: string; // 資産の名称
	category: FixedAssetCategory; // 資産のカテゴリ
	acquisitionDate: string; // 取得年月日（YYYY-MM-DD）
	acquisitionCost: number; // 取得価額
	usefulLife: number; // 耐用年数
	depreciationMethod: DepreciationMethod; // 償却方法
	depreciationRate: number; // 償却率
	businessRatio: number; // 事業専用割合（0-100）
	status: 'active' | 'sold' | 'disposed'; // 状態（使用中/売却/除却）
	disposalDate?: string; // 売却・除却日
	memo?: string; // メモ
	createdAt: string;
	updatedAt: string;
}

/**
 * 減価償却資産の行（決算書3ページ目用）
 */
export interface DepreciationAssetRow {
	assetName: string; // 資産の名称
	acquisitionDate: string; // 取得年月（YYYY-MM）
	acquisitionCost: number; // 取得価額
	depreciationMethod: DepreciationMethod; // 償却方法
	usefulLife: number; // 耐用年数
	depreciationRate: number; // 償却率
	depreciationMonths: number; // 本年中の償却期間（月数）
	depreciationBase: number; // 償却の基礎となる金額
	currentYearDepreciation: number; // 本年分の償却費
	businessRatio: number; // 事業専用割合
	businessDepreciation: number; // 本年分の必要経費算入額
	accumulatedDepreciation: number; // 期末償却累計額
	bookValue: number; // 期末未償却残高（帳簿価額）
}

// ============================================================
// 月別集計
// ============================================================

/**
 * 月別売上・仕入データ（2ページ目用）
 */
export interface MonthlySalesData {
	month: number; // 月（1-12）
	sales: number; // 売上（収入）金額
	purchases: number; // 仕入金額
}

/**
 * 月別集計（売上・仕入・経費）
 */
export interface MonthlyTotals {
	month: number;
	sales: number;
	purchases: number;
	expenses: number;
}

/**
 * 科目別年間集計
 */
export interface AccountYearlyTotal {
	accountCode: string;
	accountName: string;
	monthlyAmounts: number[]; // 12ヶ月分の金額
	total: number; // 年間合計
}

// ============================================================
// 経費・詳細行
// ============================================================

/**
 * 経費行（1ページ目用）
 */
export interface ExpenseRow {
	code: string; // 勘定科目コード
	name: string; // 勘定科目名
	amount: number; // 金額
}

/**
 * 貸借対照表詳細行（4ページ目用）
 */
export interface BalanceSheetDetailRow {
	accountCode: string;
	accountName: string;
	beginningBalance: number; // 期首残高
	endingBalance: number; // 期末残高
}

/**
 * 地代家賃の内訳行（2ページ目用）
 */
export interface RentDetailRow {
	propertyType: 'land' | 'building'; // 地代 or 家賃
	landlordAddress: string; // 支払先の住所
	landlordName: string; // 支払先の氏名
	rentAmount: number; // 賃借料
	deposit?: number; // 権利金等
	businessRatio: number; // 必要経費算入割合（0-100）
}

/**
 * 給与賃金の内訳行（2ページ目用）
 */
export interface SalaryDetailRow {
	employeeName: string; // 氏名
	relationship?: string; // 続柄（専従者の場合）
	workingMonths: number; // 従事月数
	salary: number; // 給料
	bonus: number; // 賞与
	total: number; // 合計
}

/**
 * 利子割引料の内訳行（3ページ目用）
 */
export interface InterestDetailRow {
	lenderName: string; // 金融機関名
	purpose: string; // 借入金の用途
	borrowingAmount: number; // 期末借入金残高
	interestAmount: number; // 本年中の支払利子
	businessRatio: number; // 必要経費算入割合
}

// ============================================================
// 決算書ページデータ
// ============================================================

/**
 * 1ページ目: 損益計算書
 */
export interface Page1ProfitLoss {
	// 売上
	salesTotal: number; // 売上（収入）金額
	// 売上原価
	inventoryStart: number; // 期首商品棚卸高
	purchases: number; // 仕入金額
	inventoryEnd: number; // 期末商品棚卸高
	costOfSales: number; // 差引原価
	grossProfit: number; // 差引金額（売上総利益）
	// 経費
	expenses: ExpenseRow[]; // 経費明細
	expensesTotal: number; // 経費合計
	// 所得
	operatingProfit: number; // 差引金額（営業利益）
	specialDeduction: number; // 専従者給与控除
	netIncomeBeforeDeduction: number; // 青色申告特別控除前の所得
	blueReturnDeduction: number; // 青色申告特別控除額
	businessIncome: number; // 所得金額
}

/**
 * 2ページ目: 月別売上・仕入、給与賃金・地代家賃の内訳
 */
export interface Page2Details {
	// 月別売上・仕入
	monthlySales: MonthlySalesData[];
	monthlySalesTotal: number;
	monthlyPurchasesTotal: number;
	// 家事消費等（通常は0）
	personalConsumption: number;
	// 雑収入
	miscIncome: number;
	// 給与賃金の内訳
	salaryDetails: SalaryDetailRow[];
	salaryTotal: number;
	// 地代家賃の内訳
	rentDetails: RentDetailRow[];
	rentTotal: number;
	// 利子割引料の内訳
	interestDetails: InterestDetailRow[];
}

/**
 * 3ページ目: 減価償却費の計算
 */
export interface Page3Depreciation {
	assets: DepreciationAssetRow[];
	totalDepreciation: number; // 本年分の償却費合計
	totalBusinessDepreciation: number; // 必要経費算入額合計
	// 利子割引料の内訳（3ページ目下部）
	interestDetails: InterestDetailRow[];
	interestTotal: number;
}

/**
 * 4ページ目: 貸借対照表
 */
export interface Page4BalanceSheet {
	fiscalYear: number;
	// 資産の部
	assets: {
		current: BalanceSheetDetailRow[]; // 流動資産
		fixed: BalanceSheetDetailRow[]; // 固定資産
		totalBeginning: number; // 資産合計（期首）
		totalEnding: number; // 資産合計（期末）
	};
	// 負債の部
	liabilities: {
		current: BalanceSheetDetailRow[]; // 流動負債
		fixed: BalanceSheetDetailRow[]; // 固定負債
		totalBeginning: number; // 負債合計（期首）
		totalEnding: number; // 負債合計（期末）
	};
	// 資本（元入金）
	equity: {
		capital: number; // 元入金（期首）
		netIncome: number; // 青色申告特別控除前の所得
		ownerWithdrawal: number; // 事業主貸
		ownerDeposit: number; // 事業主借
		capitalEnding: number; // 元入金（期末）
	};
	// 貸借バランス
	isBalanced: boolean;
}

// ============================================================
// 青色申告決算書データ（統合）
// ============================================================

/**
 * 青色申告決算書データ（全4ページ）
 */
export interface BlueReturnData {
	fiscalYear: number;
	businessInfo: BusinessInfo;
	page1: Page1ProfitLoss;
	page2: Page2Details;
	page3: Page3Depreciation;
	page4: Page4BalanceSheet;
	createdAt: string;
	updatedAt: string;
}
