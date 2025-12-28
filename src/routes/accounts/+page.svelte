<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import {
		Plus,
		Pencil,
		Trash2,
		Receipt,
		Wallet,
		TrendingUp,
		CreditCard,
		Gem
	} from '@lucide/svelte';
	import type { Account, AccountType } from '$lib/types';
	import { AccountTypeLabels } from '$lib/types';
	import {
		db,
		initializeDatabase,
		getAllAccounts,
		addAccount,
		updateAccount,
		deleteAccount,
		isAccountInUse,
		generateNextCode
	} from '$lib/db';

	// 状態
	let accounts = $state<Account[]>([]);
	let isLoading = $state(true);
	let dialogOpen = $state(false);
	let deleteDialogOpen = $state(false);
	let editingAccount = $state<Account | null>(null);
	let deletingAccount = $state<Account | null>(null);
	let isAccountUsed = $state(false);

	// フォーム状態
	let formCode = $state('');
	let formName = $state('');
	let formType = $state<AccountType>('expense');
	let formError = $state('');

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

	async function openAddDialog() {
		editingAccount = null;
		formName = '';
		formType = 'expense';
		formError = '';
		formCode = await generateNextCode('expense');
		dialogOpen = true;
	}

	async function handleTypeChange(newType: AccountType) {
		formType = newType;
		if (!editingAccount) {
			// 新規追加時のみコードを自動生成
			formCode = await generateNextCode(newType);
		}
	}

	function openEditDialog(account: Account) {
		editingAccount = account;
		formCode = account.code;
		formName = account.name;
		formType = account.type;
		formError = '';
		dialogOpen = true;
	}

	async function openDeleteDialog(account: Account) {
		deletingAccount = account;
		isAccountUsed = await isAccountInUse(account.code);
		deleteDialogOpen = true;
	}

	async function handleSubmit() {
		formError = '';

		if (!formCode.trim()) {
			formError = '勘定科目コードを入力してください';
			return;
		}
		if (!formName.trim()) {
			formError = '勘定科目名を入力してください';
			return;
		}

		try {
			if (editingAccount) {
				// 更新
				await updateAccount(editingAccount.code, {
					name: formName.trim(),
					type: formType
				});
			} else {
				// 新規追加
				const existing = await db.accounts.get(formCode.trim());
				if (existing) {
					formError = 'この勘定科目コードは既に使用されています';
					return;
				}
				await addAccount({
					code: formCode.trim(),
					name: formName.trim(),
					type: formType
				});
			}
			dialogOpen = false;
			await loadAccounts();
		} catch (error) {
			formError = error instanceof Error ? error.message : '保存に失敗しました';
		}
	}

	async function handleDelete() {
		if (!deletingAccount) return;

		try {
			await deleteAccount(deletingAccount.code);
			deleteDialogOpen = false;
			deletingAccount = null;
			await loadAccounts();
		} catch (error) {
			console.error('Delete failed:', error);
		}
	}
</script>

<div class="space-y-6">
	<!-- ヘッダー -->
	<div class="flex items-center justify-between">
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
									<div class="px-2 py-1 text-sm text-muted-foreground">
										{account.name}
									</div>
								{:else}
									<div
										class="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-sm font-medium dark:border-slate-700 dark:bg-slate-800"
									>
										<span>{account.name}</span>
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

<!-- 追加/編集ダイアログ -->
<Dialog.Root bind:open={dialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>
				{editingAccount ? '勘定科目を編集' : '勘定科目を追加'}
			</Dialog.Title>
			<Dialog.Description>
				{editingAccount ? '勘定科目の情報を編集します' : '新しい勘定科目を追加します'}
			</Dialog.Description>
		</Dialog.Header>
		<form
			class="space-y-4"
			onsubmit={(e) => {
				e.preventDefault();
				handleSubmit();
			}}
		>
			<div class="space-y-2">
				<Label for="type">カテゴリ</Label>
				<Select.Root
					type="single"
					value={formType}
					onValueChange={(v) => v && handleTypeChange(v as AccountType)}
					disabled={!!editingAccount}
				>
					<Select.Trigger class="w-full">
						{AccountTypeLabels[formType]}
					</Select.Trigger>
					<Select.Content>
						{#each typeOrder as t (t)}
							<Select.Item value={t}>{AccountTypeLabels[t]}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
			<div class="space-y-2">
				<Label for="name">勘定科目名</Label>
				<Input id="name" bind:value={formName} placeholder="例: 車両費" />
			</div>
			{#if formError}
				<p class="text-sm text-destructive">{formError}</p>
			{/if}
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (dialogOpen = false)}>
					キャンセル
				</Button>
				<Button type="submit">
					{editingAccount ? '更新' : '追加'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- 削除確認ダイアログ -->
<Dialog.Root bind:open={deleteDialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>勘定科目を削除</Dialog.Title>
			<Dialog.Description>
				{#if deletingAccount}
					「{deletingAccount.name}」を削除しますか？
				{/if}
			</Dialog.Description>
		</Dialog.Header>
		{#if isAccountUsed}
			<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
				この勘定科目は仕訳で使用されているため削除できません。
			</div>
		{/if}
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (deleteDialogOpen = false)}>キャンセル</Button>
			<Button variant="destructive" onclick={handleDelete} disabled={isAccountUsed}>削除</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
