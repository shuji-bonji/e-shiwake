<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Plus, FileSpreadsheet, Pencil, Trash2, Copy } from '@lucide/svelte';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import type { Invoice } from '$lib/types/invoice';
	import type { JournalEntry } from '$lib/types';
	import { deleteLinkedJournal } from '$lib/utils/invoice-journal-sync';
	import {
		deriveInvoiceSettlements,
		receivableDebitTotal,
		type InvoiceSettlement
	} from '$lib/utils/invoice-settlement';
	import { toast } from 'svelte-sonner';
	import { InvoiceStatusLabels, InvoicePaymentStatusLabels } from '$lib/types/invoice';
	import type { InvoicePaymentStatus } from '$lib/types/invoice';
	import type { Vendor } from '$lib/types';
	import {
		initializeDatabase,
		getInvoicesByYear,
		getAllVendors,
		deleteInvoice,
		addInvoice,
		generateNextInvoiceNumber,
		getJournalsWithInvoiceId,
		unlinkJournalsFromInvoice
	} from '$lib/db';
	import { useFiscalYear } from '$lib/stores/fiscalYear.svelte.js';
	import { formatCurrency } from '$lib/utils/invoice';
	import { copyInvoiceForNew } from '$lib/utils/invoice-copy';

	const fiscalYear = useFiscalYear();

	// 状態
	let invoices = $state<Invoice[]>([]);
	let vendors = $state<Vendor[]>([]);
	let isLoading = $state(true);
	let deleteDialogOpen = $state(false);
	let deletingInvoice = $state<Invoice | null>(null);

	// 請求書に紐づく仕訳（invoiceId を持つ仕訳）。入金状態はここから導出する
	let linkedJournals = $state<JournalEntry[]>([]);

	// フィルター
	let statusFilter = $state<string>('all');
	let paymentFilter = $state<string>('all');

	// ベンダー名を取得するためのマップ
	const vendorMap = $derived(new Map(vendors.map((v) => [v.id, v.name])));

	// 請求書ごとの決済状態（導出値）
	const settlements = $derived(deriveInvoiceSettlements(invoices, linkedJournals));

	function settlementOf(invoice: Invoice): InvoiceSettlement | undefined {
		return settlements.get(invoice.id);
	}

	// フィルタリングされた請求書
	const filteredInvoices = $derived(
		invoices.filter((inv) => {
			if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
			if (paymentFilter !== 'all') {
				// 入金状態は発行済みの請求書にだけ意味がある
				if (inv.status !== 'issued') return false;
				if (settlementOf(inv)?.paymentStatus !== paymentFilter) return false;
			}
			return true;
		})
	);

	onMount(async () => {
		await initializeDatabase();
		vendors = await getAllVendors();
		await loadInvoices();
	});

	async function loadInvoices() {
		isLoading = true;
		try {
			invoices = await getInvoicesByYear(fiscalYear.selectedYear);
			linkedJournals = await getJournalsWithInvoiceId();
		} finally {
			isLoading = false;
		}
	}

	// 年度が変わったらリロード
	$effect(() => {
		if (fiscalYear.selectedYear) {
			loadInvoices();
		}
	});

	function createNewInvoice() {
		goto(`${base}/invoice/new`);
	}

	function editInvoice(invoice: Invoice) {
		goto(`${base}/invoice/${invoice.id}`);
	}

	async function handleCopy(invoice: Invoice) {
		try {
			const copied = copyInvoiceForNew(invoice);
			const suggestedNumber = await generateNextInvoiceNumber();
			copied.invoiceNumber = suggestedNumber;
			const newId = await addInvoice(copied);
			goto(`${base}/invoice/${newId}`);
		} catch (error) {
			console.error('Copy failed:', error);
		}
	}

	// 削除対象の請求書に紐づく仕訳
	let deletingSettlement = $state<InvoiceSettlement | null>(null);
	let deletingGeneratedSales = $state<JournalEntry | null>(null);
	let isDeleting = $state(false);

	function openDeleteDialog(invoice: Invoice) {
		deletingInvoice = invoice;
		deletingSettlement = settlementOf(invoice) ?? null;
		deletingGeneratedSales =
			linkedJournals.find((j) => j.id === deletingSettlement?.generatedSalesJournalId) ?? null;
		deleteDialogOpen = true;
	}

	async function handleDelete() {
		if (!deletingInvoice) return;

		isDeleting = true;
		try {
			// 請求書から生成した売掛金仕訳は請求書が所有するので一緒に削除する。
			// それ以外の紐づく仕訳（手で切った売掛金仕訳・入金仕訳）は紐づけを外して残す
			const salesDeleted = deletingGeneratedSales
				? await deleteLinkedJournal(deletingGeneratedSales.id)
				: false;
			const unlinked = await unlinkJournalsFromInvoice(deletingInvoice.id);
			await deleteInvoice(deletingInvoice.id);
			deleteDialogOpen = false;
			await loadInvoices();
			toast.success(salesDeleted ? '請求書と売掛金仕訳を削除しました' : '請求書を削除しました', {
				description:
					unlinked > 0 ? `紐づいていた仕訳 ${unlinked} 件は仕訳帳に残っています` : undefined
			});
		} catch (error) {
			console.error('Delete failed:', error);
			toast.error(error instanceof Error ? error.message : '削除に失敗しました');
		} finally {
			isDeleting = false;
		}
	}

	function getPaymentBadgeVariant(
		status: InvoicePaymentStatus
	): 'default' | 'secondary' | 'destructive' | 'outline' {
		switch (status) {
			case 'paid':
				return 'outline';
			case 'partial':
				return 'default';
			default:
				return 'secondary';
		}
	}

	function getStatusBadgeVariant(
		status: Invoice['status']
	): 'default' | 'secondary' | 'destructive' | 'outline' {
		switch (status) {
			case 'draft':
				return 'secondary';
			case 'issued':
				return 'default';
			default:
				return 'secondary';
		}
	}

	function getVendorName(vendorId: string): string {
		if (!vendorId) return '(取引先未設定)';
		return vendorMap.get(vendorId) || '(削除された取引先)';
	}
