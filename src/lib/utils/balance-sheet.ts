import type { JournalEntry, Account, BalanceSheetData, BalanceSheetRow } from '$lib/types';

/**
 * 固定資産に該当する勘定科目コード
 * 建物、機械装置、土地、ソフトウェアなど
 */
const FIXED_ASSET_CODES = [
	'1014', // 建物
	'1015', // 建物附属設備
	'1016', // 機械装置
	'1017', // 車両運搬具
	'1018', // 工具器具備品
	'1019', // 土地
	'1020', // ソフトウェア
	'1021' // 敷金・保証金
];

/**
 * 固定負債に該当する勘定科目コード
 */
const FIXED_LIABILITY_CODES = [
	'2003' // 長期借入金
];

/**
 * 資産が固定資産かどうかを判定
 */
function isFixedAsset(code: string): boolean {
	if (FIXED_ASSET_CODES.includes(code)) return true;
	// 固定資産として明示的に登録されていないものは流動資産扱い
	return false;
}

/**
 * 負債が固定負債かどうかを判定
 */
function isFixedLiability(code: string): boolean {
	return FIXED_LIABILITY_CODES.includes(code);
}

/**
 * 仕訳から貸借対照表データを生成
 */
export function generateBalanceSheet(
	journals: JournalEntry[],
	accounts: Account[],
	fiscalYear: number,
	netIncome: number = 0
): BalanceSheetData {
	const accountMap = new Map(accounts.map((a) => [a.code, a]));

	// 科目ごとの残高を集計
	// 資産: 借方がプラス、貸方がマイナス
	// 負債・純資産: 貸方がプラス、借方がマイナス
	const balances = new Map<string, number>();

	for (const journal of journals) {
		for (const line of journal.lines) {
			const account = accountMap.get(line.accountCode);
			if (!account) continue;

			// 収益・費用は貸借対照表に含めない（損益計算書で処理）
			if (account.type === 'revenue' || account.type === 'expense') continue;

			const current = balances.get(line.accountCode) || 0;

			if (account.type === 'asset') {
				// 資産: 借方で増加
				if (line.type === 'debit') {
					balances.set(line.accountCode, current + line.amount);
				} else {
					balances.set(line.accountCode, current - line.amount);
				}
			} else {
				// 負債・純資産: 貸方で増加
				if (line.type === 'credit') {
					balances.set(line.accountCode, current + line.amount);
				} else {
					balances.set(line.accountCode, current - line.amount);
				}
			}
		}
	}

	// カテゴリ別に分類
	const currentAssets: BalanceSheetRow[] = [];
	const fixedAssets: BalanceSheetRow[] = [];
	const currentLiabilities: BalanceSheetRow[] = [];
	const fixedLiabilities: BalanceSheetRow[] = [];
	const equity: BalanceSheetRow[] = [];

	for (const [code, amount] of balances) {
		const account = accountMap.get(code);
		if (!account) continue;

		// 残高が0の科目は表示しない
		if (amount === 0) continue;

		const row: BalanceSheetRow = {
			accountCode: code,
			accountName: account.name,
			amount
		};

		switch (account.type) {
			case 'asset':
				if (isFixedAsset(code)) {
					fixedAssets.push(row);
				} else {
					currentAssets.push(row);
				}
				break;
			case 'liability':
				if (isFixedLiability(code)) {
					fixedLiabilities.push(row);
				} else {
					currentLiabilities.push(row);
				}
				break;
			case 'equity':
				equity.push(row);
				break;
		}
	}

	// コード順にソート
	const sortByCode = (a: BalanceSheetRow, b: BalanceSheetRow) =>
		a.accountCode.localeCompare(b.accountCode);
	currentAssets.sort(sortByCode);
	fixedAssets.sort(sortByCode);
	currentLiabilities.sort(sortByCode);
	fixedLiabilities.sort(sortByCode);
	equity.sort(sortByCode);

	// 合計計算
	const totalCurrentAssets = currentAssets.reduce((sum, r) => sum + r.amount, 0);
	const totalFixedAssets = fixedAssets.reduce((sum, r) => sum + r.amount, 0);
	const totalAssets = totalCurrentAssets + totalFixedAssets;

	const totalCurrentLiabilities = currentLiabilities.reduce((sum, r) => sum + r.amount, 0);
	const totalFixedLiabilities = fixedLiabilities.reduce((sum, r) => sum + r.amount, 0);
	const totalLiabilities = totalCurrentLiabilities + totalFixedLiabilities;

	const totalEquityFromAccounts = equity.reduce((sum, r) => sum + r.amount, 0);
	// 繰越利益（当期純利益）を加算
	const retainedEarnings = netIncome;
	const totalEquity = totalEquityFromAccounts + retainedEarnings;

	const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

	return {
		fiscalYear,
		currentAssets,
		fixedAssets,
		totalAssets,
		currentLiabilities,
		fixedLiabilities,
		totalLiabilities,
		equity,
		retainedEarnings,
		totalEquity,
		totalLiabilitiesAndEquity
	};
}

