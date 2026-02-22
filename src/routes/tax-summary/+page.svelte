<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Receipt, Download, Info, ExternalLink } from '@lucide/svelte';
	import {
		generateConsumptionTax,
		formatTaxAmount,
		consumptionTaxToCsv,
		isExemptBusiness,
		canUseSimplifiedTax
	} from '$lib/utils/consumption-tax';
	import { useJournalPage } from '$lib/hooks/use-journal-page.svelte';
	import type { ConsumptionTaxData } from '$lib/types';

	const page = useJournalPage({ loadAccounts: false });

	const taxData = $derived.by<ConsumptionTaxData | null>(() => {
		if (page.journals.length === 0) return null;
		return generateConsumptionTax(page.journals, page.fiscalYear.selectedYear);
	});

	function exportCSV() {
		if (!taxData) return;

		const csvContent = '\uFEFF' + consumptionTaxToCsv(taxData);
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `消費税集計_${page.fiscalYear.selectedYear}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}

	// 納付税額がプラスかどうか
	const isPayable = $derived((taxData?.netTaxPayable ?? 0) >= 0);

	// 免税事業者の可能性
	const mayBeExempt = $derived(taxData ? isExemptBusiness(taxData.totalTaxableSales) : false);

	// 簡易課税適用可能
	const canSimplified = $derived(taxData ? canUseSimplifiedTax(taxData.totalTaxableSales) : false);
</script>

<div class="space-y-6">
	<div
		class="sticky top-14 z-10 -mx-4 flex items-center justify-between border-b bg-background px-4 pt-4 pb-3 group-has-data-[collapsible=icon]/sidebar-wrapper:top-12"
	>
		<h1 class="flex items-center gap-2 text-2xl font-bold">
			<Receipt class="size-6" />
			消費税集計
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

			<Button variant="outline" onclick={exportCSV} disabled={!taxData}>
				<Download class="mr-2 size-4" />
				CSV
			</Button>
		</div>
	</div>

	{#if page.isLoading}
		<div class="flex h-64 items-center justify-center">
			<p class="text-muted-foreground">読み込み中...</p>
		</div>
	{:else if !taxData}
		<Card.Root>
			<Card.Content class="flex h-64 items-center justify-center">
				<p class="text-muted-foreground">
					{page.fiscalYear.selectedYear}年度の仕訳がありません
				</p>
			</Card.Content>
		</Card.Root>
	{:else}
		<!-- 納付税額サマリー -->
		<Card.Root class={isPayable ? 'border-amber-500/50' : 'border-green-500/50'}>
			<Card.Content class="flex items-center justify-between p-4">
				<div class="flex items-center gap-2">
					<span class="font-medium {isPayable ? 'text-amber-600' : 'text-green-600'}">
						{isPayable ? '納付すべき消費税額' : '還付される消費税額'}
					</span>
				</div>
				<div class="text-xl font-bold {isPayable ? 'text-amber-600' : 'text-green-600'}">
					¥{formatTaxAmount(Math.abs(taxData.netTaxPayable))}
				</div>
			</Card.Content>
		</Card.Root>

		<!-- 免税事業者・簡易課税の情報 -->
		{#if mayBeExempt || canSimplified}
			<Card.Root class="border-blue-500/50">
				<Card.Content class="p-4">
					<div class="flex items-start gap-2">
						<Info class="mt-0.5 size-5 text-blue-600" />
						<div class="space-y-1 text-sm">
							{#if mayBeExempt}
								<p class="text-blue-600">
									課税売上高が1,000万円以下のため、免税事業者に該当する可能性があります。
								</p>
							{/if}
							{#if canSimplified}
								<p class="text-blue-600">
									課税売上高が5,000万円以下のため、簡易課税制度を選択できる可能性があります。
								</p>
							{/if}
							<p class="text-muted-foreground">
								※ 前々年度の課税売上高により判定されます。詳しくは税理士にご相談ください。
							</p>
						</div>
					</div>
				</Card.Content>
			</Card.Root>
		{/if}

		<div class="grid gap-6 md:grid-cols-2">
			<!-- 課税売上 -->
			<Card.Root>
				<Card.Header>
					<Card.Title>課税売上</Card.Title>
				</Card.Header>
				<Card.Content class="p-0">
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>区分</Table.Head>
								<Table.Head class="w-32 text-right">税抜金額</Table.Head>
								<Table.Head class="w-28 text-right">消費税額</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each taxData.salesRows as row (row.taxCategory)}
								<Table.Row>
									<Table.Cell>{row.taxCategoryLabel}</Table.Cell>
									<Table.Cell class="text-right font-mono">
										{row.taxableAmount.toLocaleString()}
									</Table.Cell>
									<Table.Cell class="text-right font-mono">
										{row.taxAmount.toLocaleString()}
									</Table.Cell>
								</Table.Row>
							{/each}
							{#if taxData.salesRows.length === 0}
								<Table.Row>
									<Table.Cell colspan={3} class="text-center text-muted-foreground">
										（該当なし）
									</Table.Cell>
								</Table.Row>
							{/if}
							<Table.Row class="bg-muted/50 font-medium">
								<Table.Cell>課税売上 合計</Table.Cell>
								<Table.Cell class="text-right font-mono">
									{taxData.totalTaxableSales.toLocaleString()}
								</Table.Cell>
								<Table.Cell class="text-right font-mono">
									{taxData.totalSalesTax.toLocaleString()}
								</Table.Cell>
							</Table.Row>
						</Table.Body>
					</Table.Root>
				</Card.Content>
			</Card.Root>

			<!-- 課税仕入 -->
			<Card.Root>
				<Card.Header>
					<Card.Title>課税仕入</Card.Title>
				</Card.Header>
				<Card.Content class="p-0">
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>区分</Table.Head>
								<Table.Head class="w-32 text-right">税抜金額</Table.Head>
								<Table.Head class="w-28 text-right">消費税額</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each taxData.purchaseRows as row (row.taxCategory)}
								<Table.Row>
									<Table.Cell>{row.taxCategoryLabel}</Table.Cell>
									<Table.Cell class="text-right font-mono">
										{row.taxableAmount.toLocaleString()}
									</Table.Cell>
									<Table.Cell class="text-right font-mono">
										{row.taxAmount.toLocaleString()}
									</Table.Cell>
								</Table.Row>
							{/each}
							{#if taxData.purchaseRows.length === 0}
								<Table.Row>
									<Table.Cell colspan={3} class="text-center text-muted-foreground">
										（該当なし）
									</Table.Cell>
								</Table.Row>
							{/if}
							<Table.Row class="bg-muted/50 font-medium">
								<Table.Cell>課税仕入 合計</Table.Cell>
								<Table.Cell class="text-right font-mono">
									{taxData.totalTaxablePurchases.toLocaleString()}
								</Table.Cell>
								<Table.Cell class="text-right font-mono">
									{taxData.totalPurchaseTax.toLocaleString()}
								</Table.Cell>
							</Table.Row>
						</Table.Body>
					</Table.Root>
				</Card.Content>
			</Card.Root>
		</div>

		<!-- 納付税額計算 -->
		<Card.Root>
			<Card.Header>
				<Card.Title>納付税額の計算</Card.Title>
			</Card.Header>
			<Card.Content class="p-0">
				<Table.Root>
					<Table.Body>
						<Table.Row>
							<Table.Cell class="w-1/2">売上に係る消費税額</Table.Cell>
							<Table.Cell class="text-right font-mono">
								¥{taxData.totalSalesTax.toLocaleString()}
							</Table.Cell>
						</Table.Row>
						<Table.Row>
							<Table.Cell>仕入に係る消費税額（控除）</Table.Cell>
							<Table.Cell class="text-right font-mono">
								¥{taxData.totalPurchaseTax.toLocaleString()}
							</Table.Cell>
						</Table.Row>
						<Table.Row class="bg-primary/10 font-bold">
							<Table.Cell>{isPayable ? '納付すべき消費税額' : '還付される消費税額'}</Table.Cell>
							<Table.Cell
								class="text-right font-mono {isPayable ? 'text-amber-600' : 'text-green-600'}"
							>
								¥{formatTaxAmount(Math.abs(taxData.netTaxPayable))}
							</Table.Cell>
						</Table.Row>
					</Table.Body>
				</Table.Root>
			</Card.Content>
		</Card.Root>

		<!-- 非課税・不課税（参考） -->
		{#if taxData.exemptSales > 0 || taxData.outOfScopeSales > 0 || taxData.exemptPurchases > 0 || taxData.outOfScopePurchases > 0}
			<Card.Root>
				<Card.Header>
					<Card.Title class="text-base">参考：非課税・不課税取引</Card.Title>
				</Card.Header>
				<Card.Content class="p-0">
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>区分</Table.Head>
								<Table.Head class="w-32 text-right">売上側</Table.Head>
								<Table.Head class="w-32 text-right">仕入側</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#if taxData.exemptSales > 0 || taxData.exemptPurchases > 0}
								<Table.Row>
									<Table.Cell>非課税</Table.Cell>
									<Table.Cell class="text-right font-mono">
										{taxData.exemptSales > 0 ? taxData.exemptSales.toLocaleString() : '-'}
									</Table.Cell>
									<Table.Cell class="text-right font-mono">
										{taxData.exemptPurchases > 0 ? taxData.exemptPurchases.toLocaleString() : '-'}
									</Table.Cell>
								</Table.Row>
							{/if}
							{#if taxData.outOfScopeSales > 0 || taxData.outOfScopePurchases > 0}
								<Table.Row>
									<Table.Cell>不課税</Table.Cell>
									<Table.Cell class="text-right font-mono">
										{taxData.outOfScopeSales > 0 ? taxData.outOfScopeSales.toLocaleString() : '-'}
									</Table.Cell>
									<Table.Cell class="text-right font-mono">
										{taxData.outOfScopePurchases > 0
											? taxData.outOfScopePurchases.toLocaleString()
											: '-'}
									</Table.Cell>
								</Table.Row>
							{/if}
						</Table.Body>
					</Table.Root>
				</Card.Content>
			</Card.Root>
		{/if}

		<!-- 参考資料リンク -->
		<div class="mt-8 rounded-lg border border-dashed p-4 print:hidden">
			<h3 class="mb-2 text-sm font-medium text-muted-foreground">参考資料</h3>
			<ul class="space-y-1 text-sm">
				<li>
					<a
						href="https://github.com/shuji-bonji/Note-on-bookkeeping/blob/main/consumption-tax/overview.md"
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-1 text-primary hover:underline"
					>
						消費税の基礎知識
						<ExternalLink class="size-3" />
					</a>
				</li>
				<li>
					<a
						href="https://github.com/shuji-bonji/Note-on-bookkeeping/blob/main/consumption-tax/calculation-methods.md"
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-1 text-primary hover:underline"
					>
						本則課税・簡易課税・2割特例の比較
						<ExternalLink class="size-3" />
					</a>
				</li>
				<li>
					<a
						href="https://github.com/shuji-bonji/Note-on-bookkeeping/blob/main/consumption-tax/invoice-system.md"
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-1 text-primary hover:underline"
					>
						インボイス制度
						<ExternalLink class="size-3" />
					</a>
				</li>
			</ul>
		</div>
	{/if}
</div>