</script>

<svelte:head>
	<title>請求書一覧 - e-shiwake</title>
</svelte:head>

<div class="space-y-6">
	<!-- ヘッダー -->
	<div
		class="sticky top-14 z-10 -mx-4 flex flex-wrap items-center justify-between gap-4 border-b bg-background px-4 pt-4 pb-3 group-has-data-[collapsible=icon]/sidebar-wrapper:top-12"
	>
		<div>
			<h1 class="text-2xl font-bold">請求書一覧</h1>
			<p class="text-sm text-muted-foreground">{fiscalYear.selectedYear}年度の請求書</p>
		</div>
		<Button onclick={createNewInvoice}>
			<Plus class="mr-2 size-4" />
			新規作成
		</Button>
	</div>

	<!-- フィルター -->
	<div class="flex flex-wrap items-center gap-4">
		<div class="flex items-center gap-2">
			<span class="text-sm text-muted-foreground">ステータス:</span>
			<Select.Root type="single" bind:value={statusFilter}>
				<Select.Trigger class="w-[140px]">
					{statusFilter === 'all'
						? 'すべて'
						: InvoiceStatusLabels[statusFilter as Invoice['status']]}
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="all">すべて</Select.Item>
					<Select.Item value="draft">下書き</Select.Item>
					<Select.Item value="issued">発行済み</Select.Item>
				</Select.Content>
			</Select.Root>
		</div>
		<div class="flex items-center gap-2">
			<span class="text-sm text-muted-foreground">入金:</span>
			<Select.Root type="single" bind:value={paymentFilter}>
				<Select.Trigger class="w-[140px]">
					{paymentFilter === 'all'
						? 'すべて'
						: InvoicePaymentStatusLabels[paymentFilter as InvoicePaymentStatus]}
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="all">すべて</Select.Item>
					<Select.Item value="unpaid">未入金</Select.Item>
					<Select.Item value="partial">一部入金</Select.Item>
					<Select.Item value="paid">入金済</Select.Item>
				</Select.Content>
			</Select.Root>
		</div>
		<div class="text-sm text-muted-foreground">{filteredInvoices.length}件</div>
	</div>

	{#if isLoading}
		<div class="flex items-center justify-center py-8">
			<p class="text-muted-foreground">読み込み中...</p>
		</div>
	{:else if filteredInvoices.length === 0}
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<FileSpreadsheet class="mb-4 size-12 text-muted-foreground" />
			{#if invoices.length === 0}
				<p class="text-lg font-medium">請求書がありません</p>
				<p class="mb-4 text-sm text-muted-foreground">
					「新規作成」ボタンから請求書を作成してください
				</p>
				<Button onclick={createNewInvoice}>
					<Plus class="mr-2 size-4" />
					新規作成
				</Button>
			{:else}
				<p class="text-lg font-medium">該当する請求書がありません</p>
				<p class="text-sm text-muted-foreground">フィルター条件を変更してください</p>
			{/if}
		</div>
	{:else}
		<!-- 請求書一覧 -->
		<div class="overflow-x-auto">
			<table class="w-full">
				<thead>
					<tr class="border-b text-left text-sm text-muted-foreground">
						<th class="pr-4 pb-3">請求書番号</th>
						<th class="pr-4 pb-3">発行日</th>
						<th class="pr-4 pb-3">取引先</th>
						<th class="pr-4 pb-3 text-right">金額（税込）</th>
						<th class="pr-4 pb-3">ステータス</th>
						<th class="pr-4 pb-3">入金</th>
						<th class="pb-3">操作</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredInvoices as invoice (invoice.id)}
						<tr class="border-b transition-colors hover:bg-muted/50">
							<td class="py-3 pr-4 font-medium">{invoice.invoiceNumber}</td>
							<td class="py-3 pr-4">{invoice.issueDate}</td>
							<td class="py-3 pr-4">{getVendorName(invoice.vendorId)}</td>
							<td class="py-3 pr-4 text-right">¥{formatCurrency(invoice.total)}</td>
							<td class="py-3 pr-4">
								<Badge variant={getStatusBadgeVariant(invoice.status)}>
									{InvoiceStatusLabels[invoice.status]}
								</Badge>
							</td>
							<td class="py-3 pr-4">
								{#if invoice.status === 'issued'}
									{@const st = settlementOf(invoice)}
									{#if st}
										<Badge
											variant={getPaymentBadgeVariant(st.paymentStatus)}
											title={st.paymentStatus === 'paid' && st.depositedTotal === 0
												? '旧バージョンで「入金済み」にした請求書です（入金仕訳は紐づいていません）'
												: `入金 ¥${formatCurrency(st.depositedTotal)} / ¥${formatCurrency(invoice.total)}`}
										>
											{InvoicePaymentStatusLabels[st.paymentStatus]}
										</Badge>
										{#if st.paymentStatus === 'partial'}
											<span class="ml-1 text-xs text-muted-foreground">
												¥{formatCurrency(st.depositedTotal)}
											</span>
										{/if}
									{/if}
								{:else}
									<span class="text-xs text-muted-foreground">—</span>
								{/if}
							</td>
							<td class="py-3">
								<div class="flex gap-2">
									<Button
										size="sm"
										variant="outline"
										title="編集"
										onclick={() => editInvoice(invoice)}
									>
										<Pencil class="size-4" />
									</Button>
									<Button
										size="sm"
										variant="outline"
										title="コピーして新規作成"
										onclick={() => handleCopy(invoice)}
									>
										<Copy class="size-4" />
									</Button>
									<Button
										size="sm"
										variant="outline"
										title="削除"
										onclick={() => openDeleteDialog(invoice)}
									>
										<Trash2 class="size-4" />
									</Button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<!-- 削除確認ダイアログ -->
<Dialog.Root bind:open={deleteDialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>請求書を削除</Dialog.Title>
			<Dialog.Description>
				請求書「{deletingInvoice?.invoiceNumber}」を削除しますか？この操作は取り消せません。
			</Dialog.Description>
		</Dialog.Header>
		{#if deletingGeneratedSales || (deletingSettlement && deletingSettlement.salesJournalIds.length + deletingSettlement.depositJournalIds.length > 0)}
			{@const otherCount =
				(deletingSettlement?.salesJournalIds.length ?? 0) +
				(deletingSettlement?.depositJournalIds.length ?? 0) -
				(deletingGeneratedSales ? 1 : 0)}
			<div
				class="space-y-2 rounded-md border border-amber-500/50 bg-amber-50 p-3 text-sm dark:bg-amber-950/30"
			>
				{#if deletingGeneratedSales}
					<p class="font-medium text-amber-800 dark:text-amber-200">
						この請求書から生成した売掛金仕訳も一緒に削除されます
					</p>
					<p class="text-amber-700 dark:text-amber-300">
						{deletingGeneratedSales.date}
						¥{formatCurrency(receivableDebitTotal(deletingGeneratedSales))}
						「{deletingGeneratedSales.description}」
						{#if deletingGeneratedSales.attachments.length > 0}
							（添付された証憑 {deletingGeneratedSales.attachments.length} 件も削除されます）
						{/if}
					</p>
				{/if}
				{#if otherCount > 0}
					<p class="text-amber-700 dark:text-amber-300">
						紐づく仕訳 {otherCount} 件（仕訳帳で作成した売掛金仕訳・入金仕訳）は、紐づけを外して仕訳帳に残ります。不要な場合は仕訳帳から削除してください。
					</p>
				{/if}
			</div>
		{/if}
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (deleteDialogOpen = false)} disabled={isDeleting}>
				キャンセル
			</Button>
			<Button variant="destructive" onclick={handleDelete} disabled={isDeleting}>削除</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
