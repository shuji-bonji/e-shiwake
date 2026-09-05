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
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import {
		ArrowLeft,
		Printer,
		BookOpen,
		CheckCircle,
		Banknote,
		Info,
		Undo2,
		Plus
	} from '@lucide/svelte';
	import type { Invoice, InvoiceStatus } from '$lib/types/invoice';
	import { InvoiceStatusLabels, InvoicePaymentStatusLabels } from '$lib/types/invoice';
	import type { Vendor, JournalEntry } from '$lib/types';
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
		getNextMonthEndDate,
		validateQualifiedInvoice
	} from '$lib/utils/invoice';
	import { omit } from '$lib/utils';
	import { compareSalesJournal } from '$lib/utils/invoice-journal';
	import { loadInvoiceSettlement, syncSalesJournal } from '$lib/utils/invoice-journal-sync';
	import { deriveInvoiceSettlement } from '$lib/utils/invoice-settlement';
	import { dispatchUICommand } from '$lib/stores/uiCommand.svelte';
	import { createDebounce } from '$lib/utils/debounce';
	import type { BusinessInfo } from '$lib/types/blue-return-types';
	import InvoicePrint from '$lib/components/invoice/InvoicePrint.svelte';
	import InvoiceItemsTable from '$lib/components/invoice/InvoiceItemsTable.svelte';
	import InvoiceJournalDialog from '$lib/components/invoice/InvoiceJournalDialog.svelte';
	import { useUICommand, clearPendingCommand } from '$lib/stores/uiCommand.svelte';
	import { toast } from 'svelte-sonner';

	// ページパラメータ
	const invoiceId = $derived(page.params.id);
	const isNew = $derived(invoiceId === 'new');

	// 状態
	let invoice = $state<Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>>(createEmptyInvoice());
	let originalInvoice = $state<Invoice | null>(null);

	// 請求書に紐づく仕訳（invoiceId が一致する仕訳。仕訳帳の状態が真実で、ここでは集計するだけ）
	let linkedJournals = $state<JournalEntry[]>([]);
	let vendors = $state<Vendor[]>([]);
	let isLoading = $state(true);
	let isSaving = $state(false);
	let error = $state('');

	// 仕訳生成ダイアログ
	let journalDialogOpen = $state(false);
	let journalType = $state<'sales' | 'deposit'>('sales');

	// ステータスを戻す確認ダイアログ
	let revertDialogOpen = $state(false);

	// ステータスを 1 段階戻したときの遷移先（下書きの場合は戻せないので null）
	const previousStatus = $derived<InvoiceStatus | null>(
		invoice.status === 'issued' ? 'draft' : null
	);

	// 事業者情報（印刷用）
	let businessInfo = $state<BusinessInfo | null>(null);

	// 取引先マップ
	const vendorMap = $derived(new Map(vendors.map((v) => [v.id, v])));

	// 選択中の取引先
	const selectedVendor = $derived(vendorMap.get(invoice.vendorId));

	// 決済状態（売掛金仕訳の有無・入金状態）を紐づく仕訳から導出
	const settlement = $derived(
		originalInvoice
			? deriveInvoiceSettlement({ ...originalInvoice, ...invoice }, linkedJournals)
			: null
	);

	// 請求書から生成した売掛金仕訳（請求書の変更に追従する対象）
	const generatedSalesJournal = $derived(
		settlement?.generatedSalesJournalId
			? (linkedJournals.find((j) => j.id === settlement.generatedSalesJournalId) ?? null)
			: null
	);

	// 生成した売掛金仕訳と請求書の不一致（自動保存のあとに仕訳へ反映する）
	const salesJournalDiffs = $derived(
		generatedSalesJournal && selectedVendor && originalInvoice
			? // $state.snapshot() は依存関係を追跡しないため、プロキシのまま渡す（読み取りのみ）
				compareSalesJournal(
					{ ...originalInvoice, ...invoice },
					selectedVendor,
					generatedSalesJournal
				)
			: []
	);

	// 手で切って紐づけた売掛金仕訳のうち、請求書と内容が異なるもの（上書きはしない。表示だけ）
	const manualSalesJournalDiffs = $derived.by(() => {
		const vendor = selectedVendor;
		const original = originalInvoice;
		const current = settlement;
		if (!vendor || !original || !current) return [];
		const merged: Invoice = { ...original, ...invoice };
		return linkedJournals
			.filter((j) => current.salesJournalIds.includes(j.id) && j.generatedFrom !== 'invoice')
			.map((j) => ({ journal: j, diffs: compareSalesJournal(merged, vendor, j) }))
			.filter((entry) => entry.diffs.length > 0);
	});

	// 適格請求書バリデーション警告
	const qualifiedInvoiceWarnings = $derived(
		validateQualifiedInvoice(invoice, businessInfo, selectedVendor ?? null)
	);

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

	// UICommand ストア（WebMCP UI操作型ツールからのコマンドを受信）
	const uiCommand = useUICommand();

	// 読み込み済み（または読み込み中）の請求書ID。同じIDの二重読み込みを防ぐ
	let loadedInvoiceId = $state<string | null>(null);

	async function loadInvoice(id: string) {
		loadedInvoiceId = id;
		isLoading = true;
		const existing = await getInvoiceById(id);
		if (existing) {
			originalInvoice = existing;
			invoice = omit(existing, ['id', 'createdAt', 'updatedAt']);
			await reloadLinkedJournals();
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
			await applyVendorFromQuery();
		}
	});

	// 取引先管理から戻ってきたとき（?vendorId=...）にその取引先を選択する
	async function applyVendorFromQuery() {
		const vendorId = page.url.searchParams.get('vendorId');
		if (!vendorId) return;
		const vendor = vendorMap.get(vendorId);
		if (vendor) {
			invoice.vendorId = vendorId;
			if (vendor.paymentTerms) {
				invoice.dueDate = getNextMonthEndDate(invoice.issueDate);
			}
			// URL を書き換えると loadInvoice() が再実行されて DB の内容で上書きされるため、
			// デバウンス付きの autoSave ではなく、先に保存を完了させる
			await updateInvoice(invoiceId!, $state.snapshot(invoice));
			toast.success(`取引先「${vendor.name}」を設定しました`);
		}
		// クエリを消して URL を元に戻す（リロード時の再適用を防ぐ）
		await goto(`${base}/invoice/${invoiceId}`, { replaceState: true, noScroll: true });
	}

	// 取引先管理へ移動して取引先を追加し、この請求書に戻る
	function goToCreateVendor() {
		const returnTo = `/invoice/${invoiceId}`;
		goto(`${base}/vendors?new=1&returnTo=${encodeURIComponent(returnTo)}`);
	}

	// 取引先未設定のまま仕訳ボタンを押したときの案内
	function notifyVendorRequired() {
		toast.warning('取引先が指定されていません', {
			description:
				'取引先が未設定のため仕訳を作成できません。取引先を作成して、この請求書に指定してください。',
			action: {
				label: '取引先を追加',
				onClick: goToCreateVendor
			}
		});
	}

	$effect(() => {
		// onMount の初回読み込みと重複しないよう、別の請求書へ移動したときだけ読み込む
		if (initialized && !isNew && invoiceId && invoiceId !== loadedInvoiceId) {
			loadInvoice(invoiceId);
		}
	});

	// WebMCP UI操作: 請求書エディタ向けのコマンドを処理
	$effect(() => {
		if (!initialized) return;
		const cmd = uiCommand.pending;
		if (cmd?.type === 'open_invoice_editor') {
			const data = cmd.data;
			clearPendingCommand();

			// プリフィルデータを適用
			if (data.vendorId) {
				invoice.vendorId = data.vendorId;
			}
			if (data.dueDate) {
				invoice.dueDate = data.dueDate;
			}
			if (data.note) {
				invoice.note = data.note;
			}
			if (data.items && data.items.length > 0) {
				invoice.items = data.items.map((item) => ({
					id: crypto.randomUUID(),
					date: '',
					description: item.description,
					quantity: item.quantity,
					unitPrice: item.unitPrice,
					amount: item.quantity * item.unitPrice,
					taxRate: item.taxRate
				}));
				recalculate();
			}

			toast.info('AIが請求書フォームを準備しました。内容を確認してください。');
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

			// 請求書から生成した売掛金仕訳が内容と食い違っていれば、請求書に合わせて上書きする
			// （手で切って紐づけた仕訳は上書きしない）
			if (updated && generatedSalesJournal && selectedVendor && salesJournalDiffs.length > 0) {
				await syncSalesJournal(generatedSalesJournal.id, updated, selectedVendor);
				await reloadLinkedJournals();
				toast.info('売掛金仕訳が作成済みのため、仕訳の内容を請求書に合わせて更新しました', {
					id: 'sales-journal-sync'
				});
			}
		} catch (e) {
			error = e instanceof Error ? e.message : '自動保存に失敗しました';
		} finally {
			isSaving = false;
		}
	}, 500);

	// 請求書に紐づく仕訳を DB から読み直す
	async function reloadLinkedJournals() {
		if (!originalInvoice) {
			linkedJournals = [];
			return;
		}
		const { journals } = await loadInvoiceSettlement(originalInvoice);
		linkedJournals = journals;
	}

	// 仕訳帳でこの請求書番号を検索した状態に移動する
	function openJournalSearch() {
		dispatchUICommand({ type: 'set_search_query', data: { query: invoice.invoiceNumber } });
		goto(`${base}/`);
	}

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

	// ステータスを 1 段階戻す（発行済み → 下書き）
	async function revertStatus() {
		if (!previousStatus) return;
		const target = previousStatus;
		revertDialogOpen = false;
		await changeStatus(target);
		if (!error) {
			toast.success(`ステータスを「${InvoiceStatusLabels[target]}」に戻しました`);
		}
	}

	function openJournalDialog(type: 'sales' | 'deposit') {
		journalType = type;
		journalDialogOpen = true;
	}

	async function handleJournalSave() {
		// 紐づけは仕訳側にあるので、仕訳を読み直すだけでよい
		await reloadLinkedJournals();
	}

	function handlePrint() {
		if (qualifiedInvoiceWarnings.length > 0) {
			toast.warning('適格請求書の記載要件を満たしていない項目があります。内容をご確認ください。');
		}
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
					<Badge variant="default">
						{InvoiceStatusLabels[invoice.status]}
					</Badge>
					{#if !isNew && invoice.status === 'issued' && settlement}
						<Badge
							variant={settlement.paymentStatus === 'paid' ? 'outline' : 'secondary'}
							title={settlement.paymentStatus === 'paid' && settlement.depositedTotal === 0
								? '旧バージョンで「入金済み」にした請求書です（入金仕訳は紐づいていません）'
								: `入金 ¥${formatCurrency(settlement.depositedTotal)} / ¥${formatCurrency(invoice.total)}`}
						>
							{InvoicePaymentStatusLabels[settlement.paymentStatus]}
							{#if settlement.paymentStatus === 'partial'}
								¥{formatCurrency(settlement.depositedTotal)} / ¥{formatCurrency(invoice.total)}
							{/if}
						</Badge>
					{/if}
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
			{#if !isNew && previousStatus}
				<Button
					variant="ghost"
					onclick={() => (revertDialogOpen = true)}
					disabled={isSaving}
					title={`「${InvoiceStatusLabels[previousStatus]}」に戻す`}
				>
					<Undo2 class="mr-2 size-4" />
					ステータスを戻す
				</Button>
			{/if}
			{#if !isNew}
				<!-- 仕訳の順序（発行 → 売掛計上 → 入金）に合わせ、売掛金仕訳は発行済みのときだけ作れる -->
				<Button
					variant="outline"
					onclick={() => (selectedVendor ? openJournalDialog('sales') : notifyVendorRequired())}
					disabled={isSaving || invoice.status !== 'issued' || settlement?.salesJournalCreated}
					class={!selectedVendor ? 'opacity-60' : ''}
					title={settlement?.salesJournalCreated
						? generatedSalesJournal
							? '売掛金仕訳は作成済みです。請求書を変更すると仕訳も自動で更新されます'
							: '仕訳帳で作成した売掛金仕訳が紐づいています'
						: invoice.status !== 'issued'
							? '請求書を発行済みにしてから作成してください'
							: !selectedVendor
								? '取引先を選択してください'
								: ''}
				>
					<BookOpen class="mr-2 size-4" />
					売掛金仕訳
					{#if settlement?.salesJournalCreated}
						<Badge variant="secondary" class="ml-1">作成済</Badge>
					{/if}
				</Button>
				{#if invoice.status === 'issued'}
					<Button
						variant="outline"
						onclick={() => (selectedVendor ? openJournalDialog('deposit') : notifyVendorRequired())}
						disabled={isSaving ||
							!settlement?.salesJournalCreated ||
							settlement?.paymentStatus === 'paid'}
						class={!selectedVendor ? 'opacity-60' : ''}
						title={!settlement?.salesJournalCreated
							? '先に売掛金仕訳を作成してください'
							: settlement?.paymentStatus === 'paid'
								? 'この請求書は入金済です'
								: !selectedVendor
									? '取引先を選択してください'
									: ''}
					>
						<Banknote class="mr-2 size-4" />
						売掛金入金仕訳
						{#if settlement && settlement.depositJournalIds.length > 0}
							<Badge variant="secondary" class="ml-1">
								{settlement.depositJournalIds.length} 件
							</Badge>
						{/if}
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

	{#if manualSalesJournalDiffs.length > 0}
		<!-- 手で切って紐づけた売掛金仕訳との食い違い（上書きはしない） -->
		<div
			class="rounded-md border border-amber-500/50 bg-amber-50 p-4 text-sm dark:bg-amber-950/30"
			role="status"
		>
			<p class="font-medium text-amber-800 dark:text-amber-200">
				紐づく売掛金仕訳は請求書と内容が異なります（手動作成のため自動更新していません）
			</p>
			{#each manualSalesJournalDiffs as entry (entry.journal.id)}
				<ul class="mt-1 space-y-0.5 text-amber-700 dark:text-amber-300">
					{#each entry.diffs as diff (diff.field)}
						<li>{diff.label}: 仕訳 {diff.journalValue} ／ 請求書 {diff.invoiceValue}</li>
					{/each}
				</ul>
			{/each}
			<button
				type="button"
				class="mt-2 text-amber-800 underline hover:no-underline dark:text-amber-200"
				onclick={openJournalSearch}
			>
				仕訳帳で「{invoice.invoiceNumber}」を検索
			</button>
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
					<div class="flex items-center justify-between">
						<Label>取引先 *</Label>
						{#if !isNew}
							<button
								type="button"
								class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
								onclick={goToCreateVendor}
							>
								<Plus class="size-3" />
								取引先を追加
							</button>
						{/if}
					</div>
					<Select.Root type="single" value={invoice.vendorId} onValueChange={onVendorChange}>
						<Select.Trigger>
							{selectedVendor?.name ||
								(vendors.length === 0 ? '取引先が未登録です' : '選択してください')}
						</Select.Trigger>
						<Select.Content>
							{#each vendors as vendor (vendor.id)}
								<Select.Item value={vendor.id}>{vendor.name}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
					{#if vendors.length === 0}
						<p class="text-xs text-muted-foreground">
							取引先がまだ登録されていません。「取引先を追加」から作成すると、この請求書に戻って設定できます。
						</p>
					{/if}
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

			<!-- 適格請求書バリデーション警告 -->
			{#if qualifiedInvoiceWarnings.length > 0}
				<div
					class="rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950"
				>
					<div class="flex items-start gap-3">
						<Info class="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
						<div class="space-y-1">
							<p class="text-sm font-medium text-amber-800 dark:text-amber-200">
								適格請求書の記載要件を満たしていない項目があります
							</p>
							<ul
								class="list-inside list-disc space-y-0.5 text-sm text-amber-700 dark:text-amber-300"
							>
								{#each qualifiedInvoiceWarnings as warning (warning.type)}
									<li>{warning.message}</li>
								{/each}
							</ul>
						</div>
					</div>
				</div>
			{/if}

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
	vendor={selectedVendor ?? null}
	{settlement}
	onsave={handleJournalSave}
/>

<!-- ステータスを戻す確認ダイアログ -->
<AlertDialog.Root bind:open={revertDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>
				ステータスを「{previousStatus ? InvoiceStatusLabels[previousStatus] : ''}」に戻しますか？
			</AlertDialog.Title>
			<AlertDialog.Description>
				<span class="block">
					現在のステータス「{InvoiceStatusLabels[invoice.status]}」を 1 段階前に戻します。
				</span>
				<span class="mt-2 block">
					この請求書に紐づく仕訳（売掛金仕訳・入金仕訳）は削除されません。
					仕訳も取り消す場合は、仕訳帳で該当の仕訳を削除してください。
				</span>
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel disabled={isSaving}>キャンセル</AlertDialog.Cancel>
			<AlertDialog.Action disabled={isSaving} onclick={revertStatus}>戻す</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<!-- 印刷用コンポーネント -->
<div class="hidden print:block">
	<InvoicePrint invoice={printableInvoice} vendor={selectedVendor ?? null} {businessInfo} />
</div>
