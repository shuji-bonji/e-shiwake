<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { AlertTriangle, ExternalLink } from '@lucide/svelte';
	import type { Invoice } from '$lib/types/invoice';
	import type { Vendor, JournalEntry } from '$lib/types';
	import { toast } from 'svelte-sonner';
	import { addJournal, updateInvoice, getJournalById } from '$lib/db';
	import {
		generateSalesJournal,
		generateDepositJournal,
		getJournalAmount,
		calculateDepositSummary
	} from '$lib/utils/invoice-journal';
	import { formatCurrency } from '$lib/utils/invoice';
	import { dispatchUICommand } from '$lib/stores/uiCommand.svelte';

	interface Props {
		open: boolean;
		journalType: 'sales' | 'deposit';
		invoice: Invoice | null;
		invoiceId: string;
		vendor: Vendor | null;
		/** 仕訳作成後に呼ばれる。売掛金仕訳は journalId、入金仕訳は depositJournalIds（全件）を渡す */
		onsave: (
			result:
				{ type: 'sales'; journalId: string } | { type: 'deposit'; depositJournalIds: string[] }
		) => void;
	}

	let { open = $bindable(), journalType, invoice, invoiceId, vendor, onsave }: Props = $props();

	let depositDate = $state(new Date().toISOString().slice(0, 10));
	let depositAmount = $state(0);

	// 作成済み仕訳（ダイアログを開いたときに DB から読み直す。削除済みの ID は除外する）
	let existingSalesJournal = $state<JournalEntry | null>(null);
	let existingDepositJournals = $state<JournalEntry[]>([]);
	let isChecking = $state(false);

	const depositSummary = $derived(
		invoice ? calculateDepositSummary(invoice, existingDepositJournals) : null
	);

	const hasExisting = $derived(
		journalType === 'sales' ? existingSalesJournal !== null : existingDepositJournals.length > 0
	);

	// ダイアログが開いた時に入力値をリセットし、作成済み仕訳を確認する
	$effect(() => {
		if (open) {
			depositDate = new Date().toISOString().slice(0, 10);
			loadExistingJournals();
		}
	});

	async function loadExistingJournals() {
		if (!invoice) return;
		isChecking = true;
		try {
			existingSalesJournal = invoice.journalId
				? ((await getJournalById(invoice.journalId)) ?? null)
				: null;

			const found = await Promise.all(
				(invoice.depositJournalIds ?? []).map((id) => getJournalById(id))
			);
			existingDepositJournals = found.filter((j): j is JournalEntry => j !== undefined);

			// 入金額の初期値は未入金残額（全額入金済みなら 0）
			depositAmount = calculateDepositSummary(invoice, existingDepositJournals).remaining;
		} finally {
			isChecking = false;
		}
	}

	function openJournalSearch() {
		if (!invoice) return;
		dispatchUICommand({ type: 'set_search_query', data: { query: invoice.invoiceNumber } });
		open = false;
		goto(`${base}/`);
	}

	async function createJournal() {
		if (!invoice) return;
		if (!vendor) {
			toast.error('取引先を選択してから仕訳を作成してください');
			return;
		}
		if (journalType === 'deposit' && (!Number.isFinite(depositAmount) || depositAmount <= 0)) {
			toast.error('入金額は 1 円以上を入力してください');
			return;
		}

		try {
			if (journalType === 'sales') {
				const journalId = await addJournal(generateSalesJournal(invoice, vendor));
				await updateInvoice(invoiceId, { journalId });
				onsave({ type: 'sales', journalId });
			} else {
				const journalId = await addJournal(
					generateDepositJournal(invoice, vendor, depositDate, '1003', depositAmount)
				);
				// 削除済みの ID は持ち越さず、存在する仕訳の ID だけを保存する
				const depositJournalIds = [...existingDepositJournals.map((j) => j.id), journalId];
				await updateInvoice(invoiceId, { depositJournalIds });
				onsave({ type: 'deposit', depositJournalIds });
			}

			open = false;
			toast.success('仕訳を作成しました');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : '仕訳の作成に失敗しました');
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>
				{journalType === 'sales' ? '売掛金仕訳を作成' : '入金仕訳を作成'}
			</Dialog.Title>
			<Dialog.Description>
				{#if journalType === 'sales'}
					請求書発行に対応する売掛金仕訳を作成します。
				{:else}
					入金日と入金額を指定して入金仕訳を作成します。
				{/if}
			</Dialog.Description>
		</Dialog.Header>

		{#if hasExisting && !isChecking}
			<!-- 作成済み仕訳の警告 -->
			<div
				class="rounded-md border border-amber-500/50 bg-amber-50 p-3 text-sm dark:bg-amber-950/30"
			>
				<div class="flex items-start gap-2">
					<AlertTriangle class="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
					<div class="min-w-0 flex-1 space-y-2">
						{#if journalType === 'sales' && existingSalesJournal}
							<p class="font-medium text-amber-800 dark:text-amber-200">
								この請求書の売掛金仕訳は作成済みです
							</p>
							<p class="text-amber-700 dark:text-amber-300">
								{existingSalesJournal.date}
								{formatCurrency(getJournalAmount(existingSalesJournal))}
								「{existingSalesJournal.description}」
							</p>
							<p class="text-amber-700 dark:text-amber-300">
								もう一度作成すると、売掛金と売上高が二重に計上されます。
							</p>
						{:else if journalType === 'deposit' && depositSummary}
							<p class="font-medium text-amber-800 dark:text-amber-200">
								{depositSummary.isFullyDeposited
									? 'この請求書は全額入金済みです'
									: `この請求書には入金仕訳が ${existingDepositJournals.length} 件あります`}
							</p>
							<ul class="space-y-0.5 text-amber-700 dark:text-amber-300">
								{#each existingDepositJournals as j (j.id)}
									<li>{j.date} {formatCurrency(getJournalAmount(j))}</li>
								{/each}
							</ul>
							<p class="text-amber-700 dark:text-amber-300">
								入金合計 {formatCurrency(depositSummary.depositedTotal)} / 税込合計 {formatCurrency(
									invoice?.total ?? 0
								)}（残額 {formatCurrency(depositSummary.remaining)}）
							</p>
							{#if depositSummary.isFullyDeposited}
								<p class="text-amber-700 dark:text-amber-300">
									さらに作成すると、売掛金がマイナスになります。
								</p>
							{/if}
						{/if}
						<button
							type="button"
							class="flex items-center gap-1 text-amber-800 underline hover:no-underline dark:text-amber-200"
							onclick={openJournalSearch}
						>
							<ExternalLink class="size-3" />
							仕訳帳で「{invoice?.invoiceNumber}」を検索
						</button>
					</div>
				</div>
			</div>
		{/if}

		{#if journalType === 'deposit'}
			<div class="space-y-4 py-2">
				<div class="space-y-2">
					<Label for="depositDate">入金日</Label>
					<Input id="depositDate" type="date" bind:value={depositDate} />
				</div>
				<div class="space-y-2">
					<Label for="depositAmount">入金額（税込）</Label>
					<Input id="depositAmount" type="number" min="1" step="1" bind:value={depositAmount} />
					<p class="text-xs text-muted-foreground">
						分割入金の場合は今回の入金額を入力してください。初期値は未入金残額です。
					</p>
				</div>
			</div>
		{/if}

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)}>キャンセル</Button>
			<Button
				variant={hasExisting && (journalType === 'sales' || depositSummary?.isFullyDeposited)
					? 'destructive'
					: 'default'}
				onclick={createJournal}
				disabled={isChecking}
			>
				{hasExisting && (journalType === 'sales' || depositSummary?.isFullyDeposited)
					? 'それでも作成'
					: '作成'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
