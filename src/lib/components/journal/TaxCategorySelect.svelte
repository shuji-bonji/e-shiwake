<script lang="ts">
	import { tick } from 'svelte';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { ChevronsUpDown } from '@lucide/svelte';
	import { cn } from '$lib/utils.js';
	import { TaxCategoryLabels, TaxCategoryShortLabels, type TaxCategory } from '$lib/types';

	interface Props {
		value: TaxCategory | undefined;
		onchange: (category: TaxCategory) => void;
		class?: string;
		compact?: boolean;
	}

	let { value, onchange, class: className, compact = true }: Props = $props();

	let open = $state(false);
	let triggerRef = $state<HTMLButtonElement>(null!);

	// 税区分のグループ定義
	const taxCategoryGroups: { label: string; categories: TaxCategory[] }[] = [
		{
			label: '課税売上',
			categories: ['sales_10', 'sales_8']
		},
		{
			label: '課税仕入',
			categories: ['purchase_10', 'purchase_8']
		},
		{
			label: 'その他',
			categories: ['exempt', 'out_of_scope', 'na']
		}
	];

	function closeAndFocusTrigger() {
		open = false;
		tick().then(() => {
			triggerRef?.focus();
		});
	}

	function handleSelect(category: TaxCategory) {
		onchange(category);
		closeAndFocusTrigger();
	}

	// 表示用ラベル（コンパクト表示か通常表示か）
	const displayLabel = $derived(
		value ? (compact ? TaxCategoryShortLabels[value] : TaxCategoryLabels[value]) : '−'
	);

	// カテゴリによる色分け
	function getCategoryColor(category: TaxCategory): string {
		if (category.startsWith('sales_')) {
			return 'text-green-600 dark:text-green-400';
		}
		if (category.startsWith('purchase_')) {
			return 'text-blue-600 dark:text-blue-400';
		}
		return 'text-muted-foreground';
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger bind:ref={triggerRef}>
		{#snippet child({ props })}
			<Button
				{...props}
				variant="ghost"
				size="sm"
				role="combobox"
				aria-expanded={open}
				class={cn(
					'h-7 justify-between px-2 font-mono text-xs font-normal',
					value && getCategoryColor(value),
					className
				)}
			>
				<span class="truncate">{displayLabel}</span>
				<ChevronsUpDown class="ml-1 size-3 shrink-0 opacity-50" />
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-48 p-0" align="start">
		<div class="p-2">
			{#each taxCategoryGroups as group (group.label)}
				<div class="mb-2 last:mb-0">
					<!-- グループヘッダー -->
					<div class="mb-1 px-2 text-xs font-semibold text-muted-foreground">
						{group.label}
					</div>
					<!-- カテゴリ一覧 -->
					<div class="space-y-0.5">
						{#each group.categories as category (category)}
							<button
								type="button"
								class={cn(
									'flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent',
									value === category && 'bg-accent font-medium'
								)}
								onclick={() => handleSelect(category)}
							>
								<span>{TaxCategoryLabels[category]}</span>
								<span class={cn('font-mono text-xs', getCategoryColor(category))}>
									{TaxCategoryShortLabels[category]}
								</span>
							</button>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</Popover.Content>
</Popover.Root>
