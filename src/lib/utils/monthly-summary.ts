/**
 * 月別集計ユーティリティ
 *
 * 仕訳データから月別の売上・仕入・経費を集計し、
 * 青色申告決算書2ページ目のデータを生成する
 */

import type { JournalEntry, Account, JournalLine } from '$lib/types';
import type {
	MonthlySalesData,
	MonthlyTotals,
	AccountYearlyTotal,
	RentDetailRow,
	Page2Details
} from '$lib/types/blue-return-types';

// ============================================================
// 定数定義
// ============================================================

/**
 * 売上高に該当する勘定科目コード
 */
const SALES_CODES = ['4001']; // 売上高

/**
 * 仕入高に該当する勘定科目コード
 */
const PURCHASE_CODES = ['5001']; // 仕入高

/**
 * 雑収入に該当する勘定科目コード
 */
const MISC_INCOME_CODES = ['4002', '4003']; // 受取利息、雑収入など

/**
 * 地代家賃に該当する勘定科目コード
 */
const RENT_CODES = ['5017']; // 地代家賃

/**
 * 給与賃金に該当する勘定科目コード
 */
const SALARY_CODES = ['5016']; // 給料賃金

// ============================================================
// 月別集計関数
// ============================================================

/**
 * 仕訳から月を取得
 */
function getMonth(dateStr: string): number {
	const date = new Date(dateStr);
	return date.getMonth() + 1; // 1-12
}

/**
 * 仕訳行の金額を取得（収益は貸方、費用は借方で増加）
 */
function getLineAmount(line: JournalLine, account: Account | undefined): number {
	if (!account) return 0;

	if (account.type === 'revenue') {
		// 収益: 貸方で増加、借方で減少
		return line.type === 'credit' ? line.amount : -line.amount;
	} else if (account.type === 'expense') {
		// 費用: 借方で増加、貸方で減少
		return line.type === 'debit' ? line.amount : -line.amount;
	}

	return 0;
}

/**
 * 月別売上・仕入データを生成
 */
export function generateMonthlySales(
	journals: JournalEntry[],
	accounts: Account[]
): MonthlySalesData[] {
	const accountMap = new Map(accounts.map((a) => [a.code, a]));

	// 月別の集計用オブジェクト（1-12月）
	const monthlyData: Map<number, { sales: number; purchases: number }> = new Map();
	for (let m = 1; m <= 12; m++) {
		monthlyData.set(m, { sales: 0, purchases: 0 });
	}

	// 仕訳を走査して集計
	for (const journal of journals) {
		const month = getMonth(journal.date);
		const data = monthlyData.get(month);
		if (!data) continue;

		for (const line of journal.lines) {
			const account = accountMap.get(line.accountCode);
			if (!account) continue;

			// 売上高
			if (SALES_CODES.includes(line.accountCode)) {
				const amount = getLineAmount(line, account);
				data.sales += amount;
			}

			// 仕入高
			if (PURCHASE_CODES.includes(line.accountCode)) {
				const amount = getLineAmount(line, account);
				data.purchases += amount;
			}
		}
	}

	// 配列に変換
	const result: MonthlySalesData[] = [];
	for (let m = 1; m <= 12; m++) {
		const data = monthlyData.get(m)!;
		result.push({
			month: m,
			sales: Math.abs(data.sales),
			purchases: Math.abs(data.purchases)
		});
	}

	return result;
}

/**
 * 月別売上・仕入・経費の合計を取得
 */
export function generateMonthlyTotals(
	journals: JournalEntry[],
	accounts: Account[]
): MonthlyTotals[] {
	const accountMap = new Map(accounts.map((a) => [a.code, a]));

	// 月別の集計用オブジェクト
	const monthlyData: Map<number, MonthlyTotals> = new Map();
	for (let m = 1; m <= 12; m++) {
		monthlyData.set(m, { month: m, sales: 0, purchases: 0, expenses: 0 });
	}

	for (const journal of journals) {
		const month = getMonth(journal.date);
		const data = monthlyData.get(month);
		if (!data) continue;

		for (const line of journal.lines) {
			const account = accountMap.get(line.accountCode);
			if (!account) continue;

			const amount = getLineAmount(line, account);

			if (SALES_CODES.includes(line.accountCode)) {
				data.sales += amount;
			} else if (PURCHASE_CODES.includes(line.accountCode)) {
				data.purchases += amount;
			} else if (account.type === 'expense') {
				data.expenses += amount;
			}
		}
	}

	return Array.from(monthlyData.values()).map((d) => ({
		...d,
		sales: Math.abs(d.sales),
		purchases: Math.abs(d.purchases),
		expenses: Math.abs(d.expenses)
	}));
}

/**
 * 科目別の年間集計を生成
 */
export function generateAccountYearlyTotals(
	journals: JournalEntry[],
	accounts: Account[],
	filterType?: 'revenue' | 'expense'
): AccountYearlyTotal[] {
	const accountMap = new Map(accounts.map((a) => [a.code, a]));

	// 科目別・月別の集計
	const totals: Map<string, AccountYearlyTotal> = new Map();

	for (const journal of journals) {
		const month = getMonth(journal.date);

		for (const line of journal.lines) {
			const account = accountMap.get(line.accountCode);
			if (!account) continue;

			// フィルタ適用
			if (filterType && account.type !== filterType) continue;

			// 収益・費用以外はスキップ
			if (account.type !== 'revenue' && account.type !== 'expense') continue;

			const amount = getLineAmount(line, account);

			if (!totals.has(line.accountCode)) {
				totals.set(line.accountCode, {
					accountCode: line.accountCode,
					accountName: account.name,
					monthlyAmounts: new Array(12).fill(0),
					total: 0
				});
			}

			const data = totals.get(line.accountCode)!;
			data.monthlyAmounts[month - 1] += amount;
			data.total += amount;
		}
	}

	// 絶対値に変換してソート
	return Array.from(totals.values())
		.map((d) => ({
			...d,
			monthlyAmounts: d.monthlyAmounts.map(Math.abs),
			total: Math.abs(d.total)
		}))
		.filter((d) => d.total > 0)
		.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
}

