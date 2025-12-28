<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Plus } from '@lucide/svelte';
	import JournalRow from '$lib/components/journal/JournalRow.svelte';
	import type { JournalEntry, Account } from '$lib/types';
	import {
		initializeDatabase,
		getAllAccounts,
		getJournalsByYear,
		getJournalById,
		addJournal,
		updateJournal,
		deleteJournal,
		createEmptyJournal
	} from '$lib/db';

	// 状態
	let journals = $state<JournalEntry[]>([]);
	let accounts = $state<Account[]>([]);
	let isLoading = $state(true);
	let deleteDialogOpen = $state(false);
	let deletingJournalId = $state<string | null>(null);
	let editingJournalId = $state<string | null>(null); // 新規追加で編集中の仕訳ID
	let flashingJournalId = $state<string | null>(null); // フラッシュ表示中の仕訳ID

	// 現在の年度（後でサイドバーの選択と連動）
	const currentYear = new Date().getFullYear();

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

	// 初期化
	onMount(async () => {
		await initializeDatabase();
		await loadData();
	});

	async function loadData() {
		isLoading = true;
		try {
			[accounts, journals] = await Promise.all([
				getAllAccounts(),
				getJournalsByYear(currentYear)
			]);
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
		}
	}

	// 仕訳の更新
	async function handleUpdateJournal(journal: JournalEntry) {
		// Svelte 5のリアクティブプロキシを除去してプレーンオブジェクトに変換
		const plainJournal = JSON.parse(JSON.stringify(journal)) as JournalEntry;

		// 既存仕訳の場合、日付変更でソート位置が変わったらフラッシュ
		const isExisting = editingJournalId !== journal.id;
		const oldJournal = journals.find((j) => j.id === journal.id);
		const dateChanged = oldJournal && oldJournal.date !== plainJournal.date;

		await updateJournal(plainJournal.id, plainJournal);
		// ローカル状態も更新し、日付順にソート（編集中は上に固定）
		const updated = journals.map((j) => (j.id === journal.id ? plainJournal : j));
		journals = sortJournals(updated, editingJournalId);

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

	// 仕訳の削除
	async function handleDeleteJournal() {
		if (!deletingJournalId) return;
		await deleteJournal(deletingJournalId);
		deleteDialogOpen = false;
		deletingJournalId = null;
		await loadData();
	}
</script>

<div class="space-y-4">
	<!-- ヘッダー -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold">仕訳帳</h1>
			<p class="text-sm text-muted-foreground">{currentYear}年度</p>
		</div>
		<Button onclick={handleAddJournal}>
			<Plus class="mr-2 size-4" />
			新規仕訳
		</Button>
	</div>

	<!-- 仕訳リスト -->
	{#if isLoading}
		<div class="flex items-center justify-center py-8">
			<p class="text-muted-foreground">読み込み中...</p>
		</div>
	{:else if journals.length === 0}
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
				<p class="mb-4 mt-2 text-sm text-muted-foreground">
					「新規仕訳」ボタンから最初の仕訳を追加しましょう
				</p>
				<Button onclick={handleAddJournal}>
					<Plus class="mr-2 size-4" />
					新規仕訳を追加
				</Button>
			</div>
		</div>
	{:else}
		<div class="space-y-4">
			{#each journals as journal (journal.id)}
				<JournalRow
					{journal}
					{accounts}
					isEditing={editingJournalId === journal.id}
					isFlashing={flashingJournalId === journal.id}
					onupdate={handleUpdateJournal}
					ondelete={openDeleteDialog}
					onconfirm={handleConfirmJournal}
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
			<Dialog.Description>
				この仕訳を削除しますか？この操作は取り消せません。
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (deleteDialogOpen = false)}>キャンセル</Button>
			<Button variant="destructive" onclick={handleDeleteJournal}>削除</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
