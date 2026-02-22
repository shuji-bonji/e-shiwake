<script lang="ts">
	import { onMount } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import * as Select from '$lib/components/ui/select';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Separator } from '$lib/components/ui/separator';
	import { toast } from 'svelte-sonner';
	import { FileText, Printer, FileArchive, Loader2 } from '@lucide/svelte';
	import {
		initializeDatabase,
		getJournalsByYear,
		getAllAccounts,
		getAvailableYears as getAvailableYearsFromDB
	} from '$lib/db';
	import { getSelectedYear } from '$lib/stores/fiscalYear.svelte';
	import type { Account, JournalEntry } from '$lib/types';
	import JSZip from 'jszip';
	import {
		generateJournalHTML,
		generateLedgerHTML,
		generateTrialBalanceHTML,
		generateProfitLossHTML,
		generateBalanceSheetHTML,
		generateTaxSummaryHTML,
		getPrintStyles,
		generateJournalCSV,
		generateLedgerCSV,
		generateTrialBalanceCSV,
		generateProfitLossCSV,
		generateBalanceSheetCSV,
		generateTaxSummaryCSV
	} from '$lib/utils/report-html';

	let isLoading = $state(true);
	let isPrinting = $state(false);
	let isExporting = $state(false);

	let accounts = $state<Account[]>([]);
	let journals = $state<JournalEntry[]>([]);

	// サイドバーで選択中の年度を初期値として使用
	let selectedYear = $state(getSelectedYear());
	let availableYears = $state<number[]>([]);

	// 出力対象の選択
	let selectedReports = $state({
		journal: true, // 仕訳帳
		ledger: true, // 総勘定元帳
		trialBalance: true, // 試算表
		profitLoss: true, // 損益計算書
		balanceSheet: true, // 貸借対照表
		taxSummary: false // 消費税集計表（課税事業者向け）
	});

	// 総勘定元帳の出力オプション
	let ledgerOption = $state<'all' | 'used'>('used'); // all: 全科目, used: 使用科目のみ

	onMount(async () => {
		await initializeDatabase();
		accounts = await getAllAccounts();
		availableYears = await getAvailableYearsFromDB();
		if (!availableYears.includes(selectedYear) && availableYears.length > 0) {
			selectedYear = availableYears[0];
		}
		await loadData();
		isLoading = false;
	});

	async function loadData() {
		journals = await getJournalsByYear(selectedYear);
	}

	async function handleYearChange(year: string) {
		selectedYear = parseInt(year, 10);
		await loadData();
	}

	// 選択された帳簿の数
	const selectedCount = $derived(Object.values(selectedReports).filter(Boolean).length);

	// ========================================
	// 印刷実行
	// ========================================

	async function handlePrint() {
		if (selectedCount === 0) return;
		isPrinting = true;

		try {
			let content = '';

			if (selectedReports.journal) {
				content += generateJournalHTML(journals, accounts, selectedYear);
			}
			if (selectedReports.ledger) {
				content += generateLedgerHTML(journals, accounts, selectedYear, ledgerOption);
			}
			if (selectedReports.trialBalance) {
				content += generateTrialBalanceHTML(journals, accounts, selectedYear);
			}
			if (selectedReports.profitLoss) {
				content += generateProfitLossHTML(journals, accounts, selectedYear);
			}
			if (selectedReports.balanceSheet) {
				content += generateBalanceSheetHTML(journals, accounts, selectedYear);
			}
			if (selectedReports.taxSummary) {
				content += generateTaxSummaryHTML(journals, selectedYear);
			}

			const printWindow = window.open('', '_blank');
			if (!printWindow) {
				toast.error('ポップアップがブロックされました。ポップアップを許可してください。');
				return;
			}

			printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>帳簿出力 - ${selectedYear}年度</title>
          ${getPrintStyles()}
        </head>
        <body>
          ${content}
        </body>
        </html>
      `);

			printWindow.document.close();
			printWindow.focus();

			// 少し待ってから印刷ダイアログを開く
			setTimeout(() => {
				printWindow.print();
			}, 500);
		} finally {
			isPrinting = false;
		}
	}

	// ========================================
	// CSV 一括エクスポート（ZIP）
	// ========================================

	async function handleExportCSV() {
		if (selectedCount === 0) return;
		isExporting = true;

		try {
			const zip = new JSZip();

			if (selectedReports.journal) {
				zip.file(`仕訳帳_${selectedYear}.csv`, generateJournalCSV(journals, accounts));
			}
			if (selectedReports.ledger) {
				zip.file(
					`総勘定元帳_${selectedYear}.csv`,
					generateLedgerCSV(journals, accounts, ledgerOption)
				);
			}
			if (selectedReports.trialBalance) {
				zip.file(`試算表_${selectedYear}.csv`, generateTrialBalanceCSV(journals, accounts));
			}
			if (selectedReports.profitLoss) {
				zip.file(
					`損益計算書_${selectedYear}.csv`,
					generateProfitLossCSV(journals, accounts, selectedYear)
				);
			}
			if (selectedReports.balanceSheet) {
				zip.file(
					`貸借対照表_${selectedYear}.csv`,
					generateBalanceSheetCSV(journals, accounts, selectedYear)
				);
			}
			if (selectedReports.taxSummary) {
				zip.file(`消費税集計表_${selectedYear}.csv`, generateTaxSummaryCSV(journals, selectedYear));
			}

			const blob = await zip.generateAsync({ type: 'blob' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `帳簿_${selectedYear}.zip`;
			a.click();
			URL.revokeObjectURL(url);
		} finally {
			isExporting = false;
		}
	}

	// 全選択/全解除
	function selectAll() {
		selectedReports = {
			journal: true,
			ledger: true,
			trialBalance: true,
			profitLoss: true,
			balanceSheet: true,
			taxSummary: true
		};
	}

	function deselectAll() {
		selectedReports = {
			journal: false,
			ledger: false,
			trialBalance: false,
			profitLoss: false,
			balanceSheet: false,
			taxSummary: false
		};
	}
</script>

<div class="container mx-auto max-w-3xl space-y-6 px-4 pb-4">
	<div
		class="sticky top-14 z-10 -mx-4 flex items-center justify-between border-b bg-background px-4 pt-4 pb-3 group-has-data-[collapsible=icon]/sidebar-wrapper:top-12"
	>
		<h1 class="flex items-center gap-2 text-2xl font-bold">
			<FileText class="size-6" />
			帳簿出力
		</h1>

		<Select.Root
			type="single"
			value={selectedYear.toString()}
			onValueChange={(v) => v && handleYearChange(v)}
		>
			<Select.Trigger class="w-32">
				{selectedYear}年度
			</Select.Trigger>
			<Select.Content>
				{#each availableYears as year (year)}
					<Select.Item value={year.toString()}>{year}年度</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	</div>

	{#if isLoading}
		<div class="flex h-64 items-center justify-center">
			<p class="text-muted-foreground">読み込み中...</p>
		</div>
	{:else}
		<Card.Root>
			<Card.Header>
				<Card.Title>出力する帳簿を選択</Card.Title>
				<Card.Description>
					各種帳簿の印刷・PDF保存はこのページから行います。確定申告や税理士提出用に、複数の帳簿を一括で出力できます。
				</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<!-- 全選択/全解除 -->
				<div class="flex gap-2">
					<Button variant="outline" size="sm" onclick={selectAll}>全て選択</Button>
					<Button variant="outline" size="sm" onclick={deselectAll}>全て解除</Button>
				</div>

				<Separator />

				<!-- 帳簿チェックボックス -->
				<div class="space-y-3">
					<div class="flex items-center space-x-3">
						<Checkbox id="journal" bind:checked={selectedReports.journal} />
						<Label for="journal" class="cursor-pointer font-normal">
							仕訳帳
							<span class="ml-2 text-sm text-muted-foreground">
								（{journals.length}件）
							</span>
						</Label>
					</div>

					<div class="flex items-center space-x-3">
						<Checkbox id="ledger" bind:checked={selectedReports.ledger} />
						<Label for="ledger" class="cursor-pointer font-normal">総勘定元帳</Label>
						{#if selectedReports.ledger}
							<Select.Root
								type="single"
								value={ledgerOption}
								onValueChange={(v) => v && (ledgerOption = v as 'all' | 'used')}
							>
								<Select.Trigger class="h-8 w-40 text-sm">
									{ledgerOption === 'used' ? '使用科目のみ' : '全科目'}
								</Select.Trigger>
								<Select.Content>
									<Select.Item value="used">使用科目のみ</Select.Item>
									<Select.Item value="all">全科目</Select.Item>
								</Select.Content>
							</Select.Root>
						{/if}
					</div>

					<div class="flex items-center space-x-3">
						<Checkbox id="trialBalance" bind:checked={selectedReports.trialBalance} />
						<Label for="trialBalance" class="cursor-pointer font-normal">試算表</Label>
					</div>

					<Separator />

					<div class="flex items-center space-x-3">
						<Checkbox id="profitLoss" bind:checked={selectedReports.profitLoss} />
						<Label for="profitLoss" class="cursor-pointer font-normal">損益計算書</Label>
					</div>

					<div class="flex items-center space-x-3">
						<Checkbox id="balanceSheet" bind:checked={selectedReports.balanceSheet} />
						<Label for="balanceSheet" class="cursor-pointer font-normal">貸借対照表</Label>
					</div>

					<Separator />

					<div class="flex items-center space-x-3">
						<Checkbox id="taxSummary" bind:checked={selectedReports.taxSummary} />
						<Label for="taxSummary" class="cursor-pointer font-normal">
							消費税集計表
							<span class="ml-2 text-sm text-muted-foreground"> （課税事業者向け） </span>
						</Label>
					</div>
				</div>
			</Card.Content>
			<Card.Footer class="flex justify-between">
				<p class="text-sm text-muted-foreground">
					{selectedCount}件選択中
				</p>
				<div class="flex gap-2">
					<Button
						variant="outline"
						onclick={handleExportCSV}
						disabled={selectedCount === 0 || isExporting}
					>
						{#if isExporting}
							<Loader2 class="mr-2 size-4 animate-spin" />
						{:else}
							<FileArchive class="mr-2 size-4" />
						{/if}
						CSV一括ダウンロード
					</Button>
					<Button onclick={handlePrint} disabled={selectedCount === 0 || isPrinting}>
						{#if isPrinting}
							<Loader2 class="mr-2 size-4 animate-spin" />
						{:else}
							<Printer class="mr-2 size-4" />
						{/if}
						一括印刷
					</Button>
				</div>
			</Card.Footer>
		</Card.Root>

		<!-- 使い方の説明 -->
		<Card.Root>
			<Card.Header>
				<Card.Title class="text-base">使い方</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-2 text-sm text-muted-foreground">
				<p>
					<strong>一括印刷:</strong> 選択した帳簿をまとめて印刷します。印刷ダイアログで「PDFとして保存」を選ぶと、1つのPDFファイルに全帳簿を含めることができます。
				</p>
				<p>
					<strong>CSV一括ダウンロード:</strong> 選択した帳簿をCSVファイルとしてZIPにまとめてダウンロードします。ExcelやGoogleスプレッドシートで開けます。
				</p>
				<p class="pt-2 text-xs">
					※
					各帳簿ページ（仕訳帳、試算表など）からはCSV出力のみ可能です。印刷・PDF保存はこのページから行ってください。
				</p>
			</Card.Content>
		</Card.Root>
	{/if}
</div>