/**
 * 金額をフォーマット（カンマ区切り、負の値は△表示）
 */
export function formatBSAmount(amount: number): string {
	if (amount === 0) return '0';
	if (amount < 0) {
		return `△${Math.abs(amount).toLocaleString('ja-JP')}`;
	}
	return amount.toLocaleString('ja-JP');
}

/**
 * 貸借対照表をCSV形式に変換
 */
export function balanceSheetToCsv(data: BalanceSheetData): string {
	const lines: string[] = [];

	lines.push(`貸借対照表,${data.fiscalYear}年度`);
	lines.push('');

	// 資産の部
	lines.push('【資産の部】');
	lines.push('');

	// 流動資産
	lines.push('＜流動資産＞');
	for (const row of data.currentAssets) {
		lines.push(`${row.accountCode},${row.accountName},${row.amount}`);
	}
	const totalCurrent = data.currentAssets.reduce((sum, r) => sum + r.amount, 0);
	lines.push(`,流動資産 合計,${totalCurrent}`);
	lines.push('');

	// 固定資産
	lines.push('＜固定資産＞');
	for (const row of data.fixedAssets) {
		lines.push(`${row.accountCode},${row.accountName},${row.amount}`);
	}
	const totalFixed = data.fixedAssets.reduce((sum, r) => sum + r.amount, 0);
	lines.push(`,固定資産 合計,${totalFixed}`);
	lines.push('');

	lines.push(`,資産合計,${data.totalAssets}`);
	lines.push('');

	// 負債の部
	lines.push('【負債の部】');
	lines.push('');

	// 流動負債
	lines.push('＜流動負債＞');
	for (const row of data.currentLiabilities) {
		lines.push(`${row.accountCode},${row.accountName},${row.amount}`);
	}
	const totalCurrentLiab = data.currentLiabilities.reduce((sum, r) => sum + r.amount, 0);
	lines.push(`,流動負債 合計,${totalCurrentLiab}`);
	lines.push('');

	// 固定負債
	lines.push('＜固定負債＞');
	for (const row of data.fixedLiabilities) {
		lines.push(`${row.accountCode},${row.accountName},${row.amount}`);
	}
	const totalFixedLiab = data.fixedLiabilities.reduce((sum, r) => sum + r.amount, 0);
	lines.push(`,固定負債 合計,${totalFixedLiab}`);
	lines.push('');

	lines.push(`,負債合計,${data.totalLiabilities}`);
	lines.push('');

	// 純資産の部
	lines.push('【純資産の部】');
	for (const row of data.equity) {
		lines.push(`${row.accountCode},${row.accountName},${row.amount}`);
	}
	if (data.retainedEarnings !== 0) {
		lines.push(`,繰越利益（当期純利益）,${data.retainedEarnings}`);
	}
	lines.push(`,純資産合計,${data.totalEquity}`);
	lines.push('');

	lines.push(`,負債・純資産合計,${data.totalLiabilitiesAndEquity}`);

	return lines.join('\n');
}
