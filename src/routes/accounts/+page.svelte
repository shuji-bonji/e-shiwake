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
		Gem,
		Percent
	} from '@lucide/svelte';
	import * as Switch from '$lib/components/ui/switch/index.js';
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
	import { BUSINESS_RATIO_CONFIGURABLE_ACCOUNTS } from '$lib/constants/accounts';

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
	let formBusinessRatioEnabled = $state(false);
	let formDefaultBusinessRatio = $state(30);

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
		formBusinessRatioEnabled = false;
		formDefaultBusinessRatio = 30;
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
		formBusinessRatioEnabled = account.businessRatioEnabled ?? false;
		formDefaultBusinessRatio = account.defaultBusinessRatio ?? 30;
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
					type: formType,
					businessRatioEnabled: formBusinessRatioEnabled,
					defaultBusinessRatio: formBusinessRatioEnabled ? formDefaultBusinessRatio : undefined
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
					type: formType,
					businessRatioEnabled: formBusinessRatioEnabled,
					defaultBusinessRatio: formBusinessRatioEnabled ? formDefaultBusinessRatio : undefined
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

<!-- 追加/編集ダイアログ -->
<Dialog.Root bind:open={dialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>
				{#if editingAccount?.isSystem}
					按分設定
				{:else if editingAccount}
					勘定科目を編集
				{:else}
					勘定科目を追加
				{/if}
			</Dialog.Title>
			<Dialog.Description>
				{#if editingAccount?.isSystem}
					「{editingAccount.name}」の家事按分設定を変更します
				{:else if editingAccount}
					勘定科目の情報を編集します
				{:else}
					新しい勘定科目を追加します
				{/if}
			</Dialog.Description>
		</Dialog.Header>
		<form
			class="space-y-4"
			onsubmit={(e) => {
				e.preventDefault();
				handleSubmit();
			}}
		>
			{#if !editingAccount?.isSystem}
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
			{/if}

			<!-- 家事按分設定（費用科目のみ表示） -->
			{#if formType === 'expense'}
				<div class="rounded-md border bg-muted/30 p-3">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<Percent class="size-4 text-amber-600" />
							<Label for="businessRatioEnabled" class="text-sm font-medium">家事按分対象</Label>
						</div>
						<Switch.Root
							id="businessRatioEnabled"
							checked={formBusinessRatioEnabled}
							onCheckedChange={(v) => (formBusinessRatioEnabled = v)}
						/>
					</div>
					{#if formBusinessRatioEnabled}
						<div class="mt-3 flex items-center gap-2">
							<Label for="defaultBusinessRatio" class="shrink-0 text-sm">デフォルト事業割合</Label>
							<Input
								id="defaultBusinessRatio"
								type="number"
								bind:value={formDefaultBusinessRatio}
								min={0}
								max={100}
								class="w-20 text-right"
							/>
							<span class="text-sm text-muted-foreground">%</span>
						</div>
						<p class="mt-1 text-xs text-muted-foreground">
							仕訳入力時にこの割合が初期値として設定されます
						</p>
					{/if}
				</div>
			{/if}

			{#if formError}
				<p class="text-sm text-destructive">{formError}</p>
			{/if}
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (dialogOpen = false)}>
					キャンセル
				</Button>
				<Button type="submit">
					{#if editingAccount?.isSystem}
						保存
					{:else if editingAccount}
						更新
					{:else}
						追加
					{/if}
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
