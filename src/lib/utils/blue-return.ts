/**
 * 青色申告決算書生成ユーティリティ
 *
 * 仕訳データ、固定資産台帳、設定情報から
 * 青色申告決算書（一般用・4ページ）のデータを生成する
 */

import type { JournalEntry, Account, ProfitLossData, BalanceSheetData } from '$lib/types';
import type {
	BlueReturnData,
	BusinessInfo,
	Page1ProfitLoss,
	Page4BalanceSheet,
	FixedAsset,
	ExpenseRow,
	BalanceSheetDetailRow,
	RentDetailRow
} from '$lib/types/blue-return-types';
import { generatePage2Details } from './monthly-summary';
import { generatePage3Depreciation } from './depreciation';

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * 仕訳データから事業主貸/事業主借の発生額を計算
 * - 事業主貸（3002）: 借方発生額を集計
 * - 事業主借（3003）: 貸方発生額を集計
 */
export function calculateOwnerTransactions(journals: JournalEntry[]): {
	ownerWithdrawal: number; // 事業主貸
	ownerDeposit: number; // 事業主借
} {
	let ownerWithdrawal = 0;
	let ownerDeposit = 0;

	for (const journal of journals) {
		for (const line of journal.lines) {
			// 事業主貸（3002）の借方発生額
			if (line.accountCode === '3002' && line.type === 'debit') {
				ownerWithdrawal += line.amount;
			}
			// 事業主借（3003）の貸方発生額
			if (line.accountCode === '3003' && line.type === 'credit') {
				ownerDeposit += line.amount;
			}
		}
	}

	return { ownerWithdrawal, ownerDeposit };
}

// ============================================================
// 1ページ目: 損益計算書データ変換
// ============================================================

/**
 * 青色申告特別控除額を判定
 * - 65万円: e-Tax + 複式簿記 + 貸借対照表
 * - 55万円: 複式簿記 + 貸借対照表（紙提出）
 * - 10万円: 簡易簿記
 */
export type BlueReturnDeductionType = 65 | 55 | 10;

/**
 * 既存のProfitLossDataから1ページ目データを生成
 */
export function generatePage1(
	profitLoss: ProfitLossData,
	options: {
		inventoryStart?: number; // 期首商品棚卸高
		inventoryEnd?: number; // 期末商品棚卸高
		specialDeduction?: number; // 青色事業専従者給与
		blueReturnDeduction?: BlueReturnDeductionType; // 青色申告特別控除
	} = {}
): Page1ProfitLoss {
	const {
		inventoryStart = 0,
		inventoryEnd = 0,
		specialDeduction = 0,
		blueReturnDeduction = 65
	} = options;

	// 売上高
	const salesTotal =
		profitLoss.salesRevenue.reduce((sum, r) => sum + r.amount, 0) +
		profitLoss.otherRevenue.reduce((sum, r) => sum + r.amount, 0);

	// 仕入高
	const purchases = profitLoss.costOfSales.reduce((sum, r) => sum + r.amount, 0);

	// 売上原価
	const costOfSales = inventoryStart + purchases - inventoryEnd;

	// 売上総利益
	const grossProfit = salesTotal - costOfSales;

	// 経費
	const expenses: ExpenseRow[] = profitLoss.operatingExpenses.map((r) => ({
		code: r.accountCode,
		name: r.accountName,
		amount: r.amount
	}));
	const expensesTotal = expenses.reduce((sum, e) => sum + e.amount, 0);

	// 営業利益
	const operatingProfit = grossProfit - expensesTotal;

	// 専従者給与控除前所得
	const netIncomeBeforeDeduction = operatingProfit - specialDeduction;

	// 青色申告特別控除額（万円→円）
	const blueDeductionAmount = blueReturnDeduction * 10000;

	// 事業所得
	const businessIncome = Math.max(0, netIncomeBeforeDeduction - blueDeductionAmount);

	return {
		salesTotal,
		inventoryStart,
		purchases,
		inventoryEnd,
		costOfSales,
		grossProfit,
		expenses,
		expensesTotal,
		operatingProfit,
		specialDeduction,
		netIncomeBeforeDeduction,
		blueReturnDeduction: blueDeductionAmount,
		businessIncome
	};
}

// ============================================================
// 4ページ目: 貸借対照表データ変換
// ============================================================

