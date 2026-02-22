<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { ArrowLeft, Printer, BookOpen, CheckCircle, Banknote } from '@lucide/svelte';
	import type { Invoice, InvoiceStatus } from '$lib/types/invoice';
	import { InvoiceStatusLabels } from '$lib/types/invoice';
	import type { Vendor } from '$lib/types';
	import {
		initializeDatabase,
		getInvoiceById,
		addInvoice,
		updateInvoice,
		getAllVendors,
		generateNextInvoiceNumber,
		getSetting
	} from '$lib/db';
	import {
		calculateInvoiceAmounts,
		createEmptyInvoice,
		formatCurrency,
		getNextMonthEndDate
	} from '$lib/utils/invoice';
	import { omit } from '$lib/utils';
	import { createDebounce } from '$lib/utils/debounce';
	import type { BusinessInfo } from '$lib/types/blue-return-types';
	import InvoicePrint from '$lib/components/invoice/InvoicePrint.svelte';
	import InvoiceItemsTable from '$lib/components/invoice/InvoiceItemsTable.svelte';
	import InvoiceJournalDialog from '$lib/components/invoice/InvoiceJournalDialog.svelte';

	// ページパラメータ
	const invoiceId = $derived(page.params.id);
	const isNew = $derived(invoiceId === 'new');

	// 状態
	let invoice = $state<Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>>(createEmptyInvoice());
	let originalInvoice = $state<Invoice | null>(null);
	let vendors = $state<Vendor[]>([]);
	let isLoading = $state(true);
	let isSaving = $state(false);
	let error = $state('');

	// 仕訳生成ダイアログ
	let journalDialogOpen = $state(false);
	let journalType = $state<'sales' | 'deposit'>('sales');

	// 事業者情報（印刷用）
	let businessInfo = $state<BusinessInfo | null>(null);

	// 取引先マップ
	const vendorMap = $derived(new Map(vendors.map((v) => [v.id, v])));

	// 選択中の取引先
	const selectedVendor = $derived(vendorMap.get(invoice.vendorId));

	// 印刷用請求書
	const printableInvoice = $derived<Invoice>(
		originalInvoice ?? {
			...invoice,
			id: 'preview',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		}
	);

	// 初期化フラグ
	let initialized = $state(false);

	async function loadInvoice(id: string) {
		isLoading = true;
		const existing = await getInvoiceById(id);
		if (existing) {
			originalInvoice = existing;
			invoice = omit(existing, ['id', 'createdAt', 'updatedAt']);
		} else {
			error = '請求書が見つかりません';
		}
		isLoading = false;
	}

	onMount(async () => {
		await initializeDatabase();
		vendors = await getAllVendors();
		businessInfo = (await getSetting('businessInfo')) ?? null;
		initialized = true;

		if (isNew) {
			const suggestedNumber = await generateNextInvoiceNumber();
			const newInvoice = {
				...createEmptyInvoice(),
				invoiceNumber: suggestedNumber
			};
			const id = await addInvoice(newInvoice);
			goto(`${base}/invoice/${id}`, { replaceState: true });
		} else {
			await loadInvoice(invoiceId!);
		}
	});

	$effect(() => {
		if (initialized && !isNew && invoiceId) {
			loadInvoice(invoiceId);
		}
	});

	// 合計金額を再計算
	function recalculate() {
		const result = calculateInvoiceAmounts(invoice.items);
		invoice.subtotal = result.subtotal;
		invoice.taxAmount = result.taxAmount;
		invoice.total = result.total;
		invoice.taxBreakdown = result.taxBreakdown;
		autoSave();
	}

	// 取引先変更時に支払期限を更新
	function onVendorChange(vendorId: string) {
		invoice.vendorId = vendorId;
		const vendor = vendorMap.get(vendorId);
		if (vendor?.paymentTerms) {
			invoice.dueDate = getNextMonthEndDate(invoice.issueDate);
		}
		autoSave();
	}

	// 自動保存（デバウンス付き）
	const autoSave = createDebounce(async () => {
		if (isNew) return;

		isSaving = true;
		try {
			await updateInvoice(invoiceId!, $state.snapshot(invoice));
			const updated = await getInvoiceById(invoiceId!);
			if (updated) {
				originalInvoice = updated;
			}
			error = '';
		} catch (e) {
			error = e instanceof Error ? e.message : '自動保存に失敗しました';
		} finally {
			isSaving = false;
		}
	}, 500);

	// ステータス変更
	async function changeStatus(newStatus: InvoiceStatus) {
		if (isNew) {
			error = '保存してからステータスを変更してください';
			return;
		}

		isSaving = true;
		try {
			await updateInvoice(invoiceId!, { status: newStatus });
			invoice.status = newStatus;
			const updated = await getInvoiceById(invoiceId!);
			if (updated) {
				originalInvoice = updated;
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'ステータス変更に失敗しました';
		} finally {
			isSaving = false;
		}
	}

	function openJournalDialog(type: 'sales' | 'deposit') {
		journalType = type;
		journalDialogOpen = true;
	}

	function handleJournalSave(journalId?: string) {
		if (journalId) {
			invoice.journalId = journalId;
		}
	}

	function handlePrint() {
		window.print();
	}

	function goBack() {
		goto(`${base}/invoice`);
	}
</script>

<svelte:head>
	<title>請求書 {invoice.invoiceNumber || '新規'} - e-shiwake</title>
</svelte:head>

<div class="space-y-6 print:hidden">
	<!-- ヘッダー -->
	<div
		class="sticky top-14 z-10 -mx-4 flex flex-wrap items-center justify-between gap-4 border-b bg-background px-4 pt-4 pb-3 group-has-data-[collapsible=icon]/sidebar-wrapper:top-12 print:hidden"
	>
		<div class="flex items-center gap-4">
			<Button variant="ghost" size="icon" onclick={goBack}>
				<ArrowLeft class="size-5" />
			</Button>
			<div>
				<h1 class="text-2xl font-bold">請求書</h1>
				<div class="flex items-center gap-2">
					<Badge variant={invoice.status === 'paid' ? 'outline' : 'default'}>
						{InvoiceStatusLabels[invoice.status]}
					</Badge>
				</div>
			</div>
		</div>
		<div class="flex flex-wrap gap-2">
			{#if !isNew && invoice.status === 'draft'}
				<Button variant="outline" onclick={() => changeStatus('issued')} disabled={isSaving}>
					<CheckCircle class="mr-2 size-4" />
					発行済みにする
				</Button>
			{/if}
			{#if !isNew && invoice.status === 'issued'}
				<Button variant="outline" onclick={() => changeStatus('paid')} disabled={isSaving}>
					<Banknote class="mr-2 size-4" />
					入金済みにする
				</Button>
			{/if}
			{#if !isNew}
				<Button variant="outline" onclick={() => openJournalDialog('sales')} disabled={isSaving}>
					<BookOpen class="mr-2 size-4" />
					売掛金仕訳
				</Button>
				{#if invoice.status === 'paid'}
					<Button
						variant="outline"
						onclick={() => openJournalDialog('deposit')}
						disabled={isSaving}
					>
						<Banknote class="mr-2 size-4" />
						入金仕訳
					</Button>
				{/if}
				<Button variant="outline" onclick={handlePrint}>
					<Printer class="mr-2 size-4" />
					印刷
				</Button>
			{/if}
		</div>
	</div>

	{#if error}
		<div class="rounded-md border border-destructive bg-destructive/10 p-4 text-destructive">
			{error}
		</div>
	{/if}

	{#if isLoading}
		<div class="flex items-center justify-center py-8">
			<p class="text-muted-foreground">読み込み中...</p>
		</div>
	{:else}
		<!-- 請求書フォーム -->
		<div class="space-y-6 rounded-lg border p-6 print:border-none print:p-0">
			<!-- 基本情報 -->
			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<div class="space-y-2">
					<Label for="invoiceNumber">請求書番号 *</Label>
					<Input
						id="invoiceNumber"
						bind:value={invoice.invoiceNumber}
						placeholder="INV-2026-0001"
						oninput={autoSave}
					/>
				</div>
				<div class="space-y-2">
					<Label for="issueDate">発行日 *</Label>
					<Input id="issueDate" type="date" bind:value={invoice.issueDate} onchange={autoSave} />
				</div>
				<div class="space-y-2">
					<Label for="dueDate">支払期限 *</Label>
					<Input id="dueDate" type="date" bind:value={invoice.dueDate} onchange={autoSave} />
				</div>
				<div class="space-y-2">
					<Label>取引先 *</Label>
					<Select.Root type="single" value={invoice.vendorId} onValueChange={onVendorChange}>
						<Select.Trigger>
							{selectedVendor?.name || '選択してください'}
						</Select.Trigger>
						<Select.Content>
							{#each vendors as vendor (vendor.id)}
								<Select.Item value={vendor.id}>{vendor.name}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
			</div>

			<!-- 明細行 -->
			<InvoiceItemsTable bind:items={invoice.items} onchange={recalculate} />

			<!-- 金額サマリー -->
			<div class="flex justify-end">
				<div class="w-full max-w-xs space-y-2">
					<div class="flex justify-between">
						<span class="text-muted-foreground">小計（税抜）</span>
						<span>¥{formatCurrency(invoice.subtotal)}</span>
					</div>
					{#if (invoice.taxBreakdown?.taxable10 ?? 0) > 0}
						<div class="flex justify-between text-sm">
							<span class="text-muted-foreground">10%対象</span>
							<span>¥{formatCurrency(invoice.taxBreakdown?.taxable10)}</span>
						</div>
						<div class="flex justify-between text-sm">
							<span class="text-muted-foreground">消費税（10%）</span>
							<span>¥{formatCurrency(invoice.taxBreakdown?.tax10)}</span>
						</div>
					{/if}
					{#if (invoice.taxBreakdown?.taxable8 ?? 0) > 0}
						<div class="flex justify-between text-sm">
							<span class="text-muted-foreground">8%対象</span>
							<span>¥{formatCurrency(invoice.taxBreakdown?.taxable8)}</span>
						</div>
						<div class="flex justify-between text-sm">
							<span class="text-muted-foreground">消費税（8%）</span>
							<span>¥{formatCurrency(invoice.taxBreakdown?.tax8)}</span>
						</div>
					{/if}
					<div class="flex justify-between border-t pt-2 text-lg font-bold">
						<span>合計（税込）</span>
						<span>¥{formatCurrency(invoice.total)}</span>
					</div>
				</div>
			</div>

			<!-- 備考 -->
			<div class="space-y-2">
				<Label for="note">備考</Label>
				<Textarea
					id="note"
					bind:value={invoice.note}
					placeholder="振込手数料はご負担ください。"
					rows={3}
					oninput={autoSave}
				/>
			</div>
		</div>
	{/if}
</div>

<!-- 仕訳生成ダイアログ -->
<InvoiceJournalDialog
	bind:open={journalDialogOpen}
	{journalType}
	invoice={originalInvoice}
	invoiceId={invoiceId!}
	vendor={selectedVendor ?? null}
	onsave={handleJournalSave}
/>

<!-- 印刷用コンポーネント -->
<div class="hidden print:block">
	<InvoicePrint invoice={printableInvoice} vendor={selectedVendor ?? null} {businessInfo} />
</div>
