<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Plus, Search, X } from '@lucide/svelte';
	import JournalRow from '$lib/components/journal/JournalRow.svelte';
	import SearchHelp from '$lib/components/journal/SearchHelp.svelte';
	import type { JournalEntry, Account, Vendor } from '$lib/types';
	import {
		initializeDatabase,
		getAllAccounts,
		getAllVendors,
		getJournalsByYear,
		getAllJournals,
		getJournalById,
		addJournal,
		updateJournal,
		deleteJournal,
		createEmptyJournal,
		getAvailableYears,
		getStorageMode
	} from '$lib/db';
	import { useFiscalYear, setAvailableYears } from '$lib/stores/fiscalYear.svelte.js';
	import { getSavedDirectoryHandle, supportsFileSystemAccess } from '$lib/utils/filesystem';
	import { cloneJournal } from '$lib/utils/clone';
	import { parseSearchQuery, filterJournals, isEmptyQuery } from '$lib/utils/journal-search';
	import { copyJournalForNew } from '$lib/utils/journal-copy';

	// 年度ストア
	const fiscalYear = useFiscalYear();

	// 状態
	let journals = $state<JournalEntry[]>([]); // 選択中年度の仕訳
	let allJournals = $state<JournalEntry[]>([]); // 全年度の仕訳（検索用）
	let accounts = $state<Account[]>([]);
	let vendors = $state<Vendor[]>([]);
	let directoryHandle = $state<FileSystemDirectoryHandle | null>(null);
	let isLoading = $state(true);
	let deleteDialogOpen = $state(false);
	let deletingJournalId = $state<string | null>(null);
	let editingJournalId = $state<string | null>(null); // 新規追加で編集中の仕訳ID
	let flashingJournalId = $state<string | null>(null); // フラッシュ表示中の仕訳ID
	let isInitialized = $state(false); // 初期化完了フラグ
	let searchQuery = $state(''); // 検索クエリ

	// 検索中かどうか
	const isSearching = $derived(!isEmptyQuery(searchQuery));

	// 検索条件でフィルタリングされた仕訳
	// 検索中は全年度から検索、通常時は選択年度のみ
	const filteredJournals = $derived.by(() => {
		const query = searchQuery;
		if (isEmptyQuery(query)) {
			return journals;
		}
		const criteria = parseSearchQuery(query, accounts);
		return filterJournals(allJournals, criteria);
	});

	// 仕訳をソート（編集中は常に上、それ以外は日付降順）
	function sortJournals(list: JournalEntry[], editingId: string | null = null): JournalEntry[] {
		return [...list].sort((a, b) => {
			// 編集中の仕訳は常に最上部
			if (editingId) {
				if (a.id === editingId) return -1;
				if (b.id === editingId) return 1;
			}
			// それ以外は日付降順、同日内は作成日時降順
			const dateCompare = b.date.localeCompare(a.date);
			if (dateCompare !== 0) return dateCompare;
			return b.createdAt.localeCompare(a.createdAt);
		});
	}

	// 前回ロードした年度を追跡（重複ロード防止）
	let lastLoadedYear = $state<number | null>(null);

	// 初期化
	onMount(async () => {
		await initializeDatabase();
		const years = await getAvailableYears();
		setAvailableYears(years);

		// ディレクトリハンドルを取得（File System Access API対応時）
		if (supportsFileSystemAccess()) {
			const storageMode = await getStorageMode();
			if (storageMode === 'filesystem') {
				directoryHandle = await getSavedDirectoryHandle();
			}
		}

		// 初期データを読み込み（全年度の仕訳も同時にロード）
		await loadData(fiscalYear.selectedYear);
		lastLoadedYear = fiscalYear.selectedYear;
		isInitialized = true;
	});

	// 年度変更時にデータを再読み込み（ページ滞在中の年度切り替え用）
	$effect(() => {
		const year = fiscalYear.selectedYear;
		// 初期化完了後、かつ年度が変わった場合のみ再読み込み
		if (isInitialized && year && year !== lastLoadedYear) {
			lastLoadedYear = year;
			loadData(year);
		}
	});

	async function loadData(year: number) {
		isLoading = true;
		editingJournalId = null; // 年度変更時は編集中状態をリセット
		try {
			// 全年度の仕訳も同時に読み込み（検索用）
			const [accts, vends, yearJournals, all] = await Promise.all([
				getAllAccounts(),
				getAllVendors(),
				getJournalsByYear(year),
				getAllJournals()
			]);
			accounts = accts;
			vendors = vends;
			journals = yearJournals;
			allJournals = all;
		} finally {
			isLoading = false;
		}
	}

	// 新規仕訳の追加
	async function handleAddJournal() {
		const emptyJournal = createEmptyJournal();
		const newId = await addJournal(emptyJournal);
		// 新規仕訳を取得してローカル状態に追加
		const newJournal = await getJournalById(newId);
		if (newJournal) {
			editingJournalId = newId; // 編集中としてマーク
			journals = sortJournals([newJournal, ...journals], newId);
			// 全年度の仕訳も更新
			refreshAllJournals();
		}
	}

	// 年度リストを更新
	async function refreshAvailableYears() {
		const years = await getAvailableYears();
		setAvailableYears(years);
	}

	// 全年度の仕訳を更新（検索用）
	async function refreshAllJournals() {
		allJournals = await getAllJournals();
	}

	// 仕訳の更新
	async function handleUpdateJournal(journal: JournalEntry) {
		// Svelte 5のリアクティブプロキシを除去してプレーンオブジェクトに変換
		// 注意: JSON.parse/stringifyはBlobを{}に変換するため使用不可
		const plainJournal = cloneJournal(journal);

		// 既存仕訳の場合、日付変更でソート位置が変わったらフラッシュ
		const isExisting = editingJournalId !== journal.id;
		const oldJournal = journals.find((j) => j.id === journal.id);
		const dateChanged = oldJournal && oldJournal.date !== plainJournal.date;

		await updateJournal(plainJournal.id, plainJournal);
		// ローカル状態も更新し、日付順にソート（編集中は上に固定）
		const updated = journals.map((j) => (j.id === journal.id ? plainJournal : j));
		journals = sortJournals(updated, editingJournalId);

		// 日付が変更された場合、年度リストを更新（新しい年度が追加される可能性）
		if (dateChanged) {
			await refreshAvailableYears();
		}

		// 取引先リストを更新（新規取引先が自動登録されるため）
		vendors = await getAllVendors();

		// 全年度の仕訳も更新
		refreshAllJournals();

		// 既存仕訳で日付が変わったらフラッシュ
		if (isExisting && dateChanged) {
			flashJournal(journal.id);
		}
	}

	// フラッシュ表示（一定時間後にクリア）
	function flashJournal(id: string) {
		flashingJournalId = id;
		setTimeout(() => {
			flashingJournalId = null;
		}, 1000);
	}

	// 編集確定（ソート位置へ移動）
	function handleConfirmJournal(id: string) {
		if (editingJournalId === id) {
			editingJournalId = null;
			journals = sortJournals(journals, null);
			flashJournal(id);
		}
	}

	// 削除確認ダイアログを開く
	function openDeleteDialog(id: string) {
		deletingJournalId = id;
		deleteDialogOpen = true;
	}

	// 仕訳の削除（添付ファイルも削除）
	async function handleDeleteJournal() {
		if (!deletingJournalId) return;
		await deleteJournal(deletingJournalId, directoryHandle);
		deleteDialogOpen = false;
		deletingJournalId = null;
		await refreshAvailableYears();
		await loadData(fiscalYear.selectedYear);
		// 全年度の仕訳も更新
		refreshAllJournals();
	}

	// 仕訳をコピーして新規作成
	async function handleCopyJournal(journal: JournalEntry) {
		const copiedData = copyJournalForNew(journal);
		const newId = await addJournal(copiedData);
		const newJournal = await getJournalById(newId);
		if (newJournal) {
			editingJournalId = newId;
			journals = sortJournals([newJournal, ...journals], newId);
			// 年度リストを更新（コピー元と年度が異なる場合に備えて）
			await refreshAvailableYears();
			// 全年度の仕訳も更新
			refreshAllJournals();
		}
	}

	// 検索をクリア
	function clearSearch() {
		searchQuery = '';
	}