/**
 * 雑収入の年間合計を計算
 */
export function calculateMiscIncome(journals: JournalEntry[], accounts: Account[]): number {
	const accountMap = new Map(accounts.map((a) => [a.code, a]));
	let total = 0;

	for (const journal of journals) {
		for (const line of journal.lines) {
			if (MISC_INCOME_CODES.includes(line.accountCode)) {
				const account = accountMap.get(line.accountCode);
				total += getLineAmount(line, account);
			}
		}
	}

	return Math.abs(total);
}

/**
 * 地代家賃の年間合計を計算
 */
export function calculateRentTotal(journals: JournalEntry[], accounts: Account[]): number {
	const accountMap = new Map(accounts.map((a) => [a.code, a]));
	let total = 0;

	for (const journal of journals) {
		for (const line of journal.lines) {
			if (RENT_CODES.includes(line.accountCode)) {
				const account = accountMap.get(line.accountCode);
				total += getLineAmount(line, account);
			}
		}
	}

	return Math.abs(total);
}

/**
 * 給与賃金の年間合計を計算
 */
export function calculateSalaryTotal(journals: JournalEntry[], accounts: Account[]): number {
	const accountMap = new Map(accounts.map((a) => [a.code, a]));
	let total = 0;

	for (const journal of journals) {
		for (const line of journal.lines) {
			if (SALARY_CODES.includes(line.accountCode)) {
				const account = accountMap.get(line.accountCode);
				total += getLineAmount(line, account);
			}
		}
	}

	return Math.abs(total);
}

// ============================================================
// 2ページ目データ生成
// ============================================================

/**
 * 青色申告決算書2ページ目のデータを生成
 *
 * 注意: rentDetails, salaryDetails, interestDetails は
 * ユーザーが別途入力する必要がある（仕訳データからは自動生成不可）
 */
export function generatePage2Details(
	journals: JournalEntry[],
	accounts: Account[],
	options?: {
		rentDetails?: RentDetailRow[];
		// salaryDetails は従業員がいる場合のみ
		// interestDetails は借入がある場合のみ
	}
): Page2Details {
	const monthlySales = generateMonthlySales(journals, accounts);

	return {
		// 月別売上・仕入
		monthlySales,
		monthlySalesTotal: monthlySales.reduce((sum, m) => sum + m.sales, 0),
		monthlyPurchasesTotal: monthlySales.reduce((sum, m) => sum + m.purchases, 0),

		// 家事消費等（通常は0、農業・飲食業等で発生）
		personalConsumption: 0,

		// 雑収入
		miscIncome: calculateMiscIncome(journals, accounts),

		// 給与賃金の内訳（従業員・専従者がいる場合のみ）
		salaryDetails: [],
		salaryTotal: calculateSalaryTotal(journals, accounts),

		// 地代家賃の内訳
		rentDetails: options?.rentDetails ?? [],
		rentTotal: calculateRentTotal(journals, accounts),

		// 利子割引料の内訳
		interestDetails: []
	};
}

// ============================================================
// CSV出力
// ============================================================

/**
 * 月別売上・仕入をCSV形式に変換
 */
export function monthlySalesToCsv(data: MonthlySalesData[], fiscalYear: number): string {
	const lines: string[] = [];

	lines.push(`月別売上（収入）金額及び仕入金額,${fiscalYear}年`);
	lines.push('');
	lines.push('月,売上（収入）金額,仕入金額');

	for (const row of data) {
		lines.push(`${row.month}月,${row.sales},${row.purchases}`);
	}

	const salesTotal = data.reduce((sum, m) => sum + m.sales, 0);
	const purchasesTotal = data.reduce((sum, m) => sum + m.purchases, 0);
	lines.push(`合計,${salesTotal},${purchasesTotal}`);

	return lines.join('\n');
}

/**
 * 科目別年間集計をCSV形式に変換
 */
export function accountYearlyTotalsToCsv(data: AccountYearlyTotal[], fiscalYear: number): string {
	const lines: string[] = [];
	const months = [
		'1月',
		'2月',
		'3月',
		'4月',
		'5月',
		'6月',
		'7月',
		'8月',
		'9月',
		'10月',
		'11月',
		'12月'
	];

	lines.push(`科目別月次集計,${fiscalYear}年`);
	lines.push('');
	lines.push(['コード', '勘定科目', ...months, '合計'].join(','));

	for (const row of data) {
		lines.push(
			[
				row.accountCode,
				row.accountName,
				...row.monthlyAmounts.map((a) => a.toString()),
				row.total.toString()
			].join(',')
		);
	}

	return lines.join('\n');
}

// ============================================================
// フォーマット関数
// ============================================================

/**
 * 金額をカンマ区切りでフォーマット
 */
export function formatAmount(amount: number): string {
	if (amount === 0) return '0';
	return amount.toLocaleString('ja-JP');
}

/**
 * 月を日本語表記に変換
 */
export function formatMonth(month: number): string {
	return `${month}月`;
}
