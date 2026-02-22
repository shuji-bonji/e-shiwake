<script lang="ts">
	import { Pencil, Trash2, Building2, Car, Laptop, Wrench, Package } from '@lucide/svelte';
	import type {
		FixedAsset,
		FixedAssetCategory,
		DepreciationMethod
	} from '$lib/types/blue-return-types';
	import type { DepreciationAssetRow } from '$lib/types/blue-return-types';
	import { generateDepreciationRow } from '$lib/utils/depreciation';
	import { formatAmount } from '$lib/utils/blue-return';

	// カテゴリラベル
	const categoryLabels: Record<FixedAssetCategory, string> = {
		building: '建物',
		structure: '構築物',
		machinery: '機械装置',
		vehicle: '車両運搬具',
		equipment: '工具器具備品',
		other: 'その他'
	};

	// カテゴリアイコン
	const categoryIcons: Record<FixedAssetCategory, typeof Building2> = {
		building: Building2,
		structure: Package,
		machinery: Wrench,
		vehicle: Car,
		equipment: Laptop,
		other: Package
	};

	// 償却方法ラベル
	const methodLabels: Record<DepreciationMethod, string> = {
		'straight-line': '定額法',
		'declining-balance': '定率法'
	};

	interface Props {
		assets: FixedAsset[];
		selectedYear: number;
		onedit: (asset: FixedAsset) => void;
		ondelete: (asset: FixedAsset) => void;
	}

	let { assets, selectedYear, onedit, ondelete }: Props = $props();

	// 減価償却シミュレーション
	function getDepreciationInfo(asset: FixedAsset): DepreciationAssetRow | null {
		try {
			return generateDepreciationRow(asset, selectedYear);
		} catch {
			return null;
		}
	}
</script>

<div class="overflow-x-auto rounded-lg border">
	<table class="w-full text-sm">
		<thead class="border-b bg-muted/50">
			<tr>
				<th class="px-4 py-3 text-left font-medium">資産名</th>
				<th class="px-4 py-3 text-left font-medium">取得日</th>
				<th class="px-4 py-3 text-right font-medium">取得価額</th>
				<th class="px-4 py-3 text-center font-medium">耐用年数</th>
				<th class="px-4 py-3 text-center font-medium">償却方法</th>
				<th class="px-4 py-3 text-right font-medium">本年償却費</th>
				<th class="px-4 py-3 text-right font-medium">期末帳簿価額</th>
				<th class="px-4 py-3 text-center font-medium">操作</th>
			</tr>
		</thead>
		<tbody>
			{#each assets as asset (asset.id)}
				{@const depInfo = getDepreciationInfo(asset)}
				{@const Icon = categoryIcons[asset.category]}
				<tr class="border-b hover:bg-muted/30">
					<td class="px-4 py-3">
						<div class="flex items-center gap-2">
							<Icon class="size-4 text-muted-foreground" />
							<div>
								<div class="font-medium">{asset.name}</div>
								<div class="text-xs text-muted-foreground">
									{categoryLabels[asset.category]}
								</div>
							</div>
						</div>
					</td>
					<td class="px-4 py-3 text-muted-foreground">{asset.acquisitionDate}</td>
					<td class="px-4 py-3 text-right font-mono">{formatAmount(asset.acquisitionCost)}</td>
					<td class="px-4 py-3 text-center">{asset.usefulLife}年</td>
					<td class="px-4 py-3 text-center">
						<span class="rounded bg-muted px-2 py-0.5 text-xs">
							{methodLabels[asset.depreciationMethod]}
						</span>
					</td>
					<td class="px-4 py-3 text-right font-mono">
						{#if depInfo}
							{formatAmount(depInfo.businessDepreciation)}
						{:else}
							-
						{/if}
					</td>
					<td class="px-4 py-3 text-right font-mono">
						{#if depInfo}
							{formatAmount(depInfo.bookValue)}
						{:else}
							-
						{/if}
					</td>
					<td class="px-4 py-3">
						<div class="flex items-center justify-center gap-1">
							<button
								type="button"
								class="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
								onclick={() => onedit(asset)}
								title="編集"
							>
								<Pencil class="size-4" />
							</button>
							<button
								type="button"
								class="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
								onclick={() => ondelete(asset)}
								title="削除"
							>
								<Trash2 class="size-4" />
							</button>
						</div>
					</td>
				</tr>
			{/each}
		</tbody>
		<tfoot class="border-t bg-muted/30">
			<tr>
				<td colspan="5" class="px-4 py-3 text-right font-medium">合計</td>
				<td class="px-4 py-3 text-right font-mono font-medium">
					{formatAmount(
						assets.reduce((sum, a) => {
							const info = getDepreciationInfo(a);
							return sum + (info?.businessDepreciation ?? 0);
						}, 0)
					)}
				</td>
				<td class="px-4 py-3 text-right font-mono font-medium">
					{formatAmount(
						assets.reduce((sum, a) => {
							const info = getDepreciationInfo(a);
							return sum + (info?.bookValue ?? 0);
						}, 0)
					)}
				</td>
				<td></td>
			</tr>
		</tfoot>
	</table>
</div>
