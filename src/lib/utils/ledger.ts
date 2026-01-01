import type { JournalEntry, Account } from '$lib/types';

/**
 * 元帳の1行
 */
export interface LedgerEntry {
	date: string;
	journalId: string;
	description: string;
	vendor: string;
	counterAccount: string; // 相手科目（複合仕訳は「諸口」）
	debit: number | null;
	credit: number | null;
	balance: number;
}

/**
 * 元帳データ
 */
export interface LedgerData {
	accountCode: string;
	accountName: string;
	accountType: string;
	entries: LedgerEntry[];
	openingBalance: number; // 期首残高
	totalDebit: number;
	totalCredit: number;
	closingBalance: number; // 期末残高
}

/**
 * 仕訳から総勘定元帳を生成
 *
 * @param journals 仕訳一覧（日付順にソート済み）
 * @param accountCode 対象の勘定科目コード
 * @param accounts 勘定科目マスタ
 * @param openingBalance 期首残高（デフォルト0）
 */
export function generateLedger(
	journals: JournalEntry[],
	accountCode: string,
	accounts: Account[],
	openingBalance: number = 0
): LedgerData {
	const account = accounts.find((a) => a.code === accountCode);
	if (!account) {
		throw new Error(`勘定科目が見つかりません: ${accountCode}`);
	}

	const accountMap = new Map(accounts.map((a) => [a.code, a.name]));

	// この科目に関連する仕訳を抽出
	const entries: LedgerEntry[] = [];
	let balance = openingBalance;
	let totalDebit = 0;
	let totalCredit = 0;

	// 日付順にソート
	const sortedJournals = [...journals].sort(
		(a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)
	);

	for (const journal of sortedJournals) {
		// この仕訳に対象科目が含まれているか
		const targetLines = journal.lines.filter((l) => l.accountCode === accountCode);
		if (targetLines.length === 0) continue;

		// 相手科目を特定
		const otherLines = journal.lines.filter((l) => l.accountCode !== accountCode);
		let counterAccount: string;

		if (otherLines.length === 0) {
			counterAccount = '-';
		} else if (otherLines.length === 1) {
			counterAccount = accountMap.get(otherLines[0].accountCode) || otherLines[0].accountCode;
		} else {
			counterAccount = '諸口';
		}

		// 借方・貸方金額を集計
		let debit = 0;
		let credit = 0;

		for (const line of targetLines) {
			if (line.type === 'debit') {
				debit += line.amount;
			} else {
				credit += line.amount;
			}
		}

		// 残高計算（資産・費用は借方+、負債・純資産・収益は貸方+）
		const isDebitBalance = account.type === 'asset' || account.type === 'expense';
		if (isDebitBalance) {
			balance = balance + debit - credit;
		} else {
			balance = balance - debit + credit;
		}

		totalDebit += debit;
		totalCredit += credit;

		entries.push({
			date: journal.date,
			journalId: journal.id,
			description: journal.description,
			vendor: journal.vendor,
			counterAccount,
			debit: debit > 0 ? debit : null,
			credit: credit > 0 ? credit : null,
			balance
		});
	}

	return {
		accountCode,
		accountName: account.name,
		accountType: account.type,
		entries,
		openingBalance,
		totalDebit,
		totalCredit,
		closingBalance: balance
	};
}

/**
 * 使用されている勘定科目の一覧を取得
 */
export function getUsedAccounts(journals: JournalEntry[], accounts: Account[]): Account[] {
	const usedCodes = new Set<string>();

	for (const journal of journals) {
		for (const line of journal.lines) {
			usedCodes.add(line.accountCode);
		}
	}

	return accounts.filter((a) => usedCodes.has(a.code)).sort((a, b) => a.code.localeCompare(b.code));
}
