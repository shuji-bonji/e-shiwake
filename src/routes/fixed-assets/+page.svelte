<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Plus, Download, Package, ExternalLink } from '@lucide/svelte';
	import type {
		FixedAsset,
		FixedAssetCategory,
		DepreciationMethod
	} from '$lib/types/blue-return-types';
	import { initializeDatabase, getAllFixedAssets } from '$lib/db';
	import { generateDepreciationRow } from '$lib/utils/depreciation';
	import FixedAssetFormDialog from '$lib/components/fixed-assets/FixedAssetFormDialog.svelte';
	import FixedAssetTable from '$lib/components/fixed-assets/FixedAssetTable.svelte';
	import FixedAssetDeleteDialog from '$lib/components/fixed-assets/FixedAssetDeleteDialog.svelte';

	// カテゴリラベル（CSV用）
	const categoryLabels: Record<FixedAssetCategory, string> = {
		building: '建物',
		structure: '構築物',
		machinery: '機械装置',
		vehicle: '車両運搬具',
		equipment: '工具器具備品',
		other: 'その他'
	};

	// 償却方法ラベル（CSV用）
	const methodLabels: Record<DepreciationMethod, string> = {
		'straight-line': '定額法',
		'declining-balance': '定率法'
	};

	// 状態
	let assets = $state<FixedAsset[]>([]);
	let isLoading = $state(true);
	let dialogOpen = $state(false);
	let deleteDialogOpen = $state(false);
	let editingAsset = $state<FixedAsset | null>(null);
	let deletingAsset = $state<FixedAsset | null>(null);
	let selectedYear = $state(new Date().getFullYear());

	// アクティブな資産のみフィルタ
	const activeAssets = $derived(assets.filter((a) => a.status === 'active'));

	// 初期化
	onMount(async () => {
		await initializeDatabase();
		await loadAssets();
	});

	async function loadAssets() {
		isLoading = true;
		try {
			assets = await getAllFixedAssets();
		} finally {
			isLoading = false;
		}
	}

	function openAddDialog() {
		editingAsset = null;
		dialogOpen = true;
	}

	function openEditDialog(asset: FixedAsset) {
		editingAsset = asset;
		dialogOpen = true;
	}

	function openDeleteDialog(asset: FixedAsset) {
		deletingAsset = asset;
		deleteDialogOpen = true;
	}

	// 減価償却シミュレーション（CSV用）
	function getDepreciationInfo(asset: FixedAsset) {
		try {
			return generateDepreciationRow(asset, selectedYear);
		} catch {
			return null;
		}
	}

	// CSV出力
	function exportToCsv() {
		const headers = [
			'資産名',
			'カテゴリ',
			'取得日',
			'取得価額',
			'耐用年数',
			'償却方法',
			'償却率',
			'事業専用割合',
			'本年分の償却費',
			'本年分の必要経費算入額',
			'期末帳簿価額',
			'メモ'
		];

		const rows = activeAssets.map((asset) => {
			const depInfo = getDepreciationInfo(asset);
			return [
				asset.name,
				categoryLabels[asset.category],
				asset.acquisitionDate,
				asset.acquisitionCost,
				asset.usefulLife,
				methodLabels[asset.depreciationMethod],
				asset.depreciationRate,
				`${asset.businessRatio}%`,
				depInfo?.currentYearDepreciation ?? 0,
				depInfo?.businessDepreciation ?? 0,
				depInfo?.bookValue ?? 0,
				asset.memo ?? ''
			].join(',');
		});

		const csv = [headers.join(','), ...rows].join('\n');
		const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `固定資産台帳_${selectedYear}年.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<div class="space-y-6">
	<!-- ヘッダー -->
	<div
		class="sticky top-14 z-10 -mx-4 flex flex-wrap items-center justify-between gap-4 border-b bg-background px-4 pt-4 pb-3 group-has-data-[collapsible=icon]/sidebar-wrapper:top-12"
	>
		<div>
			<h1 class="text-2xl font-bold">固定資産台帳</h1>
			<p class="text-sm text-muted-foreground">減価償却資産の管理と償却費計算を行います</p>
		</div>
		<div class="flex items-center gap-2">
			<Select.Root
				type="single"
				value={selectedYear.toString()}
				onValueChange={(v) => v && (selectedYear = parseInt(v))}
			>
				<Select.Trigger class="w-32">
					{selectedYear}年
				</Select.Trigger>
				<Select.Content>
					{#each Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i) as year (year)}
						<Select.Item value={year.toString()}>{year}年</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
			<Button variant="outline" onclick={exportToCsv} disabled={activeAssets.length === 0}>
				<Download class="mr-2 size-4" />
				CSV出力
			</Button>
			<Button onclick={openAddDialog}>
				<Plus class="mr-2 size-4" />
				資産を追加
			</Button>
		</div>
	</div>

	{#if isLoading}
		<div class="flex items-center justify-center py-8">
			<p class="text-muted-foreground">読み込み中...</p>
		</div>
	{:else if activeAssets.length === 0}
		<div
			class="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12"
		>
			<Package class="size-12 text-muted-foreground" />
			<div class="text-center">
				<p class="text-lg font-medium">固定資産がありません</p>
				<p class="text-sm text-muted-foreground">
					「資産を追加」ボタンから固定資産を登録してください
				</p>
			</div>
			<Button onclick={openAddDialog}>
				<Plus class="mr-2 size-4" />
				資産を追加
			</Button>
		</div>
	{:else}
		<FixedAssetTable
			assets={activeAssets}
			{selectedYear}
			onedit={openEditDialog}
			ondelete={openDeleteDialog}
		/>
	{/if}

	<!-- 参考資料リンク -->
	<div class="mt-8 rounded-lg border border-dashed p-4 print:hidden">
		<h3 class="mb-2 text-sm font-medium text-muted-foreground">参考資料</h3>
		<ul class="space-y-1 text-sm">
			<li>
				<a
					href="https://github.com/shuji-bonji/Note-on-bookkeeping/blob/main/blue-tax-return/closing-entries.md"
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center gap-1 text-primary hover:underline"
				>
					決算整理仕訳（減価償却）
					<ExternalLink class="size-3" />
				</a>
			</li>
		</ul>
	</div>
</div>

<!-- 追加/編集ダイアログ -->
<FixedAssetFormDialog bind:open={dialogOpen} {editingAsset} onsave={loadAssets} />

<!-- 削除確認ダイアログ -->
<FixedAssetDeleteDialog bind:open={deleteDialogOpen} asset={deletingAsset} ondelete={loadAssets} />
