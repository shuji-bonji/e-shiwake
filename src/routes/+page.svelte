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

	// 現在の年度（後でサイドバーの選択と連動）
	const currentYear = new Date().getFullYear();

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
		await addJournal(emptyJournal);
		await loadData();
	}

	// 仕訳の更新
	async function handleUpdateJournal(journal: JournalEntry) {
		// Svelte 5のリアクティブプロキシを除去してプレーンオブジェクトに変換
		const plainJournal = JSON.parse(JSON.stringify(journal)) as JournalEntry;
		await updateJournal(plainJournal.id, plainJournal);
		// ローカル状態も更新（再読み込みなしで即時反映）
		journals = journals.map((j) => (j.id === journal.id ? plainJournal : j));
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
					onupdate={handleUpdateJournal}
					ondelete={openDeleteDialog}
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
