import type { JournalEntry, Account } from '$lib/types';

/**
 * 元帳の1行（総勘定元帳の各取引を表す）
 *
 * 1つの仕訳から対象科目に関連する借方・貸方金額と残高を保持する。
 * 相手科目が複数ある場合（複合仕訳）は「諸口」と表示される。
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
 * 総勘定元帳データ（特定の勘定科目に対する全取引の集約）
 *
 * 期首残高から始まり、各取引の借方・貸方を積み上げて期末残高を算出する。
 * 残高の増減方向は勘定科目タイプに依存する：
 * - 資産・費用: 借方で増加、貸方で減少
 * - 負債・純資産・収益: 貸方で増加、借方で減少
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
 * 仕訳データから特定の勘定科目の総勘定元帳を生成する。
 *
 * 処理の流れ:
 * 1. 仕訳を日付順（同日はcreatedAt順）にソート
 * 2. 各仕訳から対象科目の借方・貸方金額を集計
 * 3. 科目タイプに応じた残高計算（資産・費用は借方+、それ以外は貸方+）
 * 4. 相手科目の特定（1科目なら科目名、複数なら「諸口」）
 *
 * @param journals - 対象年度の仕訳一覧
 * @param accountCode - 元帳を生成する勘定科目コード（4桁）
 * @param accounts - 勘定科目マスタ（相手科目名の解決に使用）
 * @param openingBalance - 期首残高（前年度からの繰越額、デフォルト0）
 * @returns 元帳データ（取引一覧・合計・期末残高を含む）
 * @throws 指定した勘定科目コードがマスタに存在しない場合
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
 * 仕訳で実際に使用されている勘定科目の一覧を取得する。
 *
 * 仕訳明細行に含まれる全勘定科目コードを抽出し、
 * マスタと照合して科目コード昇順でソートして返す。
 * 総勘定元帳の科目選択ドロップダウンなどで使用される。
 *
 * @param journals - 対象の仕訳一覧
 * @param accounts - 勘定科目マスタ
 * @returns 使用中の勘定科目（コード昇順）
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
