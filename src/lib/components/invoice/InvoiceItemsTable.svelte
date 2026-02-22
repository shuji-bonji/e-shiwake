<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Plus, Trash2 } from '@lucide/svelte';
	import type { InvoiceItem } from '$lib/types/invoice';
	import { calculateItemAmount, createEmptyInvoiceItem, formatCurrency } from '$lib/utils/invoice';

	interface Props {
		items: InvoiceItem[];
		onchange: () => void;
	}

	let { items = $bindable(), onchange }: Props = $props();

	function addItem() {
		items = [...items, createEmptyInvoiceItem()];
		onchange();
	}

	function removeItem(index: number) {
		items = items.filter((_, i) => i !== index);
		onchange();
	}

	function updateItemAmount(index: number) {
		const item = items[index];
		item.amount = calculateItemAmount(item.quantity, item.unitPrice);
		items = [...items];
		onchange();
	}
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<Label>明細</Label>
		<Button variant="outline" size="sm" onclick={addItem}>
			<Plus class="mr-2 size-4" />
			行を追加
		</Button>
	</div>

	{#if items.length === 0}
		<div class="rounded-md border border-dashed p-8 text-center text-muted-foreground">
			<p>明細行がありません</p>
			<Button variant="outline" size="sm" class="mt-2" onclick={addItem}>
				<Plus class="mr-2 size-4" />
				行を追加
			</Button>
		</div>
	{:else}
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b text-left text-muted-foreground">
						<th class="w-24 pr-2 pb-2">日付</th>
						<th class="min-w-50 pr-2 pb-2">品名・サービス名</th>
						<th class="w-28 pr-2 pb-2 text-right">単価</th>
						<th class="w-16 pr-2 pb-2 text-right">数量</th>
						<th class="w-20 pr-2 pb-2 text-center">税率</th>
						<th class="min-w-25 pr-2 pb-2 text-right">金額</th>
						<th class="w-10 pb-2"></th>
					</tr>
				</thead>
				<tbody>
					{#each items as item, index (item.id)}
						<tr class="border-b">
							<td class="py-2 pr-2">
								<Input
									bind:value={item.date}
									placeholder="1月分"
									class="w-24"
									oninput={() => onchange()}
								/>
							</td>
							<td class="py-2 pr-2">
								<Input
									bind:value={item.description}
									placeholder="サービス名"
									class="min-w-50"
									oninput={() => onchange()}
								/>
							</td>
							<td class="py-2 pr-2">
								<Input
									type="number"
									bind:value={item.unitPrice}
									min="0"
									class="w-28 text-right"
									onchange={() => updateItemAmount(index)}
								/>
							</td>
							<td class="py-2 pr-2">
								<Input
									type="number"
									bind:value={item.quantity}
									min="0"
									step="0.01"
									class="w-16 text-right"
									onchange={() => updateItemAmount(index)}
								/>
							</td>
							<td class="py-2 pr-2">
								<Select.Root
									type="single"
									value={String(item.taxRate)}
									onValueChange={(v) => {
										item.taxRate = Number(v) as 10 | 8;
										items = [...items];
										onchange();
									}}
								>
									<Select.Trigger class="w-20">
										{item.taxRate}%
									</Select.Trigger>
									<Select.Content>
										<Select.Item value="10">10%</Select.Item>
										<Select.Item value="8">8%</Select.Item>
									</Select.Content>
								</Select.Root>
							</td>
							<td class="min-w-25 py-2 pr-2 text-right font-medium">
								¥{formatCurrency(item.amount)}
							</td>
							<td class="py-2">
								<Button variant="ghost" size="icon" onclick={() => removeItem(index)}>
									<Trash2 class="size-4" />
								</Button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
