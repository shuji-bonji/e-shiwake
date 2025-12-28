<script lang="ts">
	import { tick } from 'svelte';
	import * as Popover from '$lib/components/ui/popover/index.js';
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

<Popover.Root bind:open>
	<Popover.Trigger bind:ref={triggerRef}>
		{#snippet child({ props })}
			<Button
				{...props}
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
	</Popover.Trigger>
	<Popover.Content class="w-80 p-0" align="start">
		<div class="max-h-80 overflow-y-auto p-2">
			{#each categoryOrder as type (type)}
				{@const accountsInCategory = groupedAccounts[type]}
				{@const Icon = categoryIcons[type]}
				{#if accountsInCategory.length > 0}
					<div class="mb-3 last:mb-0">
						<!-- カテゴリヘッダー -->
						<div class="mb-1.5 flex items-center gap-1.5 bg-muted px-2 py-1">
							<Icon class="size-3.5 text-muted-foreground" />
							<span class="text-xs font-semibold">{AccountTypeLabels[type]}</span>
						</div>
						<!-- 科目グリッド -->
						<div class="flex flex-wrap gap-1">
							{#each accountsInCategory as account (account.code)}
								{#if account.isSystem}
									<button
										type="button"
										class={cn(
											'px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground',
											value === account.code && 'font-medium text-foreground underline'
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
	</Popover.Content>
</Popover.Root>
