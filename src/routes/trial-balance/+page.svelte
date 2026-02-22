<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Scale, Download, Check, AlertTriangle } from '@lucide/svelte';
	import {
		generateTrialBalance,
		groupTrialBalance,
		formatAmount,
		type GroupedTrialBalanceData
	} from '$lib/utils/trial-balance';
	import { useJournalPage } from '$lib/hooks/use-journal-page.svelte';

	const page = useJournalPage();

	// 表示モード: 'all' = 合計残高試算表, 'balance' = 残高試算表
	let displayMode = $state<'all' | 'balance'>('all');

	// 仕訳・科目が変わったら自動再計算
	const trialBalance = $derived.by<GroupedTrialBalanceData | null>(() => {
		if (page.journals.length === 0 || page.accounts.length === 0) return null;
		const rawData = generateTrialBalance(page.journals, page.accounts);
		return groupTrialBalance(rawData);
	});

	// CSV エクスポート
	function exportCSV() {
		if (!trialBalance) return;

		const headers =
			displayMode === 'all'
				? ['科目コード', '科目名', '借方合計', '貸方合計', '借方残高', '貸方残高']
				: ['科目コード', '科目名', '借方残高', '貸方残高'];

		const rows: string[][] = [];

		for (const group of trialBalance.groups) {
			// グループヘッダー
			rows.push([`【${group.label}】`, '', '', '', '', '']);

			for (const row of group.rows) {
				if (displayMode === 'all') {
					rows.push([
						row.accountCode,
						row.accountName,
						row.debitTotal.toString(),
						row.creditTotal.toString(),
						row.debitBalance.toString(),
						row.creditBalance.toString()
					]);
				} else {
					rows.push([
						row.accountCode,
						row.accountName,
						row.debitBalance.toString(),
						row.creditBalance.toString()
					]);
				}
			}

			// グループ小計
			if (displayMode === 'all') {
				rows.push([
					'',
					`${group.label}計`,
					group.subtotalDebit.toString(),
					group.subtotalCredit.toString(),
					group.subtotalDebitBalance.toString(),
					group.subtotalCreditBalance.toString()
				]);
			} else {
				rows.push([
					'',
					`${group.label}計`,
					group.subtotalDebitBalance.toString(),
					group.subtotalCreditBalance.toString()
				]);
			}
		}

		// 合計行
		if (displayMode === 'all') {
			rows.push([
				'',
				'合計',
				trialBalance.totalDebit.toString(),
				trialBalance.totalCredit.toString(),
				trialBalance.totalDebitBalance.toString(),
				trialBalance.totalCreditBalance.toString()
			]);
		} else {
			rows.push([
				'',
				'合計',
				trialBalance.totalDebitBalance.toString(),
				trialBalance.totalCreditBalance.toString()
			]);
		}

		const csvContent =
			'\uFEFF' +
			[headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join(
				'\n'
			);

		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `試算表_${page.fiscalYear.selectedYear}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<div class="space-y-6">
	<div
		class="sticky top-14 z-10 -mx-4 flex items-center justify-between border-b bg-background px-4 pt-4 pb-3 group-has-data-[collapsible=icon]/sidebar-wrapper:top-12"
	>
		<h1 class="flex items-center gap-2 text-2xl font-bold">
			<Scale class="size-6" />
			試算表
		</h1>

		<div class="flex items-center gap-2">
			<Select.Root
				type="single"
				value={displayMode}
				onValueChange={(v) => v && (displayMode = v as 'all' | 'balance')}
			>
				<Select.Trigger class="w-40">
					{displayMode === 'all' ? '合計残高試算表' : '残高試算表'}
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="all">合計残高試算表</Select.Item>
					<Select.Item value="balance">残高試算表</Select.Item>
				</Select.Content>
			</Select.Root>

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

			<Button variant="outline" onclick={exportCSV} disabled={!trialBalance}>
				<Download class="mr-2 size-4" />
				CSV
			</Button>
		</div>
	</div>

	{#if page.isLoading}
		<div class="flex h-64 items-center justify-center">
			<p class="text-muted-foreground">読み込み中...</p>
		</div>
	{:else if !trialBalance || trialBalance.groups.length === 0}
		<Card.Root>
			<Card.Content class="flex h-64 items-center justify-center">
				<p class="text-muted-foreground">
					{page.fiscalYear.selectedYear}年度の仕訳がありません
				</p>
			</Card.Content>
		</Card.Root>
	{:else}
		<!-- 貸借一致チェック -->
		<Card.Root class={trialBalance.isBalanced ? 'border-green-500/50' : 'border-red-500/50'}>
			<Card.Content class="flex items-center justify-between p-4">
				<div class="flex items-center gap-2">
					{#if trialBalance.isBalanced}
						<Check class="size-5 text-green-600" />
						<span class="font-medium text-green-600">貸借一致</span>
					{:else}
						<AlertTriangle class="size-5 text-red-600" />
						<span class="font-medium text-red-600">貸借不一致</span>
					{/if}
				</div>
				<div class="flex gap-8 text-sm">
					<div>
						<span class="text-muted-foreground">借方合計: </span>
						<span class="font-mono font-medium">¥{trialBalance.totalDebit.toLocaleString()}</span>
					</div>
					<div>
						<span class="text-muted-foreground">貸方合計: </span>
						<span class="font-mono font-medium">¥{trialBalance.totalCredit.toLocaleString()}</span>
					</div>
				</div>
			</Card.Content>
		</Card.Root>

		<!-- 試算表 -->
		<Card.Root>
			<Card.Content class="p-0">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head class="w-24">コード</Table.Head>
							<Table.Head>勘定科目</Table.Head>
							{#if displayMode === 'all'}
								<Table.Head class="w-28 text-right">借方合計</Table.Head>
								<Table.Head class="w-28 text-right">貸方合計</Table.Head>
							{/if}
							<Table.Head class="w-28 text-right">借方残高</Table.Head>
							<Table.Head class="w-28 text-right">貸方残高</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each trialBalance.groups as group (group.type)}
							<!-- グループヘッダー -->
							<Table.Row class="bg-muted/30">
								<Table.Cell colspan={displayMode === 'all' ? 6 : 4} class="font-medium">
									{group.label}
								</Table.Cell>
							</Table.Row>

							<!-- 科目行 -->
							{#each group.rows as row (row.accountCode)}
								<Table.Row>
									<Table.Cell class="font-mono text-sm text-muted-foreground">
										{row.accountCode}
									</Table.Cell>
									<Table.Cell>{row.accountName}</Table.Cell>
									{#if displayMode === 'all'}
										<Table.Cell class="text-right font-mono">
											{formatAmount(row.debitTotal)}
										</Table.Cell>
										<Table.Cell class="text-right font-mono">
											{formatAmount(row.creditTotal)}
										</Table.Cell>
									{/if}
									<Table.Cell class="text-right font-mono">
										{formatAmount(row.debitBalance)}
									</Table.Cell>
									<Table.Cell class="text-right font-mono">
										{formatAmount(row.creditBalance)}
									</Table.Cell>
								</Table.Row>
							{/each}

							<!-- グループ小計 -->
							<Table.Row class="bg-muted/50">
								<Table.Cell></Table.Cell>
								<Table.Cell class="font-medium">{group.label}計</Table.Cell>
								{#if displayMode === 'all'}
									<Table.Cell class="text-right font-mono font-medium">
										{formatAmount(group.subtotalDebit)}
									</Table.Cell>
									<Table.Cell class="text-right font-mono font-medium">
										{formatAmount(group.subtotalCredit)}
									</Table.Cell>
								{/if}
								<Table.Cell class="text-right font-mono font-medium">
									{formatAmount(group.subtotalDebitBalance)}
								</Table.Cell>
								<Table.Cell class="text-right font-mono font-medium">
									{formatAmount(group.subtotalCreditBalance)}
								</Table.Cell>
							</Table.Row>
						{/each}

						<!-- 合計行 -->
						<Table.Row class="bg-primary/10 font-bold">
							<Table.Cell></Table.Cell>
							<Table.Cell>合計</Table.Cell>
							{#if displayMode === 'all'}
								<Table.Cell class="text-right font-mono">
									¥{trialBalance.totalDebit.toLocaleString()}
								</Table.Cell>
								<Table.Cell class="text-right font-mono">
									¥{trialBalance.totalCredit.toLocaleString()}
								</Table.Cell>
							{/if}
							<Table.Cell class="text-right font-mono">
								¥{trialBalance.totalDebitBalance.toLocaleString()}
							</Table.Cell>
							<Table.Cell class="text-right font-mono">
								¥{trialBalance.totalCreditBalance.toLocaleString()}
							</Table.Cell>
						</Table.Row>
					</Table.Body>
				</Table.Root>
			</Card.Content>
		</Card.Root>
	{/if}
</div>