/**
 * 既存のBalanceSheetDataから4ページ目データを生成
 *
 * 国税庁の青色申告決算書様式に準拠:
 * - 事業主貸は「資産の部」の最後に配置
 * - 事業主借は「負債・資本の部」に配置
 *
 * 貸借の等式:
 * 資産 + 事業主貸 = 負債 + 事業主借 + 元入金 + 青色申告特別控除前の所得金額
 */
export function generatePage4(
	balanceSheet: BalanceSheetData,
	beginningBalanceSheet: BalanceSheetData | null,
	options: {
		ownerWithdrawal?: number; // 事業主貸
		ownerDeposit?: number; // 事業主借
	} = {}
): Page4BalanceSheet {
	const { ownerWithdrawal = 0, ownerDeposit = 0 } = options;

	// 期首残高（前年度末の残高、または初年度は0）
	const beginningAssets = beginningBalanceSheet
		? {
				current: beginningBalanceSheet.currentAssets.map((a) => ({
					accountCode: a.accountCode,
					accountName: a.accountName,
					beginningBalance: a.amount,
					endingBalance: 0 // 後で更新
				})),
				fixed: beginningBalanceSheet.fixedAssets.map((a) => ({
					accountCode: a.accountCode,
					accountName: a.accountName,
					beginningBalance: a.amount,
					endingBalance: 0
				}))
			}
		: { current: [], fixed: [] };

	// 期末残高をマージ
	const mergeBalances = (
		beginning: BalanceSheetDetailRow[],
		ending: { accountCode: string; accountName: string; amount: number }[]
	): BalanceSheetDetailRow[] => {
		const map = new Map<string, BalanceSheetDetailRow>();

		// 期首残高を設定
		for (const row of beginning) {
			map.set(row.accountCode, { ...row });
		}

		// 期末残高を設定
		for (const row of ending) {
			if (map.has(row.accountCode)) {
				map.get(row.accountCode)!.endingBalance = row.amount;
			} else {
				map.set(row.accountCode, {
					accountCode: row.accountCode,
					accountName: row.accountName,
					beginningBalance: 0,
					endingBalance: row.amount
				});
			}
		}

		return Array.from(map.values()).sort((a, b) => a.accountCode.localeCompare(b.accountCode));
	};

	const currentAssets = mergeBalances(beginningAssets.current, balanceSheet.currentAssets);
	const fixedAssets = mergeBalances(beginningAssets.fixed, balanceSheet.fixedAssets);
	const currentLiabilities = mergeBalances(
		beginningBalanceSheet?.currentLiabilities.map((a) => ({
			accountCode: a.accountCode,
			accountName: a.accountName,
			beginningBalance: a.amount,
			endingBalance: 0
		})) ?? [],
		balanceSheet.currentLiabilities
	);
	const fixedLiabilities = mergeBalances(
		beginningBalanceSheet?.fixedLiabilities.map((a) => ({
			accountCode: a.accountCode,
			accountName: a.accountName,
			beginningBalance: a.amount,
			endingBalance: 0
		})) ?? [],
		balanceSheet.fixedLiabilities
	);

	// 資産合計（事業主貸を除く）
	const assetsWithoutOwnerBeginning =
		currentAssets.reduce((sum, a) => sum + a.beginningBalance, 0) +
		fixedAssets.reduce((sum, a) => sum + a.beginningBalance, 0);
	const assetsWithoutOwnerEnding =
		currentAssets.reduce((sum, a) => sum + a.endingBalance, 0) +
		fixedAssets.reduce((sum, a) => sum + a.endingBalance, 0);

	// 資産合計（事業主貸を含む）
	const assetsTotalBeginning = assetsWithoutOwnerBeginning; // 期首の事業主貸は0と仮定
	const assetsTotalEnding = assetsWithoutOwnerEnding + ownerWithdrawal;

	// 負債合計
	const liabilitiesTotalBeginning =
		currentLiabilities.reduce((sum, a) => sum + a.beginningBalance, 0) +
		fixedLiabilities.reduce((sum, a) => sum + a.beginningBalance, 0);
	const liabilitiesTotalEnding =
		currentLiabilities.reduce((sum, a) => sum + a.endingBalance, 0) +
		fixedLiabilities.reduce((sum, a) => sum + a.endingBalance, 0);

	// 純資産（資本）
	const capitalBeginning = beginningBalanceSheet?.totalEquity ?? 0;
	const netIncome = balanceSheet.retainedEarnings;

	// 期末元入金の計算
	// 翌年の期首元入金 = 期首元入金 + 所得 + 事業主借 - 事業主貸
	// ただし青色申告決算書の貸借対照表では元入金は変動しないのが一般的
	const capitalEnding = capitalBeginning;

	// 貸借バランス確認
	// 左辺: 資産 + 事業主貸
	// 右辺: 負債 + 事業主借 + 元入金 + 所得
	const leftSide = assetsTotalEnding;
	const rightSide = liabilitiesTotalEnding + ownerDeposit + capitalEnding + netIncome;
	const isBalanced = Math.abs(leftSide - rightSide) < 100; // 端数誤差を許容

	return {
		fiscalYear: balanceSheet.fiscalYear,
		assets: {
			current: currentAssets,
			fixed: fixedAssets,
			ownerWithdrawal,
			totalBeginning: assetsTotalBeginning,
			totalEnding: assetsTotalEnding
		},
		liabilities: {
			current: currentLiabilities,
			fixed: fixedLiabilities,
			totalBeginning: liabilitiesTotalBeginning,
			totalEnding: liabilitiesTotalEnding
		},
		equity: {
			ownerDeposit,
			capital: capitalBeginning,
			capitalEnding,
			netIncome
		},
		isBalanced
	};
}

