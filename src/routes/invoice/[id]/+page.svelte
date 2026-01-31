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
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import {
		ArrowLeft,
		Plus,
		Trash2,
		Printer,
		BookOpen,
		CheckCircle,
		Banknote
	} from '@lucide/svelte';
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
		addJournal
	} from '$lib/db';
	import {
		calculateItemAmount,
		calculateInvoiceAmounts,
		createEmptyInvoice,
		createEmptyInvoiceItem,
		formatCurrency,
		getNextMonthEndDate
	} from '$lib/utils/invoice';
	import { generateSalesJournal, generateDepositJournal } from '$lib/utils/invoice-journal';
	import InvoicePrint from '$lib/components/invoice/InvoicePrint.svelte';
	import type { BusinessInfo } from '$lib/types/blue-return-types';
	import { getSetting } from '$lib/db';
	import { omit } from '$lib/utils';
	import { createDebounce } from '$lib/utils/debounce';

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
	let depositDate = $state(new Date().toISOString().slice(0, 10));

	// 事業者情報（印刷用）
	let businessInfo = $state<BusinessInfo | null>(null);

	// 取引先マップ
	const vendorMap = $derived(new Map(vendors.map((v) => [v.id, v])));

	// 選択中の取引先
	const selectedVendor = $derived(vendorMap.get(invoice.vendorId));

	// 印刷用請求書（保存済み or 現在の編集内容）
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

	// 請求書を読み込む関数
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
			// 新規作成: 即座にDBに保存してリダイレクト
			const suggestedNumber = await generateNextInvoiceNumber();
			const newInvoice = {
				...createEmptyInvoice(),
				invoiceNumber: suggestedNumber
			};
			const id = await addInvoice(newInvoice);
			// リダイレクト（replace: trueでヒストリーを置き換え）
			goto(`${base}/invoice/${id}`, { replaceState: true });
		} else {
			// 編集: 既存データを読み込み
			await loadInvoice(invoiceId!);
		}
	});

	// URLパラメータが変更された場合にデータを再読み込み
	$effect(() => {
		if (initialized && !isNew && invoiceId) {
			loadInvoice(invoiceId);
		}
	});

	// 明細行を追加
	function addItem() {
		invoice.items = [...invoice.items, createEmptyInvoiceItem()];
		autoSave();
	}

	// 明細行を削除
	function removeItem(index: number) {
		invoice.items = invoice.items.filter((_, i) => i !== index);
		recalculate();
	}

	// 明細行の金額を再計算
	function updateItemAmount(index: number) {
		const item = invoice.items[index];
		item.amount = calculateItemAmount(item.quantity, item.unitPrice);
		invoice.items = [...invoice.items];
		recalculate();
	}

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
			// 支払条件があれば翌月末をデフォルトに
			invoice.dueDate = getNextMonthEndDate(invoice.issueDate);
		}
		autoSave();
	}

	// 自動保存（デバウンス付き）
	const autoSave = createDebounce(async () => {
		// 新規の場合はonMountで既にDBに保存されているはず
		if (isNew) return;

		isSaving = true;
		try {
			await updateInvoice(invoiceId!, $state.snapshot(invoice));
			// 更新後にリロード
			const updated = await getInvoiceById(invoiceId!);
			if (updated) {
				originalInvoice = updated;
			}
			error = ''; // 成功時はエラーをクリア
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

	// 仕訳生成ダイアログを開く
	function openJournalDialog(type: 'sales' | 'deposit') {
		journalType = type;
		depositDate = new Date().toISOString().slice(0, 10);
		journalDialogOpen = true;
	}

	// 仕訳を生成
	async function createJournal() {
		if (!originalInvoice || !selectedVendor) return;

		try {
			let journalData;
			if (journalType === 'sales') {
				journalData = generateSalesJournal(originalInvoice, selectedVendor);
			} else {
				journalData = generateDepositJournal(originalInvoice, selectedVendor, depositDate);
			}

			const journalId = await addJournal(journalData);

			// 請求書に仕訳IDを紐付け
			if (journalType === 'sales') {
				await updateInvoice(invoiceId!, { journalId });
				invoice.journalId = journalId;
			}

			journalDialogOpen = false;
			alert('仕訳を作成しました');
		} catch (e) {
			error = e instanceof Error ? e.message : '仕訳の作成に失敗しました';
		}
	}

	// 印刷
	function handlePrint() {
		window.print();
	}

	// 戻る
	function goBack() {
		goto(`${base}/invoice`);
	}
</script>

<svelte:head>
	<title>請求書 {invoice.invoiceNumber || '新規'} - e-shiwake</title>
</svelte:head>

<div class="space-y-6 print:hidden">
	<!-- ヘッダー（画面表示用） -->
	<div class="flex flex-wrap items-center justify-between gap-4 print:hidden">
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
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<Label>明細</Label>
					<Button variant="outline" size="sm" onclick={addItem}>
						<Plus class="mr-2 size-4" />
						行を追加
					</Button>
				</div>

				{#if invoice.items.length === 0}
					<div class="rounded-md border border-dashed p-8 text-center text-muted-foreground">
						<p>明細行がありません</p>
						<Button variant="outline" size="sm" class="mt-2" onclick={addItem}>
							<Plus class="mr-2 size-4" />
							行を追加
						</Button>
					</div>
				{:else}
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead>
								<tr class="border-b text-left text-muted-foreground">
									<th class="w-24 pr-2 pb-2">日付</th>
									<th class="min-w-50 pr-2 pb-2">品名・サービス名</th>
									<th class="w-28 pr-2 pb-2 text-right">単価</th>
									<th class="w-16 pr-2 pb-2 text-right">数量</th>
									<th class="w-20 pr-2 pb-2 text-center">税率</th>
									<th class="min-w-25 pr-2 pb-2 text-right">金額</th>
									<th class="w-10 pb-2"></th>
								</tr>
							</thead>
							<tbody>
								{#each invoice.items as item, index (item.id)}
									<tr class="border-b">
										<td class="py-2 pr-2">
											<Input
												bind:value={item.date}
												placeholder="1月分"
												class="w-24"
												oninput={autoSave}
											/>
										</td>
										<td class="py-2 pr-2">
											<Input
												bind:value={item.description}
												placeholder="サービス名"
												class="min-w-50"
												oninput={autoSave}
											/>
										</td>
										<td class="py-2 pr-2">
											<Input
												type="number"
												bind:value={item.unitPrice}
												min="0"
												class="w-28 text-right"
												onchange={() => updateItemAmount(index)}
											/>
										</td>
										<td class="py-2 pr-2">
											<Input
												type="number"
												bind:value={item.quantity}
												min="0"
												step="0.01"
												class="w-16 text-right"
												onchange={() => updateItemAmount(index)}
											/>
										</td>
										<td class="py-2 pr-2">
											<Select.Root
												type="single"
												value={String(item.taxRate)}
												onValueChange={(v) => {
													item.taxRate = Number(v) as 10 | 8;
													invoice.items = [...invoice.items];
													recalculate();
												}}
											>
												<Select.Trigger class="w-20">
													{item.taxRate}%
												</Select.Trigger>
												<Select.Content>
													<Select.Item value="10">10%</Select.Item>
													<Select.Item value="8">8%</Select.Item>
												</Select.Content>
											</Select.Root>
										</td>
										<td class="min-w-25 py-2 pr-2 text-right font-medium">
											¥{formatCurrency(item.amount)}
										</td>
										<td class="py-2">
											<Button variant="ghost" size="icon" onclick={() => removeItem(index)}>
												<Trash2 class="size-4" />
											</Button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>

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
<Dialog.Root bind:open={journalDialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>
				{journalType === 'sales' ? '売掛金仕訳を作成' : '入金仕訳を作成'}
			</Dialog.Title>
			<Dialog.Description>
				{#if journalType === 'sales'}
					請求書発行に対応する売掛金仕訳を作成します。
				{:else}
					入金日を指定して入金仕訳を作成します。
				{/if}
			</Dialog.Description>
		</Dialog.Header>
		{#if journalType === 'deposit'}
			<div class="space-y-2 py-4">
				<Label for="depositDate">入金日</Label>
				<Input id="depositDate" type="date" bind:value={depositDate} />
			</div>
		{/if}
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (journalDialogOpen = false)}>キャンセル</Button>
			<Button onclick={createJournal}>作成</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- 印刷用コンポーネント（画面では非表示、印刷時のみ表示） -->
<div class="hidden print:block">
	<InvoicePrint invoice={printableInvoice} vendor={selectedVendor ?? null} {businessInfo} />
</div>
