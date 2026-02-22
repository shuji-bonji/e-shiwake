<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import type { Account, AccountType, JournalLine } from '$lib/types';
	import { ArrowDown, ArrowUp, Percent, Plus, X } from '@lucide/svelte';
	import JournalLineItem from './JournalLineItem.svelte';

	interface LineIndicator {
		icon: 'up' | 'down' | null;
		label: string;
		color: string;
	}

	interface BusinessRatioInfo {
		index: number;
		account: { defaultBusinessRatio?: number };
	}

	interface Props {
		side: 'debit' | 'credit';
		lines: JournalLine[];
		accounts: Account[];
		total: number;
		isEditing: boolean;
		isValid: boolean;
		// 家事按分（借方のみ）
		businessRatioTarget?: BusinessRatioInfo | null;
		isBusinessRatioApplied?: boolean;
		appliedBusinessRatio?: number | null;
		// ハンドラー
		getlineIndicator: (side: 'debit' | 'credit', accountType: AccountType | null) => LineIndicator;
		getaccounttype: (code: string) => AccountType | null;
		onaccountchange: (lineId: string, code: string) => void;
		onupdateline: (lineId: string, field: string, value: unknown) => void;
		onremoveline: (lineId: string) => void;
		onaddline: (type: 'debit' | 'credit') => void;
		onsyncblur: () => void;
		onapplyratio?: (index: number, ratio: number) => void;
		onremoveratio?: () => void;
		onkeydown?: (e: KeyboardEvent, lineId: string) => void;
	}

	let {
		side,
		lines,
		accounts,
		total,
		isEditing,
		isValid,
		businessRatioTarget = null,
		isBusinessRatioApplied = false,
		appliedBusinessRatio = null,
		getlineIndicator,
		getaccounttype,
		onaccountchange,
		onupdateline,
		onremoveline,
		onaddline,
		onsyncblur,
		onapplyratio,
		onremoveratio,
		onkeydown
	}: Props = $props();

	const isDebit = $derived(side === 'debit');
	const label = $derived(isDebit ? '借方' : '貸方');
</script>

<div class="space-y-3">
	<div class="flex items-center gap-2 text-sm font-medium text-muted-foreground">
		{label}

		<!-- 家事按分ボタン（借方のみ） -->
		{#if isDebit && isBusinessRatioApplied && onremoveratio}
			<button
				type="button"
				class="flex items-center gap-1 rounded-full border border-amber-500/50 bg-amber-50 px-2 py-0.5 text-xs text-amber-700 transition-colors hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50"
				onclick={onremoveratio}
				tabindex={-1}
			>
				<Percent class="size-3" />
				{appliedBusinessRatio}%
				<X class="size-3" />
			</button>
		{:else if isDebit && businessRatioTarget && onapplyratio}
			<button
				type="button"
				class="flex items-center gap-1 rounded-full border border-amber-500/50 bg-amber-50 px-2 py-0.5 text-xs text-amber-700 transition-colors hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50"
				onclick={() =>
					onapplyratio(
						businessRatioTarget.index,
						businessRatioTarget.account.defaultBusinessRatio ?? 50
					)}
				tabindex={-1}
			>
				<Percent class="size-3" />
				按分適用
			</button>
		{/if}

		<span class="ml-auto font-mono">{total.toLocaleString('ja-JP')}円</span>
		<Tooltip.Provider>
			<Tooltip.Root>
				<Tooltip.Trigger>
					<Button
						variant="ghost"
						size="icon"
						class="size-6 text-foreground"
						onclick={() => onaddline(side)}
						tabindex={-1}
					>
						<Plus class="size-4" strokeWidth={3} />
					</Button>
				</Tooltip.Trigger>
				<Tooltip.Content>
					<div class="text-xs">
						{#if isDebit}
							<div class="mb-1 font-medium">借方に来る科目：</div>
							<div class="flex items-center gap-1">
								<ArrowUp class="size-3 text-blue-500" />資産の増加
							</div>
							<div class="flex items-center gap-1">
								<ArrowUp class="size-3 text-red-500" />費用の発生
							</div>
							<div class="flex items-center gap-1">
								<ArrowDown class="size-3 text-purple-500" />負債の減少
							</div>
						{:else}
							<div class="mb-1 font-medium">貸方に来る科目：</div>
							<div class="flex items-center gap-1">
								<ArrowDown class="size-3 text-blue-500" />資産の減少
							</div>
							<div class="flex items-center gap-1">
								<ArrowUp class="size-3 text-purple-500" />負債の増加
							</div>
							<div class="flex items-center gap-1">
								<ArrowUp class="size-3 text-green-500" />収益の発生
							</div>
						{/if}
					</div>
				</Tooltip.Content>
			</Tooltip.Root>
		</Tooltip.Provider>
	</div>
	{#each lines as line (line.id)}
		{@const accountType = getaccounttype(line.accountCode)}
		{@const indicator = getlineIndicator(side, accountType)}
		<JournalLineItem
			{line}
			{accounts}
			{indicator}
			canRemove={lines.length > 1}
			{isEditing}
			{isValid}
			{onaccountchange}
			{onupdateline}
			{onremoveline}
			{onsyncblur}
			onkeydown={!isDebit ? onkeydown : undefined}
		/>
	{/each}
</div>