// ============================================================
// 統合生成関数
// ============================================================

/**
 * 青色申告決算書の全データを生成
 */
export function generateBlueReturnData(
	fiscalYear: number,
	journals: JournalEntry[],
	accounts: Account[],
	profitLoss: ProfitLossData,
	balanceSheet: BalanceSheetData,
	options: {
		businessInfo: BusinessInfo;
		fixedAssets?: FixedAsset[];
		beginningBalanceSheet?: BalanceSheetData | null;
		inventoryStart?: number;
		inventoryEnd?: number;
		specialDeduction?: number;
		blueReturnDeduction?: BlueReturnDeductionType;
		rentDetails?: RentDetailRow[];
	}
): BlueReturnData {
	const {
		businessInfo,
		fixedAssets = [],
		beginningBalanceSheet = null,
		inventoryStart = 0,
		inventoryEnd = 0,
		specialDeduction = 0,
		blueReturnDeduction = 65,
		rentDetails = []
	} = options;

	// 仕訳データから事業主貸/事業主借を自動計算
	const { ownerWithdrawal, ownerDeposit } = calculateOwnerTransactions(journals);

	// 各ページのデータを生成
	const page1 = generatePage1(profitLoss, {
		inventoryStart,
		inventoryEnd,
		specialDeduction,
		blueReturnDeduction
	});

	const page2 = generatePage2Details(journals, accounts, { rentDetails });

	const page3 = generatePage3Depreciation(fixedAssets, fiscalYear);

	const page4 = generatePage4(balanceSheet, beginningBalanceSheet, {
		ownerWithdrawal,
		ownerDeposit
	});

	const now = new Date().toISOString();

	return {
		fiscalYear,
		businessInfo,
		page1,
		page2,
		page3,
		page4,
		createdAt: now,
		updatedAt: now
	};
}

// ============================================================
// CSV出力
// ============================================================

/**
 * 青色申告決算書データをCSV形式に変換（サマリー）
 */
