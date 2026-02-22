<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Download, Settings2, Printer, AlertCircle, ExternalLink } from '@lucide/svelte';
	import type { BlueReturnData, BusinessInfo, FixedAsset } from '$lib/types/blue-return-types';
	import type { JournalEntry, Account, ProfitLossData, BalanceSheetData } from '$lib/types';
	import {
		initializeDatabase,
		getJournalsByYear,
		getAllAccounts,
		getActiveFixedAssets,
		getSetting
	} from '$lib/db';
	import { useFiscalYear } from '$lib/stores/fiscalYear.svelte.js';
	import { generateProfitLoss } from '$lib/utils/profit-loss';
	import { generateBalanceSheet } from '$lib/utils/balance-sheet';
	import {
		generateBlueReturnData,
		blueReturnSummaryToCsv,
		validateBlueReturnData
	} from '$lib/utils/blue-return';
	import BlueReturnPage1 from '$lib/components/blue-return/BlueReturnPage1.svelte';
	import BlueReturnPage2 from '$lib/components/blue-return/BlueReturnPage2.svelte';
	import BlueReturnPage3 from '$lib/components/blue-return/BlueReturnPage3.svelte';
	import BlueReturnPage4 from '$lib/components/blue-return/BlueReturnPage4.svelte';
	import BlueReturnSettingsDialog from '$lib/components/blue-return/BlueReturnSettingsDialog.svelte';

	// 年度ストア
	const fiscalYear = useFiscalYear();

	// 状態
	let blueReturnData = $state<BlueReturnData | null>(null);
	let isLoading = $state(true);
	let activeTab = $state<'page1' | 'page2' | 'page3' | 'page4'>('page1');
	let validationErrors = $state<string[]>([]);
	let settingsDialogOpen = $state(false);

	// 事業者情報（設定ダイアログで編集）
	let businessInfo = $state<BusinessInfo>({
		name: '',
		tradeName: '',
		address: '',
		businessType: ''
	});

	// オプション設定
	let inventoryStart = $state(0);
	let inventoryEnd = $state(0);
	let specialDeduction = $state(0);
	let blueReturnDeduction = $state<65 | 55 | 10>(65);

	// データ
	let journals = $state<JournalEntry[]>([]);
	let accounts = $state<Account[]>([]);
	let fixedAssets = $state<FixedAsset[]>([]);
	let profitLoss = $state<ProfitLossData | null>(null);
	let balanceSheet = $state<BalanceSheetData | null>(null);

	// 初期化
	onMount(async () => {
		await initializeDatabase();
		const savedBusinessInfo = await getSetting('businessInfo');
		if (savedBusinessInfo) {
			businessInfo = savedBusinessInfo;
		}
		await loadData();
	});

	// 年度が変更されたらデータを再読み込み
	$effect(() => {
		if (fiscalYear.selectedYear) {
			loadData();
		}
	});

	async function loadData() {
		isLoading = true;
		try {
			journals = await getJournalsByYear(fiscalYear.selectedYear);
			accounts = await getAllAccounts();
			fixedAssets = await getActiveFixedAssets();

			if (journals.length > 0 && accounts.length > 0) {
				profitLoss = generateProfitLoss(journals, accounts, fiscalYear.selectedYear);
				balanceSheet = generateBalanceSheet(
					journals,
					accounts,
					fiscalYear.selectedYear,
					profitLoss.netIncome
				);
				generateBlueReturn();
			} else {
				blueReturnData = null;
			}
		} finally {
			isLoading = false;
		}
	}

	function generateBlueReturn() {
		if (!profitLoss || !balanceSheet) return;

		const info = businessInfo.name
			? businessInfo
			: {
					name: '（未設定）',
					tradeName: '',
					address: '（未設定）',
					businessType: '（未設定）'
				};

		blueReturnData = generateBlueReturnData(
			fiscalYear.selectedYear,
			journals,
			accounts,
			profitLoss,
			balanceSheet,
			{
				businessInfo: info,
				fixedAssets,
				beginningBalanceSheet: null,
				inventoryStart,
				inventoryEnd,
				specialDeduction,
				blueReturnDeduction
			}
		);

		validationErrors = validateBlueReturnData(blueReturnData);
	}

	// CSV出力
	function exportToCsv() {
		if (!blueReturnData) return;

		const csv = blueReturnSummaryToCsv(blueReturnData);
		const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `青色申告決算書_${fiscalYear.selectedYear}年.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}

	// 印刷
	function handlePrint() {
		window.print();
	}

	// タブクラス
	function getTabClass(tab: typeof activeTab) {
		const base = 'px-4 py-2 text-sm font-medium rounded-t-lg transition-colors';
		return activeTab === tab
			? `${base} bg-background border border-b-0 text-foreground`
			: `${base} bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted`;
	}
</script>

<div class="space-y-6 print:space-y-4">
	<!-- 印刷用ヘッダー -->
	<div class="hidden print:mb-4 print:block">
		<div class="border-b-2 border-black pb-2">
			<h1 class="text-xl font-bold">青色申告決算書（一般用）</h1>
			<p class="text-sm">
				{fiscalYear.selectedYear}年分（令和{fiscalYear.selectedYear - 2018}年分）
			</p>
		</div>
	</div>

	<!-- 画面表示用ヘッダー -->
	<div
		class="sticky top-14 z-10 -mx-4 flex flex-wrap items-center justify-between gap-4 border-b bg-background px-4 pt-4 pb-3 group-has-data-[collapsible=icon]/sidebar-wrapper:top-12 print:hidden"
	>
		<div>
			<h1 class="text-2xl font-bold">青色申告決算書</h1>
			<p class="text-sm text-muted-foreground">
				{fiscalYear.selectedYear}年分（令和{fiscalYear.selectedYear - 2018}年分）一般用
			</p>
		</div>
		<div class="flex items-center gap-2">
			<Button variant="outline" onclick={() => (settingsDialogOpen = true)}>
				<Settings2 class="mr-2 size-4" />
				設定
			</Button>
			<Button variant="outline" onclick={exportToCsv} disabled={!blueReturnData}>
				<Download class="mr-2 size-4" />
				CSV出力
			</Button>
			<Button variant="outline" onclick={handlePrint} disabled={!blueReturnData}>
				<Printer class="mr-2 size-4" />
				印刷
			</Button>
		</div>
	</div>

	<!-- バリデーションエラー -->
	{#if validationErrors.length > 0}
		<div
			class="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950 print:hidden"
		>
			<div class="flex items-start gap-2">
				<AlertCircle class="size-5 text-amber-600 dark:text-amber-400" />
				<div>
					<p class="font-medium text-amber-800 dark:text-amber-200">確認が必要な項目があります</p>
					<ul class="mt-1 list-inside list-disc text-sm text-amber-700 dark:text-amber-300">
						{#each validationErrors as error, i (i)}
							<li>{error}</li>
						{/each}
					</ul>
				</div>
			</div>
		</div>
	{/if}

	{#if isLoading}
		<div class="flex items-center justify-center py-12">
			<p class="text-muted-foreground">読み込み中...</p>
		</div>
	{:else if !blueReturnData}
		<div
			class="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12"
		>
			<div class="text-center">
				<p class="text-lg font-medium">データがありません</p>
				<p class="text-sm text-muted-foreground">
					{fiscalYear.selectedYear}年度の仕訳データを入力してください
				</p>
			</div>
		</div>
	{:else}
		<!-- タブナビゲーション -->
		<div class="flex gap-1 border-b print:hidden">
			<button class={getTabClass('page1')} onclick={() => (activeTab = 'page1')}>
				1. 損益計算書
			</button>
			<button class={getTabClass('page2')} onclick={() => (activeTab = 'page2')}>
				2. 月別売上・経費
			</button>
			<button class={getTabClass('page3')} onclick={() => (activeTab = 'page3')}>
				3. 減価償却
			</button>
			<button class={getTabClass('page4')} onclick={() => (activeTab = 'page4')}>
				4. 貸借対照表
			</button>
		</div>

		<!-- タブコンテンツ -->
		<div class="rounded-lg border bg-background p-6 print:border-none print:p-0">
			<BlueReturnPage1 data={blueReturnData} active={activeTab === 'page1'} />
			<BlueReturnPage2 data={blueReturnData} active={activeTab === 'page2'} />
			<BlueReturnPage3 data={blueReturnData} active={activeTab === 'page3'} />
			<BlueReturnPage4 data={blueReturnData} active={activeTab === 'page4'} />
		</div>

		<!-- 参考資料リンク -->
		<div class="mt-8 rounded-lg border border-dashed p-4 print:hidden">
			<h3 class="mb-2 text-sm font-medium text-muted-foreground">参考資料</h3>
			<ul class="space-y-1 text-sm">
				<li>
					<a
						href="https://github.com/shuji-bonji/Note-on-bookkeeping/blob/main/blue-tax-return/blue-return-flow.md"
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-1 text-primary hover:underline"
					>
						青色申告の決算フロー
						<ExternalLink class="size-3" />
					</a>
				</li>
				<li>
					<a
						href="https://github.com/shuji-bonji/Note-on-bookkeeping/blob/main/blue-tax-return/tax-return-timeline.md"
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-1 text-primary hover:underline"
					>
						確定申告タイムライン
						<ExternalLink class="size-3" />
					</a>
				</li>
				<li>
					<a
						href="https://github.com/shuji-bonji/Note-on-bookkeeping/blob/main/blue-tax-return/closing-entries.md"
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-1 text-primary hover:underline"
					>
						決算整理仕訳
						<ExternalLink class="size-3" />
					</a>
				</li>
				<li>
					<a
						href="https://github.com/shuji-bonji/Note-on-bookkeeping/blob/main/blue-tax-return/types-of-accounting-books.md"
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-1 text-primary hover:underline"
					>
						青色申告で必要な帳簿
						<ExternalLink class="size-3" />
					</a>
				</li>
			</ul>
		</div>
	{/if}
</div>

<!-- 設定ダイアログ -->
<BlueReturnSettingsDialog
	bind:open={settingsDialogOpen}
	bind:businessInfo
	bind:inventoryStart
	bind:inventoryEnd
	bind:blueReturnDeduction
	onsave={generateBlueReturn}
/>

<style>
	/* 印刷用スタイル */
	@media print {
		:global(body) {
			print-color-adjust: exact;
			-webkit-print-color-adjust: exact;
		}

		/* 印刷時に全ページセクションを表示 */
		:global(.print-section) {
			display: block !important;
			page-break-after: always;
		}

		:global(.print-section:last-child) {
			page-break-after: avoid;
		}

		/* テーブルヘッダーをページごとに繰り返す */
		:global(thead) {
			display: table-header-group;
		}

		/* 行を途中で分割しない */
		:global(tr) {
			page-break-inside: avoid;
		}

		/* 貸借対照表の印刷レイアウト */
		:global(.balance-sheet-container) {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 1rem;
			font-size: 9pt;
			page-break-inside: avoid;
		}

		:global(.balance-sheet-container table) {
			width: 100%;
			border-collapse: collapse;
		}

		:global(.balance-sheet-container th),
		:global(.balance-sheet-container td) {
			padding: 2px 4px;
			border: 1px solid #ccc;
		}

		:global(.balance-sheet-container thead tr:first-child th) {
			background-color: #f0f0f0 !important;
			border-bottom: 2px solid #333;
		}

		:global(.balance-sheet-container tfoot td) {
			background-color: #f0f0f0 !important;
			border-top: 2px solid #333;
		}
	}

	@page {
		margin: 1.5cm;
		size: A4;
	}
</style>
