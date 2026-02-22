/**
 * 帳簿ページ共通の初期化フック
 *
 * 以下のページで共通の初期化パターンを提供:
 * - 総勘定元帳、試算表、損益計算書、貸借対照表、消費税集計
 *
 * 共通処理:
 * 1. initializeDatabase()
 * 2. getAllAccounts() （オプション）
 * 3. getJournalsByYear(selectedYear)
 * 4. isLoading = false
 * 5. handleYearChange で年度切り替え
 */
import { onMount } from 'svelte';
import { initializeDatabase, getJournalsByYear, getAllAccounts } from '$lib/db';
import { useFiscalYear, setSelectedYear } from '$lib/stores/fiscalYear.svelte';
import type { Account, JournalEntry } from '$lib/types';

interface UseJournalPageOptions {
	/** 勘定科目マスタを読み込むか（デフォルト: true） */
	loadAccounts?: boolean;
}

/**
 * 帳簿ページ共通フック
 *
 * @example
 * ```svelte
 * const page = useJournalPage();
 *
 * // 仕訳データが変わったら自動再計算（$derived で使用）
 * const trialBalance = $derived.by(() => {
 *   if (page.journals.length === 0 || page.accounts.length === 0) return null;
 *   return groupTrialBalance(generateTrialBalance(page.journals, page.accounts));
 * });
 * ```
 */
export function useJournalPage(options: UseJournalPageOptions = {}) {
	const { loadAccounts = true } = options;

	let isLoading = $state(true);
	let accounts = $state<Account[]>([]);
	let journals = $state<JournalEntry[]>([]);
	const fiscalYear = useFiscalYear();

	onMount(async () => {
		await initializeDatabase();
		if (loadAccounts) {
			accounts = await getAllAccounts();
		}
		journals = await getJournalsByYear(fiscalYear.selectedYear);
		isLoading = false;
	});

	async function handleYearChange(year: number) {
		setSelectedYear(year);
		journals = await getJournalsByYear(year);
	}

	/** 年度データを再読み込み */
	async function reload() {
		journals = await getJournalsByYear(fiscalYear.selectedYear);
	}

	return {
		get isLoading() {
			return isLoading;
		},
		get accounts() {
			return accounts;
		},
		get journals() {
			return journals;
		},
		fiscalYear,
		handleYearChange,
		reload
	};
}
