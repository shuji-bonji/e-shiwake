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
	import type { Account, AccountType, TaxCategory } from '$lib/types';
	import { AccountTypeLabels, TaxCategoryLabels } from '$lib/types';
	import {
		db,
		initializeDatabase,
		getAllAccounts,
		addAccount,
		updateAccount,
		deleteAccount,
		isAccountInUse,
		generateNextCode,
		countJournalLinesByAccountCode,
		updateTaxCategoryByAccountCode
	} from '$lib/db';
	import * as Checkbox from '$lib/components/ui/checkbox/index.js';
	import { BUSINESS_RATIO_CONFIGURABLE_ACCOUNTS } from '$lib/constants/accounts';

	// 状態
	let accounts = $state<Account[]>([]);
	let isLoading = $state(true);
	let dialogOpen = $state(false);
	let deleteDialogOpen = $state(false);
	let syncConfirmDialogOpen = $state(false);
	let editingAccount = $state<Account | null>(null);
	let deletingAccount = $state<Account | null>(null);
	let isAccountUsed = $state(false);
	let affectedJournalCount = $state(0);
	let shouldSyncJournals = $state(true);
	let pendingAccountUpdate = $state<{
		code: string;
		updates: Partial<Account>;
		newTaxCategory: TaxCategory;
	} | null>(null);

	// フォーム状態
	let formCode = $state('');
	let formName = $state('');
	let formType = $state<AccountType>('expense');
	let formError = $state('');
	let formBusinessRatioEnabled = $state(false);
	let formDefaultBusinessRatio = $state(30);
	let formDefaultTaxCategory = $state<TaxCategory | undefined>(undefined);

	// 勘定科目タイプ別のデフォルト消費税区分オプション
	const taxCategoryOptions: Record<AccountType, TaxCategory[]> = {
		expense: ['purchase_10', 'purchase_8', 'exempt', 'out_of_scope', 'na'],
		revenue: ['sales_10', 'sales_8', 'exempt', 'out_of_scope', 'na'],
		asset: ['na', 'purchase_10', 'purchase_8'],
		liability: ['na'],
		equity: ['na']
	};

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
		formDefaultTaxCategory = 'purchase_10'; // 費用のデフォルト
		formCode = await generateNextCode('expense');
		dialogOpen = true;
	}

	async function handleTypeChange(newType: AccountType) {
		formType = newType;
		if (!editingAccount) {
			// 新規追加時のみコードを自動生成
			formCode = await generateNextCode(newType);
			// タイプに応じたデフォルト消費税区分を設定
			const defaults: Record<AccountType, TaxCategory> = {
				expense: 'purchase_10',
				revenue: 'sales_10',
				asset: 'na',
				liability: 'na',
				equity: 'na'
			};
			formDefaultTaxCategory = defaults[newType];
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
		formDefaultTaxCategory = account.defaultTaxCategory;
		dialogOpen = true;
	}

	async function openDeleteDialog(account: Account) {
		deletingAccount = account;
		isAccountUsed = await isAccountInUse(account.code);
		deleteDialogOpen = true;
	}

	async function handleSubmit() {
		formError = '';

		// システム科目の場合は名前とタイプのバリデーションをスキップ
		if (!editingAccount?.isSystem) {
			if (!formCode.trim()) {
				formError = '勘定科目コードを入力してください';
				return;
			}
			if (!formName.trim()) {
				formError = '勘定科目名を入力してください';
				return;
			}
		}

		try {
			if (editingAccount) {
				const updates: Partial<Account> = editingAccount.isSystem
					? {
							businessRatioEnabled: formBusinessRatioEnabled,
							defaultBusinessRatio: formBusinessRatioEnabled ? formDefaultBusinessRatio : undefined,
							defaultTaxCategory: formDefaultTaxCategory
						}
					: {
							name: formName.trim(),
							type: formType,
							businessRatioEnabled: formBusinessRatioEnabled,
							defaultBusinessRatio: formBusinessRatioEnabled ? formDefaultBusinessRatio : undefined,
							defaultTaxCategory: formDefaultTaxCategory
						};

				// 消費税区分が変更された場合、仕訳の同期確認を行う
				const taxCategoryChanged =
					formDefaultTaxCategory && editingAccount.defaultTaxCategory !== formDefaultTaxCategory;

				if (taxCategoryChanged && formDefaultTaxCategory) {
					const count = await countJournalLinesByAccountCode(editingAccount.code);
					if (count > 0) {
						// 仕訳が存在する場合は同期確認ダイアログを表示
						affectedJournalCount = count;
						shouldSyncJournals = true;
						pendingAccountUpdate = {
							code: editingAccount.code,
							updates,
							newTaxCategory: formDefaultTaxCategory
						};
						dialogOpen = false;
						syncConfirmDialogOpen = true;
						return;
					}
				}

				// 仕訳がない場合は直接更新
				await updateAccount(editingAccount.code, updates);
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
					defaultBusinessRatio: formBusinessRatioEnabled ? formDefaultBusinessRatio : undefined,
					defaultTaxCategory: formDefaultTaxCategory
				});
			}
			dialogOpen = false;
			await loadAccounts();
		} catch (error) {
			formError = error instanceof Error ? error.message : '保存に失敗しました';
		}
	}

	async function handleSyncConfirm() {
		if (!pendingAccountUpdate) return;

		try {
			// 勘定科目を更新
			await updateAccount(pendingAccountUpdate.code, pendingAccountUpdate.updates);

			// 仕訳の消費税区分を更新（ユーザーが選択した場合）
			if (shouldSyncJournals) {
				await updateTaxCategoryByAccountCode(
					pendingAccountUpdate.code,
					pendingAccountUpdate.newTaxCategory
				);
			}

			syncConfirmDialogOpen = false;
			pendingAccountUpdate = null;
			await loadAccounts();
		} catch (error) {
			console.error('Sync failed:', error);
		}
	}

	function handleSyncCancel() {
		syncConfirmDialogOpen = false;
		pendingAccountUpdate = null;
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

			<!-- デフォルト消費税区分（システム科目・カスタム科目共通） -->
			<div class="space-y-2">
				<Label for="defaultTaxCategory">デフォルト消費税区分</Label>
				<Select.Root
					type="single"
					value={formDefaultTaxCategory}
					onValueChange={(v) => v && (formDefaultTaxCategory = v as TaxCategory)}
				>
					<Select.Trigger class="w-full">
						{formDefaultTaxCategory
							? TaxCategoryLabels[formDefaultTaxCategory]
							: '選択してください'}
					</Select.Trigger>
					<Select.Content>
						{#each taxCategoryOptions[formType] as tc (tc)}
							<Select.Item value={tc}>{TaxCategoryLabels[tc]}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
				<p class="text-xs text-muted-foreground">仕訳入力時に自動で設定される消費税区分</p>
			</div>

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

<!-- 仕訳同期確認ダイアログ -->
<Dialog.Root bind:open={syncConfirmDialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>既存仕訳の消費税区分を更新しますか？</Dialog.Title>
			<Dialog.Description>
				この勘定科目を使用している仕訳が {affectedJournalCount} 件あります。
			</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-4">
			<div class="rounded-md bg-muted p-3 text-sm">
				<p class="font-medium">変更内容</p>
				{#if pendingAccountUpdate}
					<p class="mt-1 text-muted-foreground">
						消費税区分を「{TaxCategoryLabels[pendingAccountUpdate.newTaxCategory]}」に変更
					</p>
				{/if}
			</div>
			<div class="flex items-start gap-2">
				<Checkbox.Root
					id="syncJournals"
					checked={shouldSyncJournals}
					onCheckedChange={(v) => (shouldSyncJournals = !!v)}
				/>
				<div class="grid gap-1.5 leading-none">
					<Label for="syncJournals" class="text-sm font-medium">既存の仕訳も一括で更新する</Label>
					<p class="text-xs text-muted-foreground">
						チェックを外すと、既存の仕訳は変更されません（新規仕訳から適用）
					</p>
				</div>
			</div>
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={handleSyncCancel}>キャンセル</Button>
			<Button onclick={handleSyncConfirm}>
				{shouldSyncJournals ? '更新する' : '科目のみ更新'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
