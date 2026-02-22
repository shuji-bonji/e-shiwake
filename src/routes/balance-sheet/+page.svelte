<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Landmark, Download, Check, AlertTriangle } from '@lucide/svelte';
	import {
		generateBalanceSheet,
		formatBSAmount,
		balanceSheetToCsv
	} from '$lib/utils/balance-sheet';
	import { generateProfitLoss } from '$lib/utils/profit-loss';
	import { useJournalPage } from '$lib/hooks/use-journal-page.svelte';
	import type { BalanceSheetData, BalanceSheetRow } from '$lib/types';

	const page = useJournalPage();

	const balanceSheet = $derived.by<BalanceSheetData | null>(() => {
		if (page.journals.length === 0 || page.accounts.length === 0) return null;
		const profitLoss = generateProfitLoss(
			page.journals,
			page.accounts,
			page.fiscalYear.selectedYear
		);
		return generateBalanceSheet(
			page.journals,
			page.accounts,
			page.fiscalYear.selectedYear,
			profitLoss.netIncome
		);
	});

	function exportCSV() {
		if (!balanceSheet) return;

		const csvContent = '\uFEFF' + balanceSheetToCsv(balanceSheet);
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `貸借対照表_${page.fiscalYear.selectedYear}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}

	// 貸借バランスが一致しているか
	const isBalanced = $derived(
		balanceSheet ? balanceSheet.totalAssets === balanceSheet.totalLiabilitiesAndEquity : false
	);
</script>

<div class="space-y-6">
	<div
		class="sticky top-14 z-10 -mx-4 flex items-center justify-between border-b bg-background px-4 pt-4 pb-3 group-has-data-[collapsible=icon]/sidebar-wrapper:top-12"
	>
		<h1 class="flex items-center gap-2 text-2xl font-bold">
			<Landmark class="size-6" />
			貸借対照表
		</h1>

		<div class="flex items-center gap-2">
			<Select.Root
				type="single"
				value={page.fiscalYear.selectedYear.toString()}
				onValueChange={(v) => v && page.handleYearChange(parseInt(v))}
			>
				<Select.Trigger class="w-32">
					{page.fiscalYear.selectedYear}年度
				</Select.Trigger>
				<Select.Content>
					{#each page.fiscalYear.availableYears as year (year)}
						<Select.Item value={year.toString()}>{year}年度</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>

			<Button variant="outline" onclick={exportCSV} disabled={!balanceSheet}>
				<Download class="mr-2 size-4" />
				CSV
			</Button>
		</div>
	</div>

	{#if page.isLoading}
		<div class="flex h-64 items-center justify-center">
			<p class="text-muted-foreground">読み込み中...</p>
		</div>
	{:else if !balanceSheet}
		<Card.Root>
			<Card.Content class="flex h-64 items-center justify-center">
				<p class="text-muted-foreground">
					{page.fiscalYear.selectedYear}年度の仕訳がありません
				</p>
			</Card.Content>
		</Card.Root>
	{:else}
		<!-- 貸借バランスチェック -->
		<Card.Root class={isBalanced ? 'border-green-500/50' : 'border-red-500/50'}>
			<Card.Content class="flex items-center justify-between p-4">
				<div class="flex items-center gap-2">
					{#if isBalanced}
						<Check class="size-5 text-green-600" />
						<span class="font-medium text-green-600">貸借一致</span>
					{:else}
						<AlertTriangle class="size-5 text-red-600" />
						<span class="font-medium text-red-600">貸借不一致</span>
					{/if}
				</div>
				<div class="flex gap-8 text-sm">
					<div>
						<span class="text-muted-foreground">資産合計: </span>
						<span class="font-mono font-medium">¥{balanceSheet.totalAssets.toLocaleString()}</span>
					</div>
					<div>
						<span class="text-muted-foreground">負債・純資産合計: </span>
						<span class="font-mono font-medium"
							>¥{balanceSheet.totalLiabilitiesAndEquity.toLocaleString()}</span
						>
					</div>
				</div>
			</Card.Content>
		</Card.Root>

		<div class="grid gap-6 md:grid-cols-2">
			<!-- 資産の部 -->
			<Card.Root>
				<Card.Header>
					<Card.Title>資産の部</Card.Title>
				</Card.Header>
				<Card.Content class="p-0">
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head class="w-20">コード</Table.Head>
								<Table.Head>勘定科目</Table.Head>
								<Table.Head class="w-28 text-right">金額</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							<!-- 流動資産 -->
							<Table.Row class="bg-muted/30">
								<Table.Cell colspan={3} class="font-medium">流動資産</Table.Cell>
							</Table.Row>
							{#each balanceSheet.currentAssets as row (row.accountCode)}
								<Table.Row>
									<Table.Cell class="font-mono text-sm text-muted-foreground">
										{row.accountCode}
									</Table.Cell>
									<Table.Cell>{row.accountName}</Table.Cell>
									<Table.Cell class="text-right font-mono">
										{formatBSAmount(row.amount)}
									</Table.Cell>
								</Table.Row>
							{/each}
							{#if balanceSheet.currentAssets.length === 0}
								<Table.Row>
									<Table.Cell colspan={3} class="text-center text-muted-foreground">
										（該当なし）
									</Table.Cell>
								</Table.Row>
							{/if}
							<Table.Row class="bg-muted/50">
								<Table.Cell></Table.Cell>
								<Table.Cell class="font-medium">流動資産 合計</Table.Cell>
								<Table.Cell class="text-right font-mono font-medium">
									{balanceSheet.currentAssets
										.reduce((s: number, r: BalanceSheetRow) => s + r.amount, 0)
										.toLocaleString()}
								</Table.Cell>
							</Table.Row>

							<!-- 固定資産 -->
							<Table.Row class="bg-muted/30">
								<Table.Cell colspan={3} class="font-medium">固定資産</Table.Cell>
							</Table.Row>
							{#each balanceSheet.fixedAssets as row (row.accountCode)}
								<Table.Row>
									<Table.Cell class="font-mono text-sm text-muted-foreground">
										{row.accountCode}
									</Table.Cell>
									<Table.Cell>{row.accountName}</Table.Cell>
									<Table.Cell class="text-right font-mono">
										{formatBSAmount(row.amount)}
									</Table.Cell>
								</Table.Row>
							{/each}
							{#if balanceSheet.fixedAssets.length === 0}
								<Table.Row>
									<Table.Cell colspan={3} class="text-center text-muted-foreground">
										（該当なし）
									</Table.Cell>
								</Table.Row>
							{/if}
							<Table.Row class="bg-muted/50">
								<Table.Cell></Table.Cell>
								<Table.Cell class="font-medium">固定資産 合計</Table.Cell>
								<Table.Cell class="text-right font-mono font-medium">
									{balanceSheet.fixedAssets
										.reduce((s: number, r: BalanceSheetRow) => s + r.amount, 0)
										.toLocaleString()}
								</Table.Cell>
							</Table.Row>

							<!-- 資産合計 -->
							<Table.Row class="bg-primary/10 font-bold">
								<Table.Cell></Table.Cell>
								<Table.Cell>資産合計</Table.Cell>
								<Table.Cell class="text-right font-mono">
									¥{balanceSheet.totalAssets.toLocaleString()}
								</Table.Cell>
							</Table.Row>
						</Table.Body>
					</Table.Root>
				</Card.Content>
			</Card.Root>

			<!-- 負債・純資産の部 -->
			<Card.Root>
				<Card.Header>
					<Card.Title>負債・純資産の部</Card.Title>
				</Card.Header>
				<Card.Content class="p-0">
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head class="w-20">コード</Table.Head>
								<Table.Head>勘定科目</Table.Head>
								<Table.Head class="w-28 text-right">金額</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							<!-- 流動負債 -->
							<Table.Row class="bg-muted/30">
								<Table.Cell colspan={3} class="font-medium">流動負債</Table.Cell>
							</Table.Row>
							{#each balanceSheet.currentLiabilities as row (row.accountCode)}
								<Table.Row>
									<Table.Cell class="font-mono text-sm text-muted-foreground">
										{row.accountCode}
									</Table.Cell>
									<Table.Cell>{row.accountName}</Table.Cell>
									<Table.Cell class="text-right font-mono">
										{formatBSAmount(row.amount)}
									</Table.Cell>
								</Table.Row>
							{/each}
							{#if balanceSheet.currentLiabilities.length === 0}
								<Table.Row>
									<Table.Cell colspan={3} class="text-center text-muted-foreground">
										（該当なし）
									</Table.Cell>
								</Table.Row>
							{/if}
							<Table.Row class="bg-muted/50">
								<Table.Cell></Table.Cell>
								<Table.Cell class="font-medium">流動負債 合計</Table.Cell>
								<Table.Cell class="text-right font-mono font-medium">
									{balanceSheet.currentLiabilities
										.reduce((s: number, r: BalanceSheetRow) => s + r.amount, 0)
										.toLocaleString()}
								</Table.Cell>
							</Table.Row>

							<!-- 固定負債 -->
							<Table.Row class="bg-muted/30">
								<Table.Cell colspan={3} class="font-medium">固定負債</Table.Cell>
							</Table.Row>
							{#each balanceSheet.fixedLiabilities as row (row.accountCode)}
								<Table.Row>
									<Table.Cell class="font-mono text-sm text-muted-foreground">
										{row.accountCode}
									</Table.Cell>
									<Table.Cell>{row.accountName}</Table.Cell>
									<Table.Cell class="text-right font-mono">
										{formatBSAmount(row.amount)}
									</Table.Cell>
								</Table.Row>
							{/each}
							{#if balanceSheet.fixedLiabilities.length === 0}
								<Table.Row>
									<Table.Cell colspan={3} class="text-center text-muted-foreground">
										（該当なし）
									</Table.Cell>
								</Table.Row>
							{/if}
							<Table.Row class="bg-muted/50">
								<Table.Cell></Table.Cell>
								<Table.Cell class="font-medium">固定負債 合計</Table.Cell>
								<Table.Cell class="text-right font-mono font-medium">
									{balanceSheet.fixedLiabilities
										.reduce((s: number, r: BalanceSheetRow) => s + r.amount, 0)
										.toLocaleString()}
								</Table.Cell>
							</Table.Row>

							<!-- 負債合計 -->
							<Table.Row class="bg-primary/10 font-bold">
								<Table.Cell></Table.Cell>
								<Table.Cell>負債合計</Table.Cell>
								<Table.Cell class="text-right font-mono">
									¥{balanceSheet.totalLiabilities.toLocaleString()}
								</Table.Cell>
							</Table.Row>

							<!-- 純資産 -->
							<Table.Row class="bg-muted/30">
								<Table.Cell colspan={3} class="font-medium">純資産</Table.Cell>
							</Table.Row>
							{#each balanceSheet.equity as row (row.accountCode)}
								<Table.Row>
									<Table.Cell class="font-mono text-sm text-muted-foreground">
										{row.accountCode}
									</Table.Cell>
									<Table.Cell>{row.accountName}</Table.Cell>
									<Table.Cell class="text-right font-mono">
										{formatBSAmount(row.amount)}
									</Table.Cell>
								</Table.Row>
							{/each}
							{#if balanceSheet.retainedEarnings !== 0}
								<Table.Row>
									<Table.Cell></Table.Cell>
									<Table.Cell>繰越利益（当期純利益）</Table.Cell>
									<Table.Cell class="text-right font-mono">
										{formatBSAmount(balanceSheet.retainedEarnings)}
									</Table.Cell>
								</Table.Row>
							{/if}
							<Table.Row class="bg-muted/50">
								<Table.Cell></Table.Cell>
								<Table.Cell class="font-medium">純資産 合計</Table.Cell>
								<Table.Cell class="text-right font-mono font-medium">
									{balanceSheet.totalEquity.toLocaleString()}
								</Table.Cell>
							</Table.Row>

							<!-- 負債・純資産合計 -->
							<Table.Row class="bg-primary/10 font-bold">
								<Table.Cell></Table.Cell>
								<Table.Cell>負債・純資産合計</Table.Cell>
								<Table.Cell class="text-right font-mono">
									¥{balanceSheet.totalLiabilitiesAndEquity.toLocaleString()}
								</Table.Cell>
							</Table.Row>
						</Table.Body>
					</Table.Root>
				</Card.Content>
			</Card.Root>
		</div>
	{/if}
</div>
