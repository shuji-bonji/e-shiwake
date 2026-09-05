<script lang="ts">
	import { base } from '$app/paths';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { AlertTriangle, FileText, Link2Off, Lock } from '@lucide/svelte';
	import type { JournalEntry } from '$lib/types';
	import { InvoicePaymentStatusLabels } from '$lib/types/invoice';
	import {
		filterOptionsByVendor,
		getInvoiceLinkWarnings,
		type InvoiceLinkOption
	} from '$lib/utils/invoice-link-options';

	/**
	 * 仕訳編集の「対応する請求書」欄
	 *
	 * - 1005 売掛金 の行がある仕訳にだけ表示する（表示するかは親が判定）
	 * - 請求書から生成した仕訳（locked）は選択欄を変更できず、「紐づけを解除」だけできる
	 * - 手で切った仕訳は任意で紐づける。紐づけ時に警告を出すが保存は止めない
	 */
	interface Props {
		journal: JournalEntry;
		options: InvoiceLinkOption[];
		/** 請求書から生成した仕訳（generatedFrom: 'invoice'）か */
		locked: boolean;
		onlink: (invoiceId: string | undefined) => void;
		onunlink: () => void;
	}

	let { journal, options, locked, onlink, onunlink }: Props = $props();

	let unlinkDialogOpen = $state(false);

	// 取引先名で絞った候補。紐づけ済みの請求書は取引先が違っても候補に残す
	const candidates = $derived.by(() => {
		const filtered = filterOptionsByVendor(options, journal.vendor);
		const linked = options.find((o) => o.id === journal.invoiceId);
		if (linked && !filtered.some((o) => o.id === linked.id)) {
			return [linked, ...filtered];
		}
		return filtered;
	});

	const linkedOption = $derived(options.find((o) => o.id === journal.invoiceId) ?? null);

	// 紐づけ先が候補にない（請求書が削除された、または下書きに戻された）
	const linkedMissing = $derived(!!journal.invoiceId && !linkedOption);

	const warnings = $derived(
		linkedOption && !locked ? getInvoiceLinkWarnings(journal, linkedOption) : []
	);

	function handleChange(value: string) {
		onlink(value === '' ? undefined : value);
	}

	function confirmUnlink() {
		unlinkDialogOpen = false;
		onunlink();
	}
</script>

<div class="mt-3 space-y-2 rounded-md border border-dashed p-3 text-sm">
	<div class="flex flex-wrap items-center gap-2">
		<FileText class="size-4 shrink-0 text-muted-foreground" />
		<span class="text-muted-foreground">対応する請求書:</span>

		{#if locked && linkedOption}
			<a href="{base}/invoice/{linkedOption.id}" class="font-medium underline hover:no-underline">
				{linkedOption.invoiceNumber}
			</a>
			<span class="text-xs text-muted-foreground">
				{linkedOption.issueDate} ¥{linkedOption.total.toLocaleString('ja-JP')}
				{#if linkedOption.status === 'draft'}
					（下書き）
				{/if}
			</span>
			<Button
				variant="ghost"
				size="sm"
				class="ml-auto h-7 text-xs"
				onclick={() => (unlinkDialogOpen = true)}
				tabindex={-1}
			>
				<Link2Off class="mr-1 size-3" />
				請求書との紐づけを解除
			</Button>
		{:else if locked && linkedMissing}
			<span class="text-destructive"
				>紐づく請求書が見つかりません（削除された可能性があります）</span
			>
			<Button
				variant="ghost"
				size="sm"
				class="ml-auto h-7 text-xs"
				onclick={() => (unlinkDialogOpen = true)}
				tabindex={-1}
			>
				<Link2Off class="mr-1 size-3" />
				紐づけを解除
			</Button>
		{:else}
			<Select.Root type="single" value={journal.invoiceId ?? ''} onValueChange={handleChange}>
				<Select.Trigger class="h-8 w-72 text-sm" tabindex={-1}>
					{#if linkedOption}
						{linkedOption.invoiceNumber}（{linkedOption.issueDate} ¥{linkedOption.total.toLocaleString(
							'ja-JP'
						)}）
					{:else if linkedMissing}
						（削除された請求書）
					{:else}
						紐づけない
					{/if}
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="">紐づけない</Select.Item>
					{#each candidates as option (option.id)}
						<Select.Item value={option.id}>
							{option.invoiceNumber}（{option.issueDate} ¥{option.total.toLocaleString('ja-JP')}
							・{InvoicePaymentStatusLabels[option.paymentStatus]}）
						</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
			{#if candidates.length === 0}
				<span class="text-xs text-muted-foreground">
					{journal.vendor.trim()
						? 'この取引先の発行済み請求書はありません'
						: '発行済みの請求書がありません'}
				</span>
			{/if}
		{/if}
	</div>

	{#if locked}
		<p class="flex items-start gap-1 text-xs text-muted-foreground">
			<Lock class="mt-0.5 size-3 shrink-0" />
			<span>
				請求書から生成した仕訳です。日付・取引先・摘要・明細行は請求書側で変更してください（証憑と行メモは編集できます）。
			</span>
		</p>
	{/if}

	{#if warnings.length > 0}
		<ul class="space-y-0.5 text-xs text-amber-700 dark:text-amber-300">
			{#each warnings as warning (warning)}
				<li class="flex items-start gap-1">
					<AlertTriangle class="mt-0.5 size-3 shrink-0" />
					<span>{warning}</span>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<!-- 紐づけ解除の確認ダイアログ -->
<AlertDialog.Root bind:open={unlinkDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>請求書との紐づけを解除しますか？</AlertDialog.Title>
			<AlertDialog.Description>
				<span class="block">
					解除すると、この仕訳は通常の仕訳として編集できるようになりますが、請求書を変更しても仕訳は更新されなくなります。
				</span>
				<span class="mt-2 block">
					請求書側では売掛金仕訳が「未作成」に戻り、「売掛金仕訳」ボタンから再び作成できるようになります。
				</span>
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>キャンセル</AlertDialog.Cancel>
			<AlertDialog.Action onclick={confirmUnlink}>解除する</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
