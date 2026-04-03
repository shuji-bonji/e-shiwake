import type { JournalEntry, Account, AccountType } from '$lib/types';

/**
 * 試算表の1行（勘定科目ごとの借方・貸方の合計と残高）
 *
 * 合計残高試算表と残高試算表の両方に対応する。
 * - 合計: debitTotal / creditTotal（借方・貸方の合計金額）
 * - 残高: debitBalance / creditBalance（差引残高、どちらか一方のみ正値）
 */
export interface TrialBalanceRow {
	accountCode: string;
	accountName: string;
	accountType: AccountType;
	debitTotal: number; // 借方合計
	creditTotal: number; // 貸方合計
	debitBalance: number; // 借方残高
	creditBalance: number; // 貸方残高
}

/**
 * 試算表データ（全勘定科目の集約結果）
 *
 * 全科目の合計と残高を保持し、貸借一致チェック（isBalanced）を提供する。
 * 複式簿記の原則により、totalDebit === totalCredit であれば正常。
 */
export interface TrialBalanceData {
	rows: TrialBalanceRow[];
	totalDebit: number;
	totalCredit: number;
	totalDebitBalance: number;
	totalCreditBalance: number;
	isBalanced: boolean; // 貸借一致しているか
}

/**
 * 勘定科目タイプ別のグループ（資産/負債/純資産/収益/費用）
 *
 * 試算表を5分類にグループ化した際の各カテゴリを表す。
 * 各グループには小計（subtotal）が含まれる。
 */
export interface TrialBalanceGroup {
	type: AccountType;
	label: string;
	rows: TrialBalanceRow[];
	subtotalDebit: number;
	subtotalCredit: number;
	subtotalDebitBalance: number;
	subtotalCreditBalance: number;
}

/**
 * グループ化された試算表データ
 *
 * 資産→負債→純資産→収益→費用の順に並んだグループと、
 * 全体の合計・残高・貸借一致フラグを保持する。
 */
export interface GroupedTrialBalanceData {
	groups: TrialBalanceGroup[];
	totalDebit: number;
	totalCredit: number;
	totalDebitBalance: number;
	totalCreditBalance: number;
	isBalanced: boolean;
}

const TYPE_LABELS: Record<AccountType, string> = {
	asset: '資産',
	liability: '負債',
	equity: '純資産',
	revenue: '収益',
	expense: '費用'
};

const TYPE_ORDER: AccountType[] = ['asset', 'liability', 'equity', 'revenue', 'expense'];

/**
 * 仕訳データから試算表（合計残高試算表）を生成する。
 *
 * 全仕訳の明細行を走査し、勘定科目ごとに借方・貸方の合計金額を集計。
 * 各科目の差引残高（借方残高 or 貸方残高）を算出し、
 * 全体の貸借一致チェック（totalDebit === totalCredit）を行う。
 *
 * @param journals - 対象年度の仕訳一覧
 * @param accounts - 勘定科目マスタ（科目名・タイプの解決に使用）
 * @returns 試算表データ（科目コード昇順、貸借一致フラグ付き）
 */
export function generateTrialBalance(
	journals: JournalEntry[],
	accounts: Account[]
): TrialBalanceData {
	const accountMap = new Map(accounts.map((a) => [a.code, a]));

	// 科目ごとの集計
	const totals = new Map<string, { debit: number; credit: number }>();

	for (const journal of journals) {
		for (const line of journal.lines) {
			const current = totals.get(line.accountCode) || { debit: 0, credit: 0 };

			if (line.type === 'debit') {
				current.debit += line.amount;
			} else {
				current.credit += line.amount;
			}

			totals.set(line.accountCode, current);
		}
	}

	// 試算表行を生成
	const rows: TrialBalanceRow[] = [];
	let totalDebit = 0;
	let totalCredit = 0;
	let totalDebitBalance = 0;
	let totalCreditBalance = 0;

	for (const [code, { debit, credit }] of totals) {
		const account = accountMap.get(code);
		if (!account) continue;

		// 残高計算（借方 - 貸方 で正なら借方残高、負なら貸方残高）
		const netBalance = debit - credit;

		const debitBalance = netBalance >= 0 ? netBalance : 0;
		const creditBalance = netBalance < 0 ? -netBalance : 0;

		rows.push({
			accountCode: code,
			accountName: account.name,
			accountType: account.type,
			debitTotal: debit,
			creditTotal: credit,
			debitBalance,
			creditBalance
		});

		totalDebit += debit;
		totalCredit += credit;
		totalDebitBalance += debitBalance;
		totalCreditBalance += creditBalance;
	}

	// コード順にソート
	rows.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

	return {
		rows,
		totalDebit,
		totalCredit,
		totalDebitBalance,
		totalCreditBalance,
		isBalanced: totalDebit === totalCredit
	};
}

/**
 * 試算表を勘定科目タイプ別（資産/負債/純資産/収益/費用）にグループ化する。
 *
 * generateTrialBalance() の結果を受け取り、各科目をタイプ別に分類。
 * グループごとの小計を算出する。使用されていないタイプのグループは除外される。
 *
 * @param data - generateTrialBalance() の出力
 * @returns グループ化された試算表データ
 */
export function groupTrialBalance(data: TrialBalanceData): GroupedTrialBalanceData {
	const groupMap = new Map<AccountType, TrialBalanceRow[]>();

	// タイプ別に分類
	for (const row of data.rows) {
		const existing = groupMap.get(row.accountType) || [];
		existing.push(row);
		groupMap.set(row.accountType, existing);
	}

	// グループを生成
	const groups: TrialBalanceGroup[] = [];

	for (const type of TYPE_ORDER) {
		const rows = groupMap.get(type) || [];
		if (rows.length === 0) continue;

		const subtotalDebit = rows.reduce((sum, r) => sum + r.debitTotal, 0);
		const subtotalCredit = rows.reduce((sum, r) => sum + r.creditTotal, 0);
		const subtotalDebitBalance = rows.reduce((sum, r) => sum + r.debitBalance, 0);
		const subtotalCreditBalance = rows.reduce((sum, r) => sum + r.creditBalance, 0);

		groups.push({
			type,
			label: TYPE_LABELS[type],
			rows,
			subtotalDebit,
			subtotalCredit,
			subtotalDebitBalance,
			subtotalCreditBalance
		});
	}

	return {
		groups,
		totalDebit: data.totalDebit,
		totalCredit: data.totalCredit,
		totalDebitBalance: data.totalDebitBalance,
		totalCreditBalance: data.totalCreditBalance,
		isBalanced: data.isBalanced
	};
}

/**
 * 金額をカンマ区切りでフォーマットする。
 *
 * null または 0 の場合は空文字を返す（帳簿表示で空欄にするため）。
 *
 * @param amount - フォーマット対象の金額（nullも許容）
 * @returns フォーマット済み文字列（例: "1,234"）、0/nullの場合は空文字
 */
export function formatAmount(amount: number | null): string {
	if (amount === null || amount === 0) return '';
	return amount.toLocaleString('ja-JP');
}