export function blueReturnSummaryToCsv(data: BlueReturnData): string {
	const lines: string[] = [];

	lines.push(`青色申告決算書（一般用）,${data.fiscalYear}年分`);
	lines.push('');

	// 事業者情報
	lines.push('【事業者情報】');
	lines.push(`氏名,${data.businessInfo.name}`);
	if (data.businessInfo.tradeName) {
		lines.push(`屋号,${data.businessInfo.tradeName}`);
	}
	lines.push(`住所,${data.businessInfo.address}`);
	lines.push(`事業の種類,${data.businessInfo.businessType}`);
	lines.push('');

	// 1ページ目: 損益計算書サマリー
	lines.push('【1ページ目: 損益計算書】');
	lines.push(`売上（収入）金額,${data.page1.salesTotal}`);
	lines.push(`売上原価,${data.page1.costOfSales}`);
	lines.push(`売上総利益,${data.page1.grossProfit}`);
	lines.push(`経費合計,${data.page1.expensesTotal}`);
	lines.push(`差引金額,${data.page1.operatingProfit}`);
	lines.push(`青色申告特別控除,${data.page1.blueReturnDeduction}`);
	lines.push(`所得金額,${data.page1.businessIncome}`);
	lines.push('');

	// 2ページ目: 月別サマリー
	lines.push('【2ページ目: 月別売上・仕入】');
	lines.push(`年間売上合計,${data.page2.monthlySalesTotal}`);
	lines.push(`年間仕入合計,${data.page2.monthlyPurchasesTotal}`);
	lines.push(`雑収入,${data.page2.miscIncome}`);
	lines.push(`給与賃金合計,${data.page2.salaryTotal}`);
	lines.push(`地代家賃合計,${data.page2.rentTotal}`);
	lines.push('');

	// 3ページ目: 減価償却サマリー
	lines.push('【3ページ目: 減価償却費】');
	lines.push(`償却資産数,${data.page3.assets.length}`);
	lines.push(`本年分の償却費合計,${data.page3.totalDepreciation}`);
	lines.push(`必要経費算入額合計,${data.page3.totalBusinessDepreciation}`);
	lines.push('');

	// 4ページ目: 貸借対照表サマリー
	lines.push('【4ページ目: 貸借対照表】');
	lines.push('');
	lines.push('資産の部');
	lines.push(`資産合計（期首）,${data.page4.assets.totalBeginning}`);
	lines.push(`事業主貸,${data.page4.assets.ownerWithdrawal}`);
	lines.push(`資産合計（期末）,${data.page4.assets.totalEnding}`);
	lines.push('');
	lines.push('負債・資本の部');
	lines.push(`負債合計（期首）,${data.page4.liabilities.totalBeginning}`);
	lines.push(`負債合計（期末）,${data.page4.liabilities.totalEnding}`);
	lines.push(`事業主借,${data.page4.equity.ownerDeposit}`);
	lines.push(`元入金（期首）,${data.page4.equity.capital}`);
	lines.push(`元入金（期末）,${data.page4.equity.capitalEnding}`);
	lines.push(`青色申告特別控除前の所得金額,${data.page4.equity.netIncome}`);
	lines.push('');
	lines.push(`貸借バランス,${data.page4.isBalanced ? '一致' : '不一致'}`);

	return lines.join('\n');
}

// ============================================================
// バリデーション
// ============================================================

/**
 * 青色申告決算書データの整合性チェック
 */
export function validateBlueReturnData(data: BlueReturnData): string[] {
	const errors: string[] = [];

	// 月別売上の合計と損益計算書の売上が一致するか
	if (data.page2.monthlySalesTotal !== data.page1.salesTotal) {
		errors.push(
			`月別売上合計（${data.page2.monthlySalesTotal}）と損益計算書の売上（${data.page1.salesTotal}）が一致しません`
		);
	}

	// 貸借バランスの確認
	if (!data.page4.isBalanced) {
		errors.push('貸借対照表の貸借バランスが一致していません');
	}

	// 青色申告特別控除の妥当性
	const validDeductions = [650000, 550000, 100000];
	if (!validDeductions.includes(data.page1.blueReturnDeduction)) {
		errors.push(
			`青色申告特別控除額（${data.page1.blueReturnDeduction}）が不正です（65万円/55万円/10万円）`
		);
	}

	// 所得金額がマイナスになっていないか
	if (data.page1.businessIncome < 0) {
		errors.push('事業所得がマイナスになっています（赤字の場合は0円で申告）');
	}

	return errors;
}

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * 月名の配列を取得
 */
export function getMonthNames(): string[] {
	return ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
}

/**
 * 金額を日本円形式でフォーマット
 */
export function formatJPY(amount: number): string {
	return new Intl.NumberFormat('ja-JP', {
		style: 'currency',
		currency: 'JPY',
		currencyDisplay: 'name'
	}).format(amount);
}

/**
 * 金額をカンマ区切りでフォーマット
 */
export function formatAmount(amount: number): string {
	if (amount === 0) return '0';
	if (amount < 0) {
		return `△${Math.abs(amount).toLocaleString('ja-JP')}`;
	}
	return amount.toLocaleString('ja-JP');
}
