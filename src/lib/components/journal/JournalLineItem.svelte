<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import type { Account, JournalLine } from '$lib/types';
	import { cn } from '$lib/utils.js';
	import { ArrowDown, ArrowUp, Trash2 } from '@lucide/svelte';
	import AccountSelect from './AccountSelect.svelte';
	import TaxCategorySelect from './TaxCategorySelect.svelte';

	interface LineIndicator {
		icon: 'up' | 'down' | null;
		label: string;
		color: string;
	}

	interface Props {
		line: JournalLine;
		accounts: Account[];
		indicator: LineIndicator;
		canRemove: boolean;
		isEditing: boolean;
		isValid: boolean;
		onaccountchange: (lineId: string, code: string) => void;
		onupdateline: (lineId: string, field: string, value: unknown) => void;
		onremoveline: (lineId: string) => void;
		onsyncblur: () => void;
		onkeydown?: (e: KeyboardEvent, lineId: string) => void;
	}

	let {
		line,
		accounts,
		indicator,
		canRemove,
		isEditing,
		isValid,
		onaccountchange,
		onupdateline,
		onremoveline,
		onsyncblur,
		onkeydown
	}: Props = $props();
</script>

<div class="flex flex-col gap-1 journal:flex-row journal:items-center journal:gap-2">
	<!-- 種別アイコン + 勘定科目 -->
	<div class="flex min-w-0 flex-1 items-center gap-2">
		<Tooltip.Provider>
			<Tooltip.Root>
				<Tooltip.Trigger>
					<div class={cn('flex size-7 items-center justify-center rounded', indicator.color)}>
						{#if indicator.icon === 'up'}
							<ArrowUp class="size-4" />
						{:else if indicator.icon === 'down'}
							<ArrowDown class="size-4" />
						{:else}
							<span class="size-4"></span>
						{/if}
					</div>
				</Tooltip.Trigger>
				{#if indicator.label}
					<Tooltip.Content>
						{indicator.icon === 'up' ? '増加' : '減少'}：{indicator.label}
					</Tooltip.Content>
				{/if}
			</Tooltip.Root>
		</Tooltip.Provider>
		<AccountSelect
			{accounts}
			value={line.accountCode}
			onchange={(code) => onaccountchange(line.id, code)}
			class="min-w-0 flex-1"
		/>
	</div>
	<!-- 税区分 + 金額 + 削除ボタン -->
	<div class="flex items-center gap-1 pl-9 journal:pl-0">
		<TaxCategorySelect
			value={line.taxCategory}
			onchange={(cat) => onupdateline(line.id, 'taxCategory', cat)}
			tabindex={-1}
		/>
		<Input
			type="number"
			value={line.amount}
			onchange={(e) => onupdateline(line.id, 'amount', Number(e.currentTarget.value))}
			onblur={onsyncblur}
			onfocus={(e) => e.currentTarget.select()}
			onkeydown={onkeydown ? (e) => onkeydown(e, line.id) : undefined}
			placeholder="金額"
			class={cn(
				'w-full text-right font-mono journal:w-24',
				!isEditing && line.amount === 0 && !isValid && 'border-destructive'
			)}
			min="0"
		/>
		{#if canRemove}
			<Button
				variant="ghost"
				size="icon"
				class="size-7 shrink-0"
				onclick={() => onremoveline(line.id)}
				tabindex={-1}
			>
				<Trash2 class="size-3" />
			</Button>
		{/if}
	</div>
</div>
