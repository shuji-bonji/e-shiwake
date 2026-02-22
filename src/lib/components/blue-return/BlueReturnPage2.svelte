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
				{#each data.page2.monthlySales as monthly (monthly.month)}
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
						>{formatAmount(data.page2.monthlySalesTotal)}</td
					>
					<td class="px-3 py-2 text-right font-mono font-medium"
						>{formatAmount(data.page2.monthlyPurchasesTotal)}</td
					>
				</tr>
			</tfoot>
		</table>
	</div>

	<div class="grid grid-cols-2 gap-4 text-sm">
		<div>雑収入</div>
		<div class="text-right font-mono">{formatAmount(data.page2.miscIncome)}</div>
		<div>給料賃金</div>
		<div class="text-right font-mono">{formatAmount(data.page2.salaryTotal)}</div>
		<div>地代家賃</div>
		<div class="text-right font-mono">{formatAmount(data.page2.rentTotal)}</div>
	</div>
</div>
