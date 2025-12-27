<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Plus, Pencil, Trash2 } from '@lucide/svelte';
	import type { Account, AccountType } from '$lib/types';
	import { AccountTypeLabels } from '$lib/types';
	import {
		db,
		initializeDatabase,
		getAllAccounts,
		addAccount,
		updateAccount,
		deleteAccount,
		isAccountInUse
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

	// カテゴリ順序
	const typeOrder: AccountType[] = ['asset', 'liability', 'equity', 'revenue', 'expense'];

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
		formCode = '';
		formName = '';
		formType = 'expense';
		formError = '';
		dialogOpen = true;
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

	function getTypeBadgeVariant(type: AccountType): 'default' | 'secondary' | 'outline' {
		switch (type) {
			case 'asset':
			case 'expense':
				return 'default';
			case 'liability':
			case 'revenue':
				return 'secondary';
			default:
				return 'outline';
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
		<!-- カテゴリ別リスト -->
		<div class="grid gap-6">
			{#each typeOrder as type (type)}
				{@const typeAccounts = groupedAccounts[type]}
				{#if typeAccounts.length > 0}
					<Card.Root>
						<Card.Header>
							<Card.Title class="flex items-center gap-2">
								<Badge variant={getTypeBadgeVariant(type)}>{AccountTypeLabels[type]}</Badge>
								<span class="text-sm font-normal text-muted-foreground">
									{typeAccounts.length}件
								</span>
							</Card.Title>
						</Card.Header>
						<Card.Content>
							<Table.Root>
								<Table.Header>
									<Table.Row>
										<Table.Head class="w-24">コード</Table.Head>
										<Table.Head>勘定科目名</Table.Head>
										<Table.Head class="w-20">種別</Table.Head>
										<Table.Head class="w-24 text-right">操作</Table.Head>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{#each typeAccounts as account (account.code)}
										<Table.Row>
											<Table.Cell class="font-mono">{account.code}</Table.Cell>
											<Table.Cell>{account.name}</Table.Cell>
											<Table.Cell>
												{#if account.isSystem}
													<Badge variant="outline" class="text-xs">システム</Badge>
												{:else}
													<Badge variant="secondary" class="text-xs">カスタム</Badge>
												{/if}
											</Table.Cell>
											<Table.Cell class="text-right">
												<div class="flex justify-end gap-1">
													<Button
														variant="ghost"
														size="icon"
														class="size-8"
														onclick={() => openEditDialog(account)}
													>
														<Pencil class="size-4" />
														<span class="sr-only">編集</span>
													</Button>
													{#if !account.isSystem}
														<Button
															variant="ghost"
															size="icon"
															class="size-8 text-destructive hover:text-destructive"
															onclick={() => openDeleteDialog(account)}
														>
															<Trash2 class="size-4" />
															<span class="sr-only">削除</span>
														</Button>
													{/if}
												</div>
											</Table.Cell>
										</Table.Row>
									{/each}
								</Table.Body>
							</Table.Root>
						</Card.Content>
					</Card.Root>
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
				<Label for="code">勘定科目コード</Label>
				<Input
					id="code"
					bind:value={formCode}
					placeholder="例: 540"
					disabled={!!editingAccount}
				/>
			</div>
			<div class="space-y-2">
				<Label for="name">勘定科目名</Label>
				<Input id="name" bind:value={formName} placeholder="例: 車両費" />
			</div>
			<div class="space-y-2">
				<Label for="type">カテゴリ</Label>
				<Select.Root type="single" bind:value={formType}>
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
