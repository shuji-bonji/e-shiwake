import type { JournalEntry, Account, ProfitLossData, ProfitLossRow } from '$lib/types';

/**
 * 売上原価に該当する勘定科目コード
 * 仕入高のみを売上原価として扱う
 */
const COST_OF_SALES_CODES = ['5001'];

/**
 * 売上高に該当する勘定科目コード
 */
const SALES_REVENUE_CODES = ['4001'];

/**
 * 仕訳から損益計算書データを生成
 */
export function generateProfitLoss(
	journals: JournalEntry[],
	accounts: Account[],
	fiscalYear: number
): ProfitLossData {
	const accountMap = new Map(accounts.map((a) => [a.code, a]));

	// 科目ごとの残高を集計
	// 収益: 貸方がプラス、借方がマイナス
	// 費用: 借方がプラス、貸方がマイナス
	const balances = new Map<string, number>();

	for (const journal of journals) {
		for (const line of journal.lines) {
			const account = accountMap.get(line.accountCode);
			if (!account) continue;

			const current = balances.get(line.accountCode) || 0;

			if (account.type === 'revenue') {
				// 収益: 貸方で増加
				if (line.type === 'credit') {
					balances.set(line.accountCode, current + line.amount);
				} else {
					balances.set(line.accountCode, current - line.amount);
				}
			} else if (account.type === 'expense') {
				// 費用: 借方で増加
				if (line.type === 'debit') {
					balances.set(line.accountCode, current + line.amount);
				} else {
					balances.set(line.accountCode, current - line.amount);
				}
			}
		}
	}

	// カテゴリ別に分類
	const salesRevenue: ProfitLossRow[] = [];
	const otherRevenue: ProfitLossRow[] = [];
	const costOfSales: ProfitLossRow[] = [];
	const operatingExpenses: ProfitLossRow[] = [];

	for (const [code, amount] of balances) {
		const account = accountMap.get(code);
		if (!account || amount === 0) continue;

		const row: ProfitLossRow = {
			accountCode: code,
			accountName: account.name,
			amount: Math.abs(amount)
		};

		if (account.type === 'revenue') {
			if (SALES_REVENUE_CODES.includes(code)) {
				salesRevenue.push(row);
			} else {
				otherRevenue.push(row);
			}
		} else if (account.type === 'expense') {
			if (COST_OF_SALES_CODES.includes(code)) {
				costOfSales.push(row);
			} else {
				operatingExpenses.push(row);
			}
		}
	}

	// コード順にソート
	const sortByCode = (a: ProfitLossRow, b: ProfitLossRow) =>
		a.accountCode.localeCompare(b.accountCode);
	salesRevenue.sort(sortByCode);
	otherRevenue.sort(sortByCode);
	costOfSales.sort(sortByCode);
	operatingExpenses.sort(sortByCode);

	// 合計計算
	const totalSalesRevenue = salesRevenue.reduce((sum, r) => sum + r.amount, 0);
	const totalOtherRevenue = otherRevenue.reduce((sum, r) => sum + r.amount, 0);
	const totalRevenue = totalSalesRevenue + totalOtherRevenue;

	const totalCostOfSales = costOfSales.reduce((sum, r) => sum + r.amount, 0);
	const totalOperatingExpenses = operatingExpenses.reduce((sum, r) => sum + r.amount, 0);
	const totalExpenses = totalCostOfSales + totalOperatingExpenses;

	// 利益計算
	const grossProfit = totalSalesRevenue - totalCostOfSales;
	const operatingIncome = grossProfit - totalOperatingExpenses;
	const netIncome = operatingIncome + totalOtherRevenue;

	return {
		fiscalYear,
		salesRevenue,
		otherRevenue,
		totalRevenue,
		costOfSales,
		operatingExpenses,
		totalExpenses,
		grossProfit,
		operatingIncome,
		netIncome
	};
}

/**
 * 金額をフォーマット（カンマ区切り、負の値は△表示）
 */
export function formatPLAmount(amount: number): string {
	if (amount === 0) return '0';
	if (amount < 0) {
		return `△${Math.abs(amount).toLocaleString('ja-JP')}`;
	}
	return amount.toLocaleString('ja-JP');
}

/**
 * 損益計算書をCSV形式に変換
 */
export function profitLossToCsv(data: ProfitLossData): string {
	const lines: string[] = [];

	lines.push(`損益計算書,${data.fiscalYear}年度`);
	lines.push('');

	// 売上高
	lines.push('【売上高】');
	for (const row of data.salesRevenue) {
		lines.push(`${row.accountCode},${row.accountName},${row.amount}`);
	}
	const totalSales = data.salesRevenue.reduce((sum, r) => sum + r.amount, 0);
	lines.push(`,売上高 合計,${totalSales}`);
	lines.push('');

	// 売上原価
	lines.push('【売上原価】');
	for (const row of data.costOfSales) {
		lines.push(`${row.accountCode},${row.accountName},${row.amount}`);
	}
	const totalCost = data.costOfSales.reduce((sum, r) => sum + r.amount, 0);
	lines.push(`,売上原価 合計,${totalCost}`);
	lines.push('');

	// 売上総利益
	lines.push(`,売上総利益,${data.grossProfit}`);
	lines.push('');

	// 販売費及び一般管理費
	lines.push('【販売費及び一般管理費】');
	for (const row of data.operatingExpenses) {
		lines.push(`${row.accountCode},${row.accountName},${row.amount}`);
	}
	const totalOpEx = data.operatingExpenses.reduce((sum, r) => sum + r.amount, 0);
	lines.push(`,販管費 合計,${totalOpEx}`);
	lines.push('');

	// 営業利益
	lines.push(`,営業利益,${data.operatingIncome}`);
	lines.push('');

	// 営業外収益
	lines.push('【営業外収益】');
	for (const row of data.otherRevenue) {
		lines.push(`${row.accountCode},${row.accountName},${row.amount}`);
	}
	const totalOther = data.otherRevenue.reduce((sum, r) => sum + r.amount, 0);
	lines.push(`,営業外収益 合計,${totalOther}`);
	lines.push('');

	// 当期純利益
	lines.push(`,当期純利益,${data.netIncome}`);

	return lines.join('\n');
}
