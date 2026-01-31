<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Download, Settings2, Printer, AlertCircle, ExternalLink } from '@lucide/svelte';
	import type {
		BlueReturnData,
		BusinessInfo,
		FixedAsset,
		AccountType
	} from '$lib/types/blue-return-types';
	import { AccountTypeLabels } from '$lib/types/blue-return-types';
	import type { JournalEntry, Account, ProfitLossData, BalanceSheetData } from '$lib/types';
	import {
		initializeDatabase,
		getJournalsByYear,
		getAllAccounts,
		getActiveFixedAssets,
		getSetting,
		setSetting
	} from '$lib/db';
	import { useFiscalYear } from '$lib/stores/fiscalYear.svelte.js';
	import { generateProfitLoss } from '$lib/utils/profit-loss';
	import { generateBalanceSheet } from '$lib/utils/balance-sheet';
	import {
		generateBlueReturnData,
		blueReturnSummaryToCsv,
		validateBlueReturnData,
		formatAmount
	} from '$lib/utils/blue-return';

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
		// 事業者情報を読み込み
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
				// 貸借対照表に当期純利益を渡す
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

		// 事業者情報がない場合はデフォルト値
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
				beginningBalanceSheet: null, // 期首残高（将来対応）
				inventoryStart,
				inventoryEnd,
				specialDeduction,
				blueReturnDeduction
			}
		);

		validationErrors = validateBlueReturnData(blueReturnData);
	}

	// 設定を保存
	async function handleSettingsSave() {
		try {
			const snapshot = $state.snapshot(businessInfo);
			const plainBusinessInfo = JSON.parse(JSON.stringify(snapshot)) as BusinessInfo;
			await setSetting('businessInfo', plainBusinessInfo);
			generateBlueReturn();
			settingsDialogOpen = false;
		} catch (e) {
			console.error('businessInfo保存エラー:', e);
		}
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
	<div class="flex flex-wrap items-center justify-between gap-4 print:hidden">
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
			<!-- 1ページ目: 損益計算書 -->
			<div class="print-section space-y-6 {activeTab !== 'page1' ? 'hidden print:block' : ''}">
				<h2 class="border-b pb-2 text-lg font-bold">損益計算書</h2>

				<!-- 売上 -->
				<div class="space-y-2">
					<h3 class="font-medium text-muted-foreground">売上（収入）金額</h3>
					<div class="grid grid-cols-2 gap-4 pl-4">
						<div>売上（収入）金額</div>
						<div class="text-right font-mono">{formatAmount(blueReturnData.page1.salesTotal)}</div>
					</div>
				</div>

				<!-- 売上原価 -->
				<div class="space-y-2">
					<h3 class="font-medium text-muted-foreground">売上原価</h3>
					<div class="grid grid-cols-2 gap-4 pl-4 text-sm">
						<div>期首商品棚卸高</div>
						<div class="text-right font-mono">
							{formatAmount(blueReturnData.page1.inventoryStart)}
						</div>
						<div>仕入金額</div>
						<div class="text-right font-mono">{formatAmount(blueReturnData.page1.purchases)}</div>
						<div>期末商品棚卸高</div>
						<div class="text-right font-mono">
							{formatAmount(blueReturnData.page1.inventoryEnd)}
						</div>
						<div class="font-medium">差引原価</div>
						<div class="text-right font-mono font-medium">
							{formatAmount(blueReturnData.page1.costOfSales)}
						</div>
					</div>
				</div>

				<!-- 差引金額 -->
				<div class="grid grid-cols-2 gap-4 rounded-md bg-muted/50 p-3">
					<div class="font-medium">差引金額（売上総利益）</div>
					<div class="text-right font-mono font-medium">
						{formatAmount(blueReturnData.page1.grossProfit)}
					</div>
				</div>

				<!-- 経費 -->
				<div class="space-y-2">
					<h3 class="font-medium text-muted-foreground">経費</h3>
					<div class="grid grid-cols-2 gap-2 pl-4 text-sm">
						{#each blueReturnData.page1.expenses as expense (expense.code)}
							<div>{expense.name}</div>
							<div class="text-right font-mono">{formatAmount(expense.amount)}</div>
						{/each}
					</div>
					<div class="grid grid-cols-2 gap-4 border-t pt-2 pl-4">
						<div class="font-medium">経費合計</div>
						<div class="text-right font-mono font-medium">
							{formatAmount(blueReturnData.page1.expensesTotal)}
						</div>
					</div>
				</div>

				<!-- 差引金額 -->
				<div class="grid grid-cols-2 gap-4 rounded-md bg-muted/50 p-3">
					<div class="font-medium">差引金額</div>
					<div class="text-right font-mono font-medium">
						{formatAmount(blueReturnData.page1.operatingProfit)}
					</div>
				</div>

				<!-- 所得金額 -->
				<div class="space-y-2">
					<h3 class="font-medium text-muted-foreground">所得金額の計算</h3>
					<div class="grid grid-cols-2 gap-4 pl-4 text-sm">
						<div>専従者給与</div>
						<div class="text-right font-mono">
							{formatAmount(blueReturnData.page1.specialDeduction)}
						</div>
						<div>青色申告特別控除前の所得金額</div>
						<div class="text-right font-mono">
							{formatAmount(blueReturnData.page1.netIncomeBeforeDeduction)}
						</div>
						<div>青色申告特別控除額</div>
						<div class="text-right font-mono">
							{formatAmount(blueReturnData.page1.blueReturnDeduction)}
						</div>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-4 rounded-md bg-primary/10 p-4">
					<div class="text-lg font-bold">所得金額</div>
					<div class="text-right font-mono text-lg font-bold">
						{formatAmount(blueReturnData.page1.businessIncome)}
					</div>
				</div>
			</div>

			<!-- 2ページ目: 月別売上・経費 -->
			<div class="print-section space-y-6 {activeTab !== 'page2' ? 'hidden print:block' : ''}">
				<h2 class="border-b pb-2 text-lg font-bold">月別売上（収入）金額及び仕入金額</h2>

				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b bg-muted/50">
								<th class="px-3 py-2 text-left">月</th>
								<th class="px-3 py-2 text-right">売上（収入）金額</th>
								<th class="px-3 py-2 text-right">仕入金額</th>
							</tr>
						</thead>
						<tbody>
							{#each blueReturnData.page2.monthlySales as monthly (monthly.month)}
								<tr class="border-b">
									<td class="px-3 py-2">{monthly.month}月</td>
									<td class="px-3 py-2 text-right font-mono">{formatAmount(monthly.sales)}</td>
									<td class="px-3 py-2 text-right font-mono">{formatAmount(monthly.purchases)}</td>
								</tr>
							{/each}
						</tbody>
						<tfoot class="bg-muted/30">
							<tr>
								<td class="px-3 py-2 font-medium">合計</td>
								<td class="px-3 py-2 text-right font-mono font-medium"
									>{formatAmount(blueReturnData.page2.monthlySalesTotal)}</td
								>
								<td class="px-3 py-2 text-right font-mono font-medium"
									>{formatAmount(blueReturnData.page2.monthlyPurchasesTotal)}</td
								>
							</tr>
						</tfoot>
					</table>
				</div>

				<div class="grid grid-cols-2 gap-4 text-sm">
					<div>雑収入</div>
					<div class="text-right font-mono">{formatAmount(blueReturnData.page2.miscIncome)}</div>
					<div>給料賃金</div>
					<div class="text-right font-mono">{formatAmount(blueReturnData.page2.salaryTotal)}</div>
					<div>地代家賃</div>
					<div class="text-right font-mono">{formatAmount(blueReturnData.page2.rentTotal)}</div>
				</div>
			</div>

			<!-- 3ページ目: 減価償却 -->
			<div class="print-section space-y-6 {activeTab !== 'page3' ? 'hidden print:block' : ''}">
				<h2 class="border-b pb-2 text-lg font-bold">減価償却費の計算</h2>

				{#if blueReturnData.page3.assets.length === 0}
					<p class="py-8 text-center text-muted-foreground">減価償却資産がありません</p>
				{:else}
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead>
								<tr class="border-b bg-muted/50">
									<th class="px-2 py-2 text-left">資産の名称</th>
									<th class="px-2 py-2 text-left">取得年月</th>
									<th class="px-2 py-2 text-right">取得価額</th>
									<th class="px-2 py-2 text-center">耐用年数</th>
									<th class="px-2 py-2 text-center">償却率</th>
									<th class="px-2 py-2 text-right">本年分の償却費</th>
									<th class="px-2 py-2 text-right">必要経費算入額</th>
									<th class="px-2 py-2 text-right">期末帳簿価額</th>
								</tr>
							</thead>
							<tbody>
								{#each blueReturnData.page3.assets as asset (asset.assetName)}
									<tr class="border-b">
										<td class="px-2 py-2">{asset.assetName}</td>
										<td class="px-2 py-2">{asset.acquisitionDate}</td>
										<td class="px-2 py-2 text-right font-mono"
											>{formatAmount(asset.acquisitionCost)}</td
										>
										<td class="px-2 py-2 text-center">{asset.usefulLife}</td>
										<td class="px-2 py-2 text-center">{asset.depreciationRate}</td>
										<td class="px-2 py-2 text-right font-mono"
											>{formatAmount(asset.currentYearDepreciation)}</td
										>
										<td class="px-2 py-2 text-right font-mono"
											>{formatAmount(asset.businessDepreciation)}</td
										>
										<td class="px-2 py-2 text-right font-mono">{formatAmount(asset.bookValue)}</td>
									</tr>
								{/each}
							</tbody>
							<tfoot class="bg-muted/30">
								<tr>
									<td colspan="5" class="px-2 py-2 text-right font-medium">合計</td>
									<td class="px-2 py-2 text-right font-mono font-medium"
										>{formatAmount(blueReturnData.page3.totalDepreciation)}</td
									>
									<td class="px-2 py-2 text-right font-mono font-medium"
										>{formatAmount(blueReturnData.page3.totalBusinessDepreciation)}</td
									>
									<td></td>
								</tr>
							</tfoot>
						</table>
					</div>
				{/if}
			</div>

			<!-- 4ページ目: 貸借対照表 -->
			<div class="print-section space-y-6 {activeTab !== 'page4' ? 'hidden print:block' : ''}">
				<h2 class="border-b pb-2 text-lg font-bold">貸借対照表</h2>

				<div
					class="balance-sheet-container grid grid-cols-1 gap-8 md:grid-cols-2 print:grid-cols-2 print:gap-4"
				>
					<!-- 資産の部 -->
					<section class="assets-section">
						<table class="w-full text-sm">
							<thead>
								<tr class="border-b-2 border-foreground bg-muted/50 print:bg-gray-100">
									<th colspan="3" class="px-2 py-1.5 text-center font-bold">資産の部</th>
								</tr>
								<tr class="border-b bg-muted/30 text-xs print:bg-gray-50">
									<th class="w-1/2 px-2 py-1 text-left">科目</th>
									<th class="w-1/4 px-2 py-1 text-right">期首</th>
									<th class="w-1/4 px-2 py-1 text-right">期末</th>
								</tr>
							</thead>
							<tbody>
								<!-- 流動資産 -->
								{#each blueReturnData.page4.assets.current as asset (asset.accountCode)}
									<tr class="border-b border-muted">
										<td class="px-2 py-0.5">{asset.accountName}</td>
										<td class="px-2 py-0.5 text-right font-mono text-muted-foreground">
											{formatAmount(asset.beginningBalance)}
										</td>
										<td class="px-2 py-0.5 text-right font-mono">
											{formatAmount(asset.endingBalance)}
										</td>
									</tr>
								{/each}
								<!-- 固定資産 -->
								{#each blueReturnData.page4.assets.fixed as asset (asset.accountCode)}
									<tr class="border-b border-muted">
										<td class="px-2 py-0.5">{asset.accountName}</td>
										<td class="px-2 py-0.5 text-right font-mono text-muted-foreground">
											{formatAmount(asset.beginningBalance)}
										</td>
										<td class="px-2 py-0.5 text-right font-mono">
											{formatAmount(asset.endingBalance)}
										</td>
									</tr>
								{/each}
								<!-- 事業主貸 -->
								<tr class="border-b border-muted">
									<td class="px-2 py-0.5">事業主貸</td>
									<td class="px-2 py-0.5 text-right font-mono text-muted-foreground">0</td>
									<td class="px-2 py-0.5 text-right font-mono">
										{formatAmount(blueReturnData.page4.assets.ownerWithdrawal)}
									</td>
								</tr>
							</tbody>
							<tfoot>
								<tr class="border-t-2 border-foreground bg-muted/30 font-bold print:bg-gray-100">
									<td class="px-2 py-1">合計</td>
									<td class="px-2 py-1 text-right font-mono">
										{formatAmount(blueReturnData.page4.assets.totalBeginning)}
									</td>
									<td class="px-2 py-1 text-right font-mono">
										{formatAmount(blueReturnData.page4.assets.totalEnding)}
									</td>
								</tr>
							</tfoot>
						</table>
					</section>

					<!-- 負債・資本の部 -->
					<section class="liabilities-equity-section">
						<table class="w-full text-sm">
							<thead>
								<tr class="border-b-2 border-foreground bg-muted/50 print:bg-gray-100">
									<th colspan="3" class="px-2 py-1.5 text-center font-bold">負債・資本の部</th>
								</tr>
								<tr class="border-b bg-muted/30 text-xs print:bg-gray-50">
									<th class="w-1/2 px-2 py-1 text-left">科目</th>
									<th class="w-1/4 px-2 py-1 text-right">期首</th>
									<th class="w-1/4 px-2 py-1 text-right">期末</th>
								</tr>
							</thead>
							<tbody>
								<!-- 負債 -->
								{#each [...blueReturnData.page4.liabilities.current, ...blueReturnData.page4.liabilities.fixed] as liability (liability.accountCode)}
									<tr class="border-b border-muted">
										<td class="px-2 py-0.5">{liability.accountName}</td>
										<td class="px-2 py-0.5 text-right font-mono text-muted-foreground">
											{formatAmount(liability.beginningBalance)}
										</td>
										<td class="px-2 py-0.5 text-right font-mono">
											{formatAmount(liability.endingBalance)}
										</td>
									</tr>
								{/each}
								<!-- 事業主借 -->
								<tr class="border-b border-muted">
									<td class="px-2 py-0.5">事業主借</td>
									<td class="px-2 py-0.5 text-right font-mono text-muted-foreground">0</td>
									<td class="px-2 py-0.5 text-right font-mono">
										{formatAmount(blueReturnData.page4.equity.ownerDeposit)}
									</td>
								</tr>
								<!-- 元入金 -->
								<tr class="border-b border-muted">
									<td class="px-2 py-0.5">元入金</td>
									<td class="px-2 py-0.5 text-right font-mono text-muted-foreground">
										{formatAmount(blueReturnData.page4.equity.capital)}
									</td>
									<td class="px-2 py-0.5 text-right font-mono">
										{formatAmount(blueReturnData.page4.equity.capitalEnding)}
									</td>
								</tr>
								<!-- 青色申告特別控除前の所得金額（短縮表示） -->
								<tr class="border-b border-muted">
									<td class="px-2 py-0.5 text-xs whitespace-nowrap print:text-[8pt]"
										>控除前所得金額</td
									>
									<td class="px-2 py-0.5 text-right font-mono text-muted-foreground"></td>
									<td class="px-2 py-0.5 text-right font-mono">
										{formatAmount(blueReturnData.page4.equity.netIncome)}
									</td>
								</tr>
							</tbody>
							<tfoot>
								<tr class="border-t-2 border-foreground bg-muted/30 font-bold print:bg-gray-100">
									<td class="px-2 py-1">合計</td>
									<td class="px-2 py-1 text-right font-mono">
										{formatAmount(
											blueReturnData.page4.liabilities.totalBeginning +
												blueReturnData.page4.equity.capital
										)}
									</td>
									<td class="px-2 py-1 text-right font-mono">
										{formatAmount(
											blueReturnData.page4.liabilities.totalEnding +
												blueReturnData.page4.equity.ownerDeposit +
												blueReturnData.page4.equity.capitalEnding +
												blueReturnData.page4.equity.netIncome
										)}
									</td>
								</tr>
							</tfoot>
						</table>
					</section>
				</div>

				<!-- 貸借バランス確認 -->
				<div
					class="rounded-md p-4 print:mt-4 print:rounded-none print:border print:p-2 {blueReturnData
						.page4.isBalanced
						? 'bg-green-50 dark:bg-green-950 print:border-green-500'
						: 'bg-red-50 dark:bg-red-950 print:border-red-500'}"
				>
					<p
						class="text-sm font-medium print:text-center {blueReturnData.page4.isBalanced
							? 'text-green-800 dark:text-green-200'
							: 'text-red-800 dark:text-red-200'}"
					>
						{blueReturnData.page4.isBalanced
							? '貸借バランス: 一致'
							: '貸借バランス: 不一致（確認が必要です）'}
					</p>
				</div>
			</div>
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
<Dialog.Root bind:open={settingsDialogOpen}>
	<Dialog.Content class="max-h-[90vh] overflow-y-auto sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>青色申告決算書の設定</Dialog.Title>
			<Dialog.Description>事業者情報と控除額を設定します</Dialog.Description>
		</Dialog.Header>
		<form
			class="space-y-6"
			onsubmit={(e) => {
				e.preventDefault();
				handleSettingsSave();
			}}
		>
			<!-- 事業者情報 -->
			<div class="space-y-4">
				<h3 class="font-medium">事業者情報</h3>
				<div class="grid gap-4 pl-2">
					<div class="space-y-2">
						<Label for="name">氏名</Label>
						<Input id="name" bind:value={businessInfo.name} placeholder="山田 太郎" />
					</div>
					<div class="space-y-2">
						<Label for="tradeName">屋号（任意）</Label>
						<Input id="tradeName" bind:value={businessInfo.tradeName} placeholder="山田商店" />
					</div>
					<div class="space-y-2">
						<Label for="address">住所</Label>
						<Input id="address" bind:value={businessInfo.address} placeholder="東京都..." />
					</div>
					<div class="space-y-2">
						<Label for="businessType">事業の種類</Label>
						<Input
							id="businessType"
							bind:value={businessInfo.businessType}
							placeholder="例: システム開発業"
						/>
					</div>
					<div class="grid grid-cols-2 gap-4">
						<div class="space-y-2">
							<Label for="phoneNumber">電話番号（任意）</Label>
							<Input
								id="phoneNumber"
								bind:value={businessInfo.phoneNumber}
								placeholder="03-1234-5678"
							/>
						</div>
						<div class="space-y-2">
							<Label for="email">メールアドレス（任意）</Label>
							<Input
								id="email"
								type="email"
								bind:value={businessInfo.email}
								placeholder="info@example.com"
							/>
						</div>
					</div>
					<div class="space-y-2">
						<Label for="invoiceRegistrationNumber">インボイス登録番号（任意）</Label>
						<Input
							id="invoiceRegistrationNumber"
							bind:value={businessInfo.invoiceRegistrationNumber}
							placeholder="T1234567890123"
						/>
					</div>
				</div>
			</div>

			<!-- 振込先情報（請求書用） -->
			<div class="space-y-4">
				<h3 class="font-medium">振込先情報（請求書用・任意）</h3>
				<div class="grid gap-4 pl-2">
					<div class="grid grid-cols-2 gap-4">
						<div class="space-y-2">
							<Label for="bankName">銀行名</Label>
							<Input id="bankName" bind:value={businessInfo.bankName} placeholder="○○銀行" />
						</div>
						<div class="space-y-2">
							<Label for="branchName">支店名</Label>
							<Input id="branchName" bind:value={businessInfo.branchName} placeholder="○○支店" />
						</div>
					</div>
					<div class="grid grid-cols-2 gap-4">
						<div class="space-y-2">
							<Label for="accountType">口座種別</Label>
							<Select.Root
								type="single"
								value={businessInfo.accountType || 'ordinary'}
								onValueChange={(v) => v && (businessInfo.accountType = v as AccountType)}
							>
								<Select.Trigger class="w-full">
									{businessInfo.accountType ? AccountTypeLabels[businessInfo.accountType] : '普通'}
								</Select.Trigger>
								<Select.Content>
									<Select.Item value="ordinary">普通</Select.Item>
									<Select.Item value="current">当座</Select.Item>
								</Select.Content>
							</Select.Root>
						</div>
						<div class="space-y-2">
							<Label for="accountNumber">口座番号</Label>
							<Input
								id="accountNumber"
								bind:value={businessInfo.accountNumber}
								placeholder="1234567"
							/>
						</div>
					</div>
					<div class="space-y-2">
						<Label for="accountHolder">口座名義</Label>
						<Input
							id="accountHolder"
							bind:value={businessInfo.accountHolder}
							placeholder="ヤマダ タロウ"
						/>
					</div>
				</div>
			</div>

			<!-- 青色申告特別控除 -->
			<div class="space-y-4">
				<h3 class="font-medium">青色申告特別控除</h3>
				<div class="pl-2">
					<Select.Root
						type="single"
						value={blueReturnDeduction.toString()}
						onValueChange={(v) => v && (blueReturnDeduction = parseInt(v) as 65 | 55 | 10)}
					>
						<Select.Trigger class="w-full">
							{blueReturnDeduction}万円
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="65">65万円（e-Tax + 複式簿記）</Select.Item>
							<Select.Item value="55">55万円（紙提出 + 複式簿記）</Select.Item>
							<Select.Item value="10">10万円（簡易簿記）</Select.Item>
						</Select.Content>
					</Select.Root>
				</div>
			</div>

			<!-- 棚卸資産 -->
			<div class="space-y-4">
				<h3 class="font-medium">棚卸資産（商品・製品がある場合）</h3>
				<div class="grid grid-cols-2 gap-4 pl-2">
					<div class="space-y-2">
						<Label for="inventoryStart">期首棚卸高</Label>
						<Input id="inventoryStart" type="number" bind:value={inventoryStart} />
					</div>
					<div class="space-y-2">
						<Label for="inventoryEnd">期末棚卸高</Label>
						<Input id="inventoryEnd" type="number" bind:value={inventoryEnd} />
					</div>
				</div>
			</div>

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (settingsDialogOpen = false)}>
					キャンセル
				</Button>
				<Button type="submit">保存</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<style>
	/* 印刷用スタイル */
	@media print {
		:global(body) {
			print-color-adjust: exact;
			-webkit-print-color-adjust: exact;
		}

		/* 印刷時に全ページセクションを表示 */
		.print-section {
			display: block !important;
			page-break-after: always;
		}

		.print-section:last-child {
			page-break-after: avoid;
		}

		/* テーブルヘッダーをページごとに繰り返す */
		thead {
			display: table-header-group;
		}

		/* 行を途中で分割しない */
		tr {
			page-break-inside: avoid;
		}

		/* 貸借対照表の印刷レイアウト */
		.balance-sheet-container {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 1rem;
			font-size: 9pt;
			page-break-inside: avoid;
		}

		.balance-sheet-container table {
			width: 100%;
			border-collapse: collapse;
		}

		.balance-sheet-container th,
		.balance-sheet-container td {
			padding: 2px 4px;
			border: 1px solid #ccc;
		}

		.balance-sheet-container thead tr:first-child th {
			background-color: #f0f0f0 !important;
			border-bottom: 2px solid #333;
		}

		.balance-sheet-container tfoot td {
			background-color: #f0f0f0 !important;
			border-top: 2px solid #333;
		}
	}

	@page {
		margin: 1.5cm;
		size: A4;
	}
</style>
