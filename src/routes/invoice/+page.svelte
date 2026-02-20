<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Plus, FileSpreadsheet, Pencil, Trash2 } from '@lucide/svelte';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import type { Invoice } from '$lib/types/invoice';
	import { InvoiceStatusLabels } from '$lib/types/invoice';
	import type { Vendor } from '$lib/types';
	import { initializeDatabase, getInvoicesByYear, getAllVendors, deleteInvoice } from '$lib/db';
	import { useFiscalYear } from '$lib/stores/fiscalYear.svelte.js';
	import { formatCurrency } from '$lib/utils/invoice';

	const fiscalYear = useFiscalYear();

	// 状態
	let invoices = $state<Invoice[]>([]);
	let vendors = $state<Vendor[]>([]);
	let isLoading = $state(true);
	let deleteDialogOpen = $state(false);
	let deletingInvoice = $state<Invoice | null>(null);

	// フィルター
	let statusFilter = $state<string>('all');

	// ベンダー名を取得するためのマップ
	const vendorMap = $derived(new Map(vendors.map((v) => [v.id, v.name])));

	// フィルタリングされた請求書
	const filteredInvoices = $derived(
		statusFilter === 'all' ? invoices : invoices.filter((inv) => inv.status === statusFilter)
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

	function openDeleteDialog(invoice: Invoice) {
		deletingInvoice = invoice;
		deleteDialogOpen = true;
	}

	async function handleDelete() {
		if (!deletingInvoice) return;

		try {
			await deleteInvoice(deletingInvoice.id);
			deleteDialogOpen = false;
			await loadInvoices();
		} catch (error) {
			console.error('Delete failed:', error);
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
			case 'paid':
				return 'outline';
			default:
				return 'secondary';
		}
	}

	function getVendorName(vendorId: string): string {
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
					<Select.Item value="paid">入金済み</Select.Item>
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
							<td class="py-3">
								<div class="flex gap-2">
									<Button size="sm" variant="outline" onclick={() => editInvoice(invoice)}>
										<Pencil class="size-4" />
									</Button>
									<Button size="sm" variant="outline" onclick={() => openDeleteDialog(invoice)}>
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
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (deleteDialogOpen = false)}>キャンセル</Button>
			<Button variant="destructive" onclick={handleDelete}>削除</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
