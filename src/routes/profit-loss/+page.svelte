<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { TrendingUp, Download } from '@lucide/svelte';
	import { generateProfitLoss, formatPLAmount, profitLossToCsv } from '$lib/utils/profit-loss';
	import { useJournalPage } from '$lib/hooks/use-journal-page.svelte';
	import type { ProfitLossData, ProfitLossRow } from '$lib/types';

	const page = useJournalPage();

	const profitLoss = $derived.by<ProfitLossData | null>(() => {
		if (page.journals.length === 0 || page.accounts.length === 0) return null;
		return generateProfitLoss(page.journals, page.accounts, page.fiscalYear.selectedYear);
	});

	function exportCSV() {
		if (!profitLoss) return;

		const csvContent = '\uFEFF' + profitLossToCsv(profitLoss);
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `損益計算書_${page.fiscalYear.selectedYear}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}

	// 利益がプラスかどうか
	const isProfit = $derived((profitLoss?.netIncome ?? 0) >= 0);
</script>

<div class="space-y-6">
	<div
		class="sticky top-14 z-10 -mx-4 flex items-center justify-between border-b bg-background px-4 pt-4 pb-3 group-has-data-[collapsible=icon]/sidebar-wrapper:top-12"
	>
		<h1 class="flex items-center gap-2 text-2xl font-bold">
			<TrendingUp class="size-6" />
			損益計算書
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

			<Button variant="outline" onclick={exportCSV} disabled={!profitLoss}>
				<Download class="mr-2 size-4" />
				CSV
			</Button>
		</div>
	</div>

	{#if page.isLoading}
		<div class="flex h-64 items-center justify-center">
			<p class="text-muted-foreground">読み込み中...</p>
		</div>
	{:else if !profitLoss}
		<Card.Root>
			<Card.Content class="flex h-64 items-center justify-center">
				<p class="text-muted-foreground">
					{page.fiscalYear.selectedYear}年度の仕訳がありません
				</p>
			</Card.Content>
		</Card.Root>
	{:else}
		<!-- 当期純利益サマリー -->
		<Card.Root class={isProfit ? 'border-green-500/50' : 'border-red-500/50'}>
			<Card.Content class="flex items-center justify-between p-4">
				<div class="flex items-center gap-2">
					<span class="font-medium {isProfit ? 'text-green-600' : 'text-red-600'}">
						当期純利益
					</span>
				</div>
				<div class="text-xl font-bold {isProfit ? 'text-green-600' : 'text-red-600'}">
					¥{formatPLAmount(profitLoss.netIncome)}
				</div>
			</Card.Content>
		</Card.Root>

		<!-- 損益計算書テーブル -->
		<Card.Root>
			<Card.Content class="p-0">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head class="w-24">コード</Table.Head>
							<Table.Head>勘定科目</Table.Head>
							<Table.Head class="w-32 text-right">金額</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						<!-- 売上高 -->
						<Table.Row class="bg-muted/30">
							<Table.Cell colspan={3} class="font-medium">売上高</Table.Cell>
						</Table.Row>
						{#each profitLoss.salesRevenue as row (row.accountCode)}
							<Table.Row>
								<Table.Cell class="font-mono text-sm text-muted-foreground">
									{row.accountCode}
								</Table.Cell>
								<Table.Cell>{row.accountName}</Table.Cell>
								<Table.Cell class="text-right font-mono">
									{row.amount.toLocaleString()}
								</Table.Cell>
							</Table.Row>
						{/each}
						<Table.Row class="bg-muted/50">
							<Table.Cell></Table.Cell>
							<Table.Cell class="font-medium">売上高 合計</Table.Cell>
							<Table.Cell class="text-right font-mono font-medium">
								{profitLoss.salesRevenue
									.reduce((s: number, r: ProfitLossRow) => s + r.amount, 0)
									.toLocaleString()}
							</Table.Cell>
						</Table.Row>

						<!-- 売上原価 -->
						<Table.Row class="bg-muted/30">
							<Table.Cell colspan={3} class="font-medium">売上原価</Table.Cell>
						</Table.Row>
						{#each profitLoss.costOfSales as row (row.accountCode)}
							<Table.Row>
								<Table.Cell class="font-mono text-sm text-muted-foreground">
									{row.accountCode}
								</Table.Cell>
								<Table.Cell>{row.accountName}</Table.Cell>
								<Table.Cell class="text-right font-mono">
									{row.amount.toLocaleString()}
								</Table.Cell>
							</Table.Row>
						{/each}
						{#if profitLoss.costOfSales.length === 0}
							<Table.Row>
								<Table.Cell colspan={3} class="text-center text-muted-foreground">
									（該当なし）
								</Table.Cell>
							</Table.Row>
						{/if}
						<Table.Row class="bg-muted/50">
							<Table.Cell></Table.Cell>
							<Table.Cell class="font-medium">売上原価 合計</Table.Cell>
							<Table.Cell class="text-right font-mono font-medium">
								{profitLoss.costOfSales
									.reduce((s: number, r: ProfitLossRow) => s + r.amount, 0)
									.toLocaleString()}
							</Table.Cell>
						</Table.Row>

						<!-- 売上総利益 -->
						<Table.Row class="bg-primary/10 font-bold">
							<Table.Cell></Table.Cell>
							<Table.Cell>売上総利益</Table.Cell>
							<Table.Cell class="text-right font-mono">
								¥{formatPLAmount(profitLoss.grossProfit)}
							</Table.Cell>
						</Table.Row>

						<!-- 販売費及び一般管理費 -->
						<Table.Row class="bg-muted/30">
							<Table.Cell colspan={3} class="font-medium">販売費及び一般管理費</Table.Cell>
						</Table.Row>
						{#each profitLoss.operatingExpenses as row (row.accountCode)}
							<Table.Row>
								<Table.Cell class="font-mono text-sm text-muted-foreground">
									{row.accountCode}
								</Table.Cell>
								<Table.Cell>{row.accountName}</Table.Cell>
								<Table.Cell class="text-right font-mono">
									{row.amount.toLocaleString()}
								</Table.Cell>
							</Table.Row>
						{/each}
						{#if profitLoss.operatingExpenses.length === 0}
							<Table.Row>
								<Table.Cell colspan={3} class="text-center text-muted-foreground">
									（該当なし）
								</Table.Cell>
							</Table.Row>
						{/if}
						<Table.Row class="bg-muted/50">
							<Table.Cell></Table.Cell>
							<Table.Cell class="font-medium">販管費 合計</Table.Cell>
							<Table.Cell class="text-right font-mono font-medium">
								{profitLoss.operatingExpenses
									.reduce((s: number, r: ProfitLossRow) => s + r.amount, 0)
									.toLocaleString()}
							</Table.Cell>
						</Table.Row>

						<!-- 営業利益 -->
						<Table.Row class="bg-primary/10 font-bold">
							<Table.Cell></Table.Cell>
							<Table.Cell>営業利益</Table.Cell>
							<Table.Cell class="text-right font-mono">
								¥{formatPLAmount(profitLoss.operatingIncome)}
							</Table.Cell>
						</Table.Row>

						<!-- 営業外収益 -->
						<Table.Row class="bg-muted/30">
							<Table.Cell colspan={3} class="font-medium">営業外収益</Table.Cell>
						</Table.Row>
						{#each profitLoss.otherRevenue as row (row.accountCode)}
							<Table.Row>
								<Table.Cell class="font-mono text-sm text-muted-foreground">
									{row.accountCode}
								</Table.Cell>
								<Table.Cell>{row.accountName}</Table.Cell>
								<Table.Cell class="text-right font-mono">
									{row.amount.toLocaleString()}
								</Table.Cell>
							</Table.Row>
						{/each}
						{#if profitLoss.otherRevenue.length === 0}
							<Table.Row>
								<Table.Cell colspan={3} class="text-center text-muted-foreground">
									（該当なし）
								</Table.Cell>
							</Table.Row>
						{/if}
						<Table.Row class="bg-muted/50">
							<Table.Cell></Table.Cell>
							<Table.Cell class="font-medium">営業外収益 合計</Table.Cell>
							<Table.Cell class="text-right font-mono font-medium">
								{profitLoss.otherRevenue
									.reduce((s: number, r: ProfitLossRow) => s + r.amount, 0)
									.toLocaleString()}
							</Table.Cell>
						</Table.Row>

						<!-- 当期純利益 -->
						<Table.Row class="bg-primary/20 text-lg font-bold">
							<Table.Cell></Table.Cell>
							<Table.Cell>当期純利益</Table.Cell>
							<Table.Cell
								class="text-right font-mono {isProfit ? 'text-green-600' : 'text-red-600'}"
							>
								¥{formatPLAmount(profitLoss.netIncome)}
							</Table.Cell>
						</Table.Row>
					</Table.Body>
				</Table.Root>
			</Card.Content>
		</Card.Root>
	{/if}
</div>
