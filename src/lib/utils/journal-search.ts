import type { JournalEntry, Account } from '$lib/types';

/**
 * パース済みの検索条件を保持するインターフェース
 *
 * ユーザーが入力した検索クエリを`parseSearchQuery`で解析した結果。
 * 複数の検索条件を組み合わせてAND検索を実行する。
 */
export interface SearchCriteria {
	/** 摘要・取引先の検索テキスト（部分一致） */
	text: string[];
	/** 勘定科目コード */
	accounts: string[];
	/** 金額（完全一致） */
	amounts: number[];
	/** 年（YYYY形式） */
	year?: number;
	/** 年月（YYYY-MM形式） */
	yearMonth?: string;
	/** 月のみ（1-12） */
	month?: number;
	/** 完全な日付（YYYY-MM-DD形式） */
	date?: string;
	/** 月日（MM-DD形式、年度内検索用） */
	monthDay?: string;
}

/**
 * 検索クエリ文字列をパースして検索条件に変換する
 *
 * スペース区切りで複数の検索条件を指定でき、すべてがAND条件で適用される。
 * 金額、日付、月などのパターンを自動的に判別し、対応する検索条件に振り分ける。
 *
 * @param query 検索クエリ文字列（スペース区切りで複数条件を指定）
 * @param accounts 勘定科目一覧（科目名 → コード のマッチング用）
 * @returns 検索条件オブジェクト
 *
 * @example
 * // 「Amazon」と「12月」と「消耗品費」をAND検索
 * parseSearchQuery("Amazon 12月 消耗品費", accounts)
 * // => { text: ["amazon"], accounts: ["5001"], month: 12 }
 *
 * @example
 * // 金額検索（カンマ付きでも可）
 * parseSearchQuery("Amazon 10000", accounts)
 * // => { text: ["amazon"], amounts: [10000] }
 *
 * @example
 * // 日付検索（複数フォーマット対応）
 * parseSearchQuery("2025-01-15", accounts)
 * // => { date: "2025-01-15" }
 */
export function parseSearchQuery(query: string, accounts: Account[]): SearchCriteria {
	const tokens = query.trim().split(/\s+/).filter(Boolean);
	const criteria: SearchCriteria = {
		text: [],
		accounts: [],
		amounts: []
	};

	// 勘定科目名 → コード のマップを作成
	const accountNameToCode = new Map<string, string>();
	for (const account of accounts) {
		accountNameToCode.set(account.name, account.code);
	}

	for (const token of tokens) {
		// YYYY-MM-DD（完全な日付）
		if (/^\d{4}-\d{2}-\d{2}$/.test(token)) {
			criteria.date = token;
			continue;
		}

		// YYYY-MM（年月）
		if (/^\d{4}-\d{2}$/.test(token)) {
			criteria.yearMonth = token;
			continue;
		}

		// YYYY/MM/DD または YYYY/M/D
		const slashDateMatch = token.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
		if (slashDateMatch) {
			const y = slashDateMatch[1];
			const m = slashDateMatch[2].padStart(2, '0');
			const d = slashDateMatch[3].padStart(2, '0');
			criteria.date = `${y}-${m}-${d}`;
			continue;
		}

		// YYYY年（年指定）
		const yearJaMatch = token.match(/^(\d{4})年$/);
		if (yearJaMatch) {
			criteria.year = parseInt(yearJaMatch[1], 10);
			continue;
		}

		// YYYY-（ハイフン末尾で年指定）
		const yearHyphenMatch = token.match(/^(\d{4})-$/);
		if (yearHyphenMatch) {
			criteria.year = parseInt(yearHyphenMatch[1], 10);
			continue;
		}

		// YYYY/MM（スラッシュ区切り年月）
		const slashYearMonthMatch = token.match(/^(\d{4})\/(\d{1,2})$/);
		if (slashYearMonthMatch) {
			const y = slashYearMonthMatch[1];
			const m = slashYearMonthMatch[2].padStart(2, '0');
			criteria.yearMonth = `${y}-${m}`;
			continue;
		}

		// MM月 or M月
		const monthMatch = token.match(/^(\d{1,2})月$/);
		if (monthMatch) {
			const month = parseInt(monthMatch[1], 10);
			if (month >= 1 && month <= 12) {
				criteria.month = month;
			}
			continue;
		}

		// MM/DD or M/D（月日）
		const mdMatch = token.match(/^(\d{1,2})\/(\d{1,2})$/);
		if (mdMatch) {
			const m = mdMatch[1].padStart(2, '0');
			const d = mdMatch[2].padStart(2, '0');
			criteria.monthDay = `${m}-${d}`;
			continue;
		}

		// 数字のみ → 金額
		if (/^\d+$/.test(token)) {
			criteria.amounts.push(parseInt(token, 10));
			continue;
		}

		// カンマ付き数字 → 金額（例：10,000）
		if (/^[\d,]+$/.test(token)) {
			const amount = parseInt(token.replace(/,/g, ''), 10);
			if (!isNaN(amount)) {
				criteria.amounts.push(amount);
			}
			continue;
		}

		// 勘定科目名に完全一致
		const accountCode = accountNameToCode.get(token);
		if (accountCode) {
			criteria.accounts.push(accountCode);
			continue;
		}

		// 勘定科目名に部分一致（前方一致）
		let foundAccount = false;
		for (const [name, code] of accountNameToCode) {
			if (name.startsWith(token) || token.startsWith(name)) {
				criteria.accounts.push(code);
				foundAccount = true;
				break;
			}
		}
		if (foundAccount) continue;

		// その他 → テキスト検索（摘要・取引先）
		criteria.text.push(token.toLowerCase());
	}

	return criteria;
}

