<script lang="ts">
	import { tick } from 'svelte';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { ChevronsUpDown, Receipt, Wallet, TrendingUp, CreditCard, Gem } from '@lucide/svelte';
	import { cn } from '$lib/utils.js';
	import { AccountTypeLabels, type Account, type AccountType } from '$lib/types';

	interface Props {
		accounts: Account[];
		value: string;
		onchange: (code: string) => void;
		placeholder?: string;
		class?: string;
	}

	let {
		accounts,
		value,
		onchange,
		placeholder = '勘定科目を選択',
		class: className
	}: Props = $props();

	let open = $state(false);
	let triggerRef = $state<HTMLButtonElement>(null!);

	const selectedAccount = $derived(accounts.find((a) => a.code === value));

	// カテゴリの表示順序（フリーランス向け: よく使う順）
	const categoryOrder: AccountType[] = ['expense', 'asset', 'revenue', 'liability', 'equity'];

	// カテゴリ別にグループ化
	const groupedAccounts = $derived(
		categoryOrder.reduce(
			(acc, type) => {
				acc[type] = accounts.filter((a) => a.type === type);
				return acc;
			},
			{} as Record<AccountType, Account[]>
		)
	);

	// カテゴリごとのアイコン
	const categoryIcons: Record<AccountType, typeof Receipt> = {
		expense: Receipt,
		asset: Wallet,
		revenue: TrendingUp,
		liability: CreditCard,
		equity: Gem
	};

	function closeAndFocusTrigger() {
		open = false;
		tick().then(() => {
			triggerRef?.focus();
		});
	}

	function handleSelect(code: string) {
		onchange(code);
		closeAndFocusTrigger();
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				bind:ref={triggerRef}
				variant="outline"
				role="combobox"
				aria-expanded={open}
				class={cn('w-full justify-between font-normal', className)}
			>
				{#if selectedAccount}
					<span class="truncate">{selectedAccount.name}</span>
				{:else}
					<span class="text-muted-foreground">{placeholder}</span>
				{/if}
				<ChevronsUpDown class="ml-2 size-4 shrink-0 opacity-50" />
			</Button>
		{/snippet}
	</Dialog.Trigger>
	<Dialog.Content class="max-h-[90vh] w-full max-w-2xl overflow-y-auto p-4">
		<Dialog.Header class="sr-only">
			<Dialog.Title>勘定科目を選択</Dialog.Title>
		</Dialog.Header>
		<!-- 勘定科目管理ページと同じレイアウト -->
		<div class="space-y-4">
			{#each categoryOrder as type (type)}
				{@const accountsInCategory = groupedAccounts[type]}
				{@const Icon = categoryIcons[type]}
				{#if accountsInCategory.length > 0}
					<div>
						<!-- カテゴリヘッダー -->
						<div class="mb-2 flex items-center gap-1.5 bg-muted px-2 py-1.5">
							<Icon class="size-4 text-muted-foreground" />
							<span class="text-sm font-semibold">{AccountTypeLabels[type]}</span>
							<span class="text-xs text-muted-foreground">({accountsInCategory.length})</span>
						</div>
						<!-- 科目グリッド（flex-wrap） -->
						<div class="flex flex-wrap gap-1">
							{#each accountsInCategory as account (account.code)}
								{#if account.isSystem}
									<button
										type="button"
										class={cn(
											'px-2 py-1 text-sm transition-colors',
											value === account.code
												? 'font-medium text-primary underline'
												: 'text-muted-foreground hover:text-foreground'
										)}
										onclick={() => handleSelect(account.code)}
									>
										{account.name}
									</button>
								{:else}
									<button
										type="button"
										class={cn(
											'rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-sm font-medium transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700',
											value === account.code && 'ring-2 ring-primary ring-offset-1'
										)}
										onclick={() => handleSelect(account.code)}
									>
										{account.name}
									</button>
								{/if}
							{/each}
						</div>
					</div>
				{/if}
			{/each}
		</div>
	</Dialog.Content>
</Dialog.Root>