</script>

<div class="space-y-4">
	<!-- ヘッダー -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold">仕訳帳</h1>
			<p class="text-sm text-muted-foreground">{fiscalYear.selectedYear}年度</p>
		</div>
		<Button onclick={handleAddJournal}>
			<Plus class="mr-2 size-4" />
			新規仕訳
		</Button>
	</div>

	<!-- 検索ボックス -->
	<div class="flex items-center gap-2">
		<div class="relative flex-1">
			<Search class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				type="text"
				placeholder="検索（摘要、取引先、勘定科目、金額、日付...）"
				bind:value={searchQuery}
				class="pr-10 pl-10"
			/>
			{#if searchQuery}
				<button
					type="button"
					onclick={clearSearch}
					class="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
					aria-label="検索をクリア"
				>
					<X class="size-4" />
				</button>
			{/if}
		</div>
		<SearchHelp />
	</div>

	<!-- 仕訳リスト -->
	{#if isLoading}
		<div class="flex items-center justify-center py-8">
			<p class="text-muted-foreground">読み込み中...</p>
		</div>
	{:else if !isSearching && journals.length === 0}
		<!-- 検索していない かつ 選択年度に仕訳がない -->
		<div
			class="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center"
		>
			<div class="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
				<div
					class="flex size-20 items-center justify-center rounded-full bg-muted"
					aria-hidden="true"
				>
					<Plus class="size-10 text-muted-foreground" />
				</div>
				<h3 class="mt-4 text-lg font-semibold">仕訳がありません</h3>
				<p class="mt-2 mb-4 text-sm text-muted-foreground">
					「新規仕訳」ボタンから最初の仕訳を追加しましょう
				</p>
				<Button onclick={handleAddJournal}>
					<Plus class="mr-2 size-4" />
					新規仕訳を追加
				</Button>
			</div>
		</div>
	{:else if filteredJournals.length === 0}
		<div
			class="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center"
		>
			<div class="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
				<div
					class="flex size-16 items-center justify-center rounded-full bg-muted"
					aria-hidden="true"
				>
					<Search class="size-8 text-muted-foreground" />
				</div>
				<h3 class="mt-4 text-lg font-semibold">検索結果がありません</h3>
				<p class="mt-2 mb-4 text-sm text-muted-foreground">
					検索条件に一致する仕訳が見つかりませんでした
				</p>
				<Button variant="outline" onclick={clearSearch}>
					<X class="mr-2 size-4" />
					検索をクリア
				</Button>
			</div>
		</div>
	{:else}
		{#if isSearching}
			<p class="text-sm text-muted-foreground">
				全年度から {filteredJournals.length}件の仕訳が見つかりました
			</p>
		{/if}
		<div class="space-y-4">
			{#each filteredJournals as journal (journal.id)}
				<JournalRow
					{journal}
					{accounts}
					{vendors}
					{directoryHandle}
					isEditing={editingJournalId === journal.id}
					isFlashing={flashingJournalId === journal.id}
					onupdate={handleUpdateJournal}
					ondelete={openDeleteDialog}
					onconfirm={handleConfirmJournal}
					oncopy={handleCopyJournal}
				/>
			{/each}
		</div>
	{/if}
</div>

<!-- 削除確認ダイアログ -->
<Dialog.Root bind:open={deleteDialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>仕訳を削除</Dialog.Title>
			<Dialog.Description>この仕訳を削除しますか？この操作は取り消せません。</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (deleteDialogOpen = false)}>キャンセル</Button>
			<Button variant="destructive" onclick={handleDeleteJournal}>削除</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
