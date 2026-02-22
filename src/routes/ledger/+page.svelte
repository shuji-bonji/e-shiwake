<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { BookOpen, Download, Receipt, Wallet, TrendingUp, CreditCard, Gem } from '@lucide/svelte';
	import { generateLedger, getUsedAccounts, type LedgerData } from '$lib/utils/ledger';
	import { formatAmount } from '$lib/utils/trial-balance';
	import { useJournalPage } from '$lib/hooks/use-journal-page.svelte';
	import type { Account, AccountType } from '$lib/types';
	import { AccountTypeLabels } from '$lib/types';

	const page = useJournalPage();

	let selectedAccountCode = $state<string>('');

	// 使用済み科目を仕訳・科目マスタから導出
	const usedAccounts = $derived(
		page.journals.length > 0 && page.accounts.length > 0
			? getUsedAccounts(page.journals, page.accounts)
			: []
	);

	// カテゴリ順序（試算表と同じ順）
	const typeOrder: AccountType[] = ['asset', 'liability', 'equity', 'revenue', 'expense'];

	// カテゴリごとのアイコン
	const categoryIcons: Record<AccountType, typeof Receipt> = {
		expense: Receipt,
		asset: Wallet,
		revenue: TrendingUp,
		liability: CreditCard,
		equity: Gem
	};

	// 使用済み科目をカテゴリ別にグループ化
	const groupedUsedAccounts = $derived.by(() => {
		const groups: Record<AccountType, Account[]> = {
			asset: [],
			liability: [],
			equity: [],
			revenue: [],
			expense: []
		};

		for (const account of usedAccounts) {
			groups[account.type].push(account);
		}

		return groups;
	});

	// 勘定科目が変更されたら元帳を再生成
	const ledgerData = $derived.by<LedgerData | null>(() => {
		if (selectedAccountCode && page.journals.length > 0 && page.accounts.length > 0) {
			return generateLedger(page.journals, selectedAccountCode, page.accounts, 0);
		}
		return null;
	});

	// 使用済み科目があり、まだ科目が選択されていなければ最初の科目を自動選択
	$effect(() => {
		if (usedAccounts.length > 0 && !selectedAccountCode) {
			selectedAccountCode = usedAccounts[0].code;
		}
	});

	function handleYearChange(year: number) {
		selectedAccountCode = '';
		page.handleYearChange(year);
	}

	function selectAccount(code: string) {
		selectedAccountCode = code;
	}

	// CSV エクスポート
	function exportCSV() {
		if (!ledgerData) return;

		const headers = ['日付', '摘要', '取引先', '相手科目', '借方', '貸方', '残高'];
		const rows = ledgerData.entries.map((e) => [
			e.date,
			e.description,
			e.vendor,
			e.counterAccount,
			e.debit?.toString() || '',
			e.credit?.toString() || '',
			e.balance.toString()
		]);

		// 合計行
		rows.push([
			'',
			'合計',
			'',
			'',
			ledgerData.totalDebit.toString(),
			ledgerData.totalCredit.toString(),
			ledgerData.closingBalance.toString()
		]);

		const csvContent =
			'\uFEFF' +
			[headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join(
				'\n'
			);

		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `総勘定元帳_${ledgerData.accountName}_${page.fiscalYear.selectedYear}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<div class="space-y-6">
	<div
		class="sticky top-14 z-10 -mx-4 flex items-center justify-between border-b bg-background px-4 pt-4 pb-3 group-has-data-[collapsible=icon]/sidebar-wrapper:top-12"
	>
		<h1 class="flex items-center gap-2 text-2xl font-bold">
			<BookOpen class="size-6" />
			総勘定元帳
		</h1>

		<div class="flex items-center gap-2">
			<Select.Root
				type="single"
				value={page.fiscalYear.selectedYear.toString()}
				onValueChange={(v) => v && handleYearChange(parseInt(v))}
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

			<Button variant="outline" onclick={exportCSV} disabled={!ledgerData}>
				<Download class="mr-2 size-4" />
				CSV
			</Button>
		</div>
	</div>

	{#if page.isLoading}
		<div class="flex h-64 items-center justify-center">
			<p class="text-muted-foreground">読み込み中...</p>
		</div>
	{:else if usedAccounts.length === 0}
		<Card.Root>
			<Card.Content class="flex h-64 items-center justify-center">
				<p class="text-muted-foreground">
					{page.fiscalYear.selectedYear}年度の仕訳がありません
				</p>
			</Card.Content>
		</Card.Root>
	{:else}
		<!-- 科目選択（バッジ形式） -->
		<Card.Root>
			<Card.Content class="space-y-3 p-4">
				{#each typeOrder as type (type)}
					{@const typeAccounts = groupedUsedAccounts[type]}
					{@const Icon = categoryIcons[type]}
					{#if typeAccounts.length > 0}
						<div>
							<!-- カテゴリヘッダー -->
							<div class="mb-1.5 flex items-center gap-1.5">
								<Icon class="size-3.5 text-muted-foreground" />
								<span class="text-xs font-medium text-muted-foreground"
									>{AccountTypeLabels[type]}</span
								>
							</div>
							<!-- 科目バッジ -->
							<div class="flex flex-wrap gap-1.5">
								{#each typeAccounts as account (account.code)}
									<button
										type="button"
										class="rounded-md border px-2.5 py-1 text-sm transition-colors {selectedAccountCode ===
										account.code
											? 'border-primary bg-primary text-primary-foreground'
											: 'border-border bg-background hover:bg-muted'}"
										onclick={() => selectAccount(account.code)}
									>
										{account.name}
									</button>
								{/each}
							</div>
						</div>
					{/if}
				{/each}
			</Card.Content>
		</Card.Root>

		<!-- 元帳テーブル -->
		{#if ledgerData}
			<Card.Root>
				<Card.Header>
					<Card.Title>{ledgerData.accountName}</Card.Title>
					<Card.Description>
						期首残高: ¥{formatAmount(ledgerData.openingBalance) || '0'}
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head class="w-24">日付</Table.Head>
								<Table.Head>摘要</Table.Head>
								<Table.Head>相手科目</Table.Head>
								<Table.Head class="w-28 text-right">借方</Table.Head>
								<Table.Head class="w-28 text-right">貸方</Table.Head>
								<Table.Head class="w-32 text-right">残高</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each ledgerData.entries as entry (entry.journalId)}
								<Table.Row>
									<Table.Cell class="font-mono text-sm">
										{entry.date.substring(5).replace('-', '/')}
									</Table.Cell>
									<Table.Cell>
										<div class="max-w-48 truncate" title={entry.description}>
											{entry.description}
										</div>
										{#if entry.vendor}
											<div class="text-xs text-muted-foreground">{entry.vendor}</div>
										{/if}
									</Table.Cell>
									<Table.Cell class="text-sm">{entry.counterAccount}</Table.Cell>
									<Table.Cell class="text-right font-mono">
										{formatAmount(entry.debit)}
									</Table.Cell>
									<Table.Cell class="text-right font-mono">
										{formatAmount(entry.credit)}
									</Table.Cell>
									<Table.Cell class="text-right font-mono font-medium">
										¥{entry.balance.toLocaleString()}
									</Table.Cell>
								</Table.Row>
							{/each}

							<!-- 合計行 -->
							<Table.Row class="bg-muted/50 font-medium">
								<Table.Cell colspan={3} class="text-right">合計</Table.Cell>
								<Table.Cell class="text-right font-mono">
									{formatAmount(ledgerData.totalDebit)}
								</Table.Cell>
								<Table.Cell class="text-right font-mono">
									{formatAmount(ledgerData.totalCredit)}
								</Table.Cell>
								<Table.Cell class="text-right font-mono">
									¥{ledgerData.closingBalance.toLocaleString()}
								</Table.Cell>
							</Table.Row>
						</Table.Body>
					</Table.Root>
				</Card.Content>
			</Card.Root>
		{/if}
	{/if}
</div>
