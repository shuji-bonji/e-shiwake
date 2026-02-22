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
	<h2 class="border-b pb-2 text-lg font-bold">減価償却費の計算</h2>

	{#if data.page3.assets.length === 0}
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
					{#each data.page3.assets as asset (asset.assetName)}
						<tr class="border-b">
							<td class="px-2 py-2">{asset.assetName}</td>
							<td class="px-2 py-2">{asset.acquisitionDate}</td>
							<td class="px-2 py-2 text-right font-mono">{formatAmount(asset.acquisitionCost)}</td>
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
							>{formatAmount(data.page3.totalDepreciation)}</td
						>
						<td class="px-2 py-2 text-right font-mono font-medium"
							>{formatAmount(data.page3.totalBusinessDepreciation)}</td
						>
						<td></td>
					</tr>
				</tfoot>
			</table>
		</div>
	{/if}
</div>
