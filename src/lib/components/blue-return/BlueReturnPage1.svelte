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
	<h2 class="border-b pb-2 text-lg font-bold">損益計算書</h2>

	<!-- 売上 -->
	<div class="space-y-2">
		<h3 class="font-medium text-muted-foreground">売上（収入）金額</h3>
		<div class="grid grid-cols-2 gap-4 pl-4">
			<div>売上（収入）金額</div>
			<div class="text-right font-mono">{formatAmount(data.page1.salesTotal)}</div>
		</div>
	</div>

	<!-- 売上原価 -->
	<div class="space-y-2">
		<h3 class="font-medium text-muted-foreground">売上原価</h3>
		<div class="grid grid-cols-2 gap-4 pl-4 text-sm">
			<div>期首商品棚卸高</div>
			<div class="text-right font-mono">{formatAmount(data.page1.inventoryStart)}</div>
			<div>仕入金額</div>
			<div class="text-right font-mono">{formatAmount(data.page1.purchases)}</div>
			<div>期末商品棚卸高</div>
			<div class="text-right font-mono">{formatAmount(data.page1.inventoryEnd)}</div>
			<div class="font-medium">差引原価</div>
			<div class="text-right font-mono font-medium">
				{formatAmount(data.page1.costOfSales)}
			</div>
		</div>
	</div>

	<!-- 差引金額 -->
	<div class="grid grid-cols-2 gap-4 rounded-md bg-muted/50 p-3">
		<div class="font-medium">差引金額（売上総利益）</div>
		<div class="text-right font-mono font-medium">
			{formatAmount(data.page1.grossProfit)}
		</div>
	</div>

	<!-- 経費 -->
	<div class="space-y-2">
		<h3 class="font-medium text-muted-foreground">経費</h3>
		<div class="grid grid-cols-2 gap-2 pl-4 text-sm">
			{#each data.page1.expenses as expense (expense.code)}
				<div>{expense.name}</div>
				<div class="text-right font-mono">{formatAmount(expense.amount)}</div>
			{/each}
		</div>
		<div class="grid grid-cols-2 gap-4 border-t pt-2 pl-4">
			<div class="font-medium">経費合計</div>
			<div class="text-right font-mono font-medium">
				{formatAmount(data.page1.expensesTotal)}
			</div>
		</div>
	</div>

	<!-- 差引金額 -->
	<div class="grid grid-cols-2 gap-4 rounded-md bg-muted/50 p-3">
		<div class="font-medium">差引金額</div>
		<div class="text-right font-mono font-medium">
			{formatAmount(data.page1.operatingProfit)}
		</div>
	</div>

	<!-- 所得金額 -->
	<div class="space-y-2">
		<h3 class="font-medium text-muted-foreground">所得金額の計算</h3>
		<div class="grid grid-cols-2 gap-4 pl-4 text-sm">
			<div>専従者給与</div>
			<div class="text-right font-mono">
				{formatAmount(data.page1.specialDeduction)}
			</div>
			<div>青色申告特別控除前の所得金額</div>
			<div class="text-right font-mono">
				{formatAmount(data.page1.netIncomeBeforeDeduction)}
			</div>
			<div>青色申告特別控除額</div>
			<div class="text-right font-mono">
				{formatAmount(data.page1.blueReturnDeduction)}
			</div>
		</div>
	</div>

	<div class="grid grid-cols-2 gap-4 rounded-md bg-primary/10 p-4">
		<div class="text-lg font-bold">所得金額</div>
		<div class="text-right font-mono text-lg font-bold">
			{formatAmount(data.page1.businessIncome)}
		</div>
	</div>
</div>
