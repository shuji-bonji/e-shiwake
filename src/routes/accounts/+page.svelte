<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		Plus,
		Pencil,
		Trash2,
		Receipt,
		Wallet,
		TrendingUp,
		CreditCard,
		Gem,
		Percent
	} from '@lucide/svelte';
	import type { Account, AccountType } from '$lib/types';
	import { AccountTypeLabels } from '$lib/types';
	import { initializeDatabase, getAllAccounts } from '$lib/db';
	import { BUSINESS_RATIO_CONFIGURABLE_ACCOUNTS } from '$lib/constants/accounts';
	import AccountEditDialog from '$lib/components/accounts/AccountEditDialog.svelte';
	import AccountDeleteDialog from '$lib/components/accounts/AccountDeleteDialog.svelte';

	// 状態
	let accounts = $state<Account[]>([]);
	let isLoading = $state(true);
	let dialogOpen = $state(false);
	let deleteDialogOpen = $state(false);
	let editingAccount = $state<Account | null>(null);
	let deletingAccount = $state<Account | null>(null);

	// カテゴリ順序（フリーランス向け: よく使う順）
	const typeOrder: AccountType[] = ['expense', 'asset', 'revenue', 'liability', 'equity'];

	// カテゴリごとのアイコン
	const categoryIcons: Record<AccountType, typeof Receipt> = {
		expense: Receipt,
		asset: Wallet,
		revenue: TrendingUp,
		liability: CreditCard,
		equity: Gem
	};

	// カテゴリ別にグループ化
	const groupedAccounts = $derived.by(() => {
		const groups: Record<AccountType, Account[]> = {
			asset: [],
			liability: [],
			equity: [],
			revenue: [],
			expense: []
		};

		for (const account of accounts) {
			groups[account.type].push(account);
		}

		return groups;
	});

	// 初期化
	onMount(async () => {
		await initializeDatabase();
		await loadAccounts();
	});

	async function loadAccounts() {
		isLoading = true;
		try {
			accounts = await getAllAccounts();
		} finally {
			isLoading = false;
		}
	}

	function openAddDialog() {
		editingAccount = null;
		dialogOpen = true;
	}

	function openEditDialog(account: Account) {
		editingAccount = account;
		dialogOpen = true;
	}

	function openDeleteDialog(account: Account) {
		deletingAccount = account;
		deleteDialogOpen = true;
	}
</script>

<div class="space-y-6">
	<!-- ヘッダー -->
	<div
		class="sticky top-14 z-10 -mx-4 flex items-center justify-between border-b bg-background px-4 pt-4 pb-3 group-has-data-[collapsible=icon]/sidebar-wrapper:top-12"
	>
		<div>
			<h1 class="text-2xl font-bold">勘定科目</h1>
			<p class="text-sm text-muted-foreground">勘定科目の追加・編集・削除を行います</p>
		</div>
		<Button onclick={openAddDialog}>
			<Plus class="mr-2 size-4" />
			勘定科目を追加
		</Button>
	</div>

	{#if isLoading}
		<div class="flex items-center justify-center py-8">
			<p class="text-muted-foreground">読み込み中...</p>
		</div>
	{:else}
		<!-- カテゴリ別グリッド表示 -->
		<div class="space-y-6">
			{#each typeOrder as type (type)}
				{@const typeAccounts = groupedAccounts[type]}
				{@const Icon = categoryIcons[type]}
				{#if typeAccounts.length > 0}
					<div>
						<!-- カテゴリヘッダー -->
						<div class="mb-2 flex items-center gap-1.5 bg-muted px-2 py-1.5">
							<Icon class="size-4 text-muted-foreground" />
							<span class="text-sm font-semibold">{AccountTypeLabels[type]}</span>
							<span class="text-xs text-muted-foreground">({typeAccounts.length})</span>
						</div>
						<!-- 科目グリッド -->
						<div class="flex flex-wrap gap-1">
							{#each typeAccounts as account (account.code)}
								{#if account.isSystem}
									<div class="flex items-center gap-1 px-2 py-1 text-sm text-muted-foreground">
										{account.name}
										{#if BUSINESS_RATIO_CONFIGURABLE_ACCOUNTS.includes(account.code)}
											<button
												type="button"
												class="rounded p-0.5 hover:bg-amber-100 dark:hover:bg-amber-900/30"
												onclick={() => openEditDialog(account)}
												title="按分設定"
											>
												<Percent
													class="size-3 {account.businessRatioEnabled
														? 'text-amber-500'
														: 'text-muted-foreground/50'}"
												/>
											</button>
										{/if}
									</div>
								{:else}
									<div
										class="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-sm font-medium dark:border-slate-700 dark:bg-slate-800"
									>
										<span>{account.name}</span>
										{#if account.businessRatioEnabled}
											<Percent class="size-3 text-amber-500" />
										{/if}
										<button
											type="button"
											class="rounded p-0.5 text-muted-foreground hover:bg-slate-200 hover:text-foreground dark:hover:bg-slate-600"
											onclick={() => openEditDialog(account)}
										>
											<Pencil class="size-3" />
											<span class="sr-only">編集</span>
										</button>
										<button
											type="button"
											class="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
											onclick={() => openDeleteDialog(account)}
										>
											<Trash2 class="size-3" />
											<span class="sr-only">削除</span>
										</button>
									</div>
								{/if}
							{/each}
						</div>
					</div>
				{/if}
			{/each}
		</div>
	{/if}
</div>

<!-- 追加/編集ダイアログ（同期確認含む） -->
<AccountEditDialog bind:open={dialogOpen} {editingAccount} onsave={loadAccounts} />

<!-- 削除確認ダイアログ -->
<AccountDeleteDialog
	bind:open={deleteDialogOpen}
	account={deletingAccount}
	ondelete={loadAccounts}
/>
