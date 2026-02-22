<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Switch from '$lib/components/ui/switch/index.js';
	import * as Checkbox from '$lib/components/ui/checkbox/index.js';
	import { Percent } from '@lucide/svelte';
	import type { Account, AccountType, TaxCategory } from '$lib/types';
	import { AccountTypeLabels, TaxCategoryLabels } from '$lib/types';
	import {
		db,
		addAccount,
		updateAccount,
		generateNextCode,
		countJournalLinesByAccountCode,
		updateTaxCategoryByAccountCode
	} from '$lib/db';

	// 勘定科目タイプ別のデフォルト消費税区分オプション
	const taxCategoryOptions: Record<AccountType, TaxCategory[]> = {
		expense: ['purchase_10', 'purchase_8', 'exempt', 'out_of_scope', 'na'],
		revenue: ['sales_10', 'sales_8', 'exempt', 'out_of_scope', 'na'],
		asset: ['na', 'purchase_10', 'purchase_8'],
		liability: ['na'],
		equity: ['na']
	};

	// カテゴリ順序
	const typeOrder: AccountType[] = ['expense', 'asset', 'revenue', 'liability', 'equity'];

	interface Props {
		open: boolean;
		editingAccount: Account | null;
		onsave: () => void;
	}

	let { open = $bindable(), editingAccount, onsave }: Props = $props();

	// フォーム状態
	let formCode = $state('');
	let formName = $state('');
	let formType = $state<AccountType>('expense');
	let formError = $state('');
	let formBusinessRatioEnabled = $state(false);
	let formDefaultBusinessRatio = $state(30);
	let formDefaultTaxCategory = $state<TaxCategory | undefined>(undefined);

	// 同期確認ダイアログ
	let syncConfirmDialogOpen = $state(false);
	let affectedJournalCount = $state(0);
	let shouldSyncJournals = $state(true);
	let pendingAccountUpdate = $state<{
		code: string;
		updates: Partial<Account>;
		newTaxCategory: TaxCategory;
	} | null>(null);

	// ダイアログが開いた時にフォームを初期化
	$effect(() => {
		if (open) {
			if (editingAccount) {
				formCode = editingAccount.code;
				formName = editingAccount.name;
				formType = editingAccount.type;
				formBusinessRatioEnabled = editingAccount.businessRatioEnabled ?? false;
				formDefaultBusinessRatio = editingAccount.defaultBusinessRatio ?? 30;
				formDefaultTaxCategory = editingAccount.defaultTaxCategory;
			} else {
				formName = '';
				formType = 'expense';
				formBusinessRatioEnabled = false;
				formDefaultBusinessRatio = 30;
				formDefaultTaxCategory = 'purchase_10';
				generateNextCode('expense').then((code) => (formCode = code));
			}
			formError = '';
		}
	});

	async function handleTypeChange(newType: AccountType) {
		formType = newType;
		if (!editingAccount) {
			formCode = await generateNextCode(newType);
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

	async function handleSubmit() {
		formError = '';

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

				const taxCategoryChanged =
					formDefaultTaxCategory && editingAccount.defaultTaxCategory !== formDefaultTaxCategory;

				if (taxCategoryChanged && formDefaultTaxCategory) {
					const count = await countJournalLinesByAccountCode(editingAccount.code);
					if (count > 0) {
						affectedJournalCount = count;
						shouldSyncJournals = true;
						pendingAccountUpdate = {
							code: editingAccount.code,
							updates,
							newTaxCategory: formDefaultTaxCategory
						};
						open = false;
						syncConfirmDialogOpen = true;
						return;
					}
				}

				await updateAccount(editingAccount.code, updates);
			} else {
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
			open = false;
			onsave();
		} catch (error) {
			formError = error instanceof Error ? error.message : '保存に失敗しました';
		}
	}

	async function handleSyncConfirm() {
		if (!pendingAccountUpdate) return;

		try {
			await updateAccount(pendingAccountUpdate.code, pendingAccountUpdate.updates);

			if (shouldSyncJournals) {
				await updateTaxCategoryByAccountCode(
					pendingAccountUpdate.code,
					pendingAccountUpdate.newTaxCategory
				);
			}

			syncConfirmDialogOpen = false;
			pendingAccountUpdate = null;
			onsave();
		} catch (error) {
			console.error('Sync failed:', error);
		}
	}

	function handleSyncCancel() {
		syncConfirmDialogOpen = false;
		pendingAccountUpdate = null;
	}
</script>

<!-- 追加/編集ダイアログ -->
<Dialog.Root bind:open>
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

			<!-- デフォルト消費税区分 -->
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

			<!-- 家事按分設定（費用科目のみ） -->
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
				<Button type="button" variant="outline" onclick={() => (open = false)}>キャンセル</Button>
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