/**
 * 検索条件で仕訳をフィルタリングする
 *
 * 指定された検索条件のすべてをAND条件で適用し、マッチした仕訳を返す。
 *
 * @param journals フィルタリング対象の仕訳配列
 * @param criteria 検索条件
 * @returns 検索条件にマッチした仕訳の配列
 */
export function filterJournals(journals: JournalEntry[], criteria: SearchCriteria): JournalEntry[] {
	return journals.filter((journal) => {
		// テキスト検索（摘要・取引先）- すべてのテキストに一致する必要がある
		if (criteria.text.length > 0) {
			const descLower = journal.description.toLowerCase();
			const vendorLower = journal.vendor.toLowerCase();
			for (const text of criteria.text) {
				if (!descLower.includes(text) && !vendorLower.includes(text)) return false;
			}
		}

		// 勘定科目 - いずれかに一致すればOK
		if (criteria.accounts.length > 0) {
			const journalAccounts = journal.lines.map((l) => l.accountCode);
			const hasMatch = criteria.accounts.some((a) => journalAccounts.includes(a));
			if (!hasMatch) return false;
		}

		// 金額 - いずれかに一致すればOK
		if (criteria.amounts.length > 0) {
			const journalAmounts = journal.lines.map((l) => l.amount);
			const hasMatch = criteria.amounts.some((a) => journalAmounts.includes(a));
			if (!hasMatch) return false;
		}

		// 年（YYYY）
		if (criteria.year && !journal.date.startsWith(String(criteria.year))) {
			return false;
		}

		// 日付（完全一致）
		if (criteria.date && journal.date !== criteria.date) {
			return false;
		}

		// 年月（前方一致）
		if (criteria.yearMonth && !journal.date.startsWith(criteria.yearMonth)) {
			return false;
		}

		// 月のみ
		if (criteria.month) {
			const journalMonth = parseInt(journal.date.substring(5, 7), 10);
			if (journalMonth !== criteria.month) return false;
		}

		// 月日（MM-DD）
		if (criteria.monthDay) {
			const journalMonthDay = journal.date.substring(5); // MM-DD
			if (journalMonthDay !== criteria.monthDay) return false;
		}

		return true;
	});
}

/**
 * 検索クエリが空かどうかを判定する
 *
 * 空文字列、空白のみの文字列の場合は`true`を返す。
 *
 * @param query 検索クエリ文字列
 * @returns クエリが空またはホワイトスペースのみの場合`true`
 */
export function isEmptyQuery(query: string): boolean {
	return !query.trim();
}
