<script lang="ts">
	import type { BlueReturnData } from '$lib/types/blue-return-types';
	import { formatAmount } from '$lib/utils/blue-return';

	interface Props {
		data: BlueReturnData;
		active: boolean;
	}

	let { data, active }: Props = $props();
</script>

<div class="print-section space-y-6 {!active ? 'hidden print:block' : ''}">
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
					{#each data.page4.assets.current as asset (asset.accountCode)}
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
					{#each data.page4.assets.fixed as asset (asset.accountCode)}
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
							{formatAmount(data.page4.assets.ownerWithdrawal)}
						</td>
					</tr>
				</tbody>
				<tfoot>
					<tr class="border-t-2 border-foreground bg-muted/30 font-bold print:bg-gray-100">
						<td class="px-2 py-1">合計</td>
						<td class="px-2 py-1 text-right font-mono">
							{formatAmount(data.page4.assets.totalBeginning)}
						</td>
						<td class="px-2 py-1 text-right font-mono">
							{formatAmount(data.page4.assets.totalEnding)}
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
					{#each [...data.page4.liabilities.current, ...data.page4.liabilities.fixed] as liability (liability.accountCode)}
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
							{formatAmount(data.page4.equity.ownerDeposit)}
						</td>
					</tr>
					<!-- 元入金 -->
					<tr class="border-b border-muted">
						<td class="px-2 py-0.5">元入金</td>
						<td class="px-2 py-0.5 text-right font-mono text-muted-foreground">
							{formatAmount(data.page4.equity.capital)}
						</td>
						<td class="px-2 py-0.5 text-right font-mono">
							{formatAmount(data.page4.equity.capitalEnding)}
						</td>
					</tr>
					<!-- 青色申告特別控除前の所得金額（短縮表示） -->
					<tr class="border-b border-muted">
						<td class="px-2 py-0.5 text-xs whitespace-nowrap print:text-[8pt]">控除前所得金額</td>
						<td class="px-2 py-0.5 text-right font-mono text-muted-foreground"></td>
						<td class="px-2 py-0.5 text-right font-mono">
							{formatAmount(data.page4.equity.netIncome)}
						</td>
					</tr>
				</tbody>
				<tfoot>
					<tr class="border-t-2 border-foreground bg-muted/30 font-bold print:bg-gray-100">
						<td class="px-2 py-1">合計</td>
						<td class="px-2 py-1 text-right font-mono">
							{formatAmount(data.page4.liabilities.totalBeginning + data.page4.equity.capital)}
						</td>
						<td class="px-2 py-1 text-right font-mono">
							{formatAmount(
								data.page4.liabilities.totalEnding +
									data.page4.equity.ownerDeposit +
									data.page4.equity.capitalEnding +
									data.page4.equity.netIncome
							)}
						</td>
					</tr>
				</tfoot>
			</table>
		</section>
	</div>

	<!-- 貸借バランス確認 -->
	<div
		class="rounded-md p-4 print:mt-4 print:rounded-none print:border print:p-2 {data.page4
			.isBalanced
			? 'bg-green-50 dark:bg-green-950 print:border-green-500'
			: 'bg-red-50 dark:bg-red-950 print:border-red-500'}"
	>
		<p
			class="text-sm font-medium print:text-center {data.page4.isBalanced
				? 'text-green-800 dark:text-green-200'
				: 'text-red-800 dark:text-red-200'}"
		>
			{data.page4.isBalanced ? '貸借バランス: 一致' : '貸借バランス: 不一致（確認が必要です）'}
		</p>
	</div>
</div>
