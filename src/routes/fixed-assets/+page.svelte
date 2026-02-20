<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import {
		Plus,
		Pencil,
		Trash2,
		Download,
		Building2,
		Car,
		Laptop,
		Wrench,
		Package,
		ExternalLink
	} from '@lucide/svelte';
	import type {
		FixedAsset,
		FixedAssetCategory,
		DepreciationMethod
	} from '$lib/types/blue-return-types';
	import {
		initializeDatabase,
		getAllFixedAssets,
		addFixedAsset,
		updateFixedAsset,
		deleteFixedAsset
	} from '$lib/db';
	import { getDepreciationRate, generateDepreciationRow } from '$lib/utils/depreciation';
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

	// 状態
	let assets = $state<FixedAsset[]>([]);
	let isLoading = $state(true);
	let dialogOpen = $state(false);
	let deleteDialogOpen = $state(false);
	let editingAsset = $state<FixedAsset | null>(null);
	let deletingAsset = $state<FixedAsset | null>(null);
	let selectedYear = $state(new Date().getFullYear());

	// フォーム状態
	let formName = $state('');
	let formCategory = $state<FixedAssetCategory>('equipment');
	let formAcquisitionDate = $state('');
	let formAcquisitionCost = $state(0);
	let formUsefulLife = $state(4);
	let formDepreciationMethod = $state<DepreciationMethod>('straight-line');
	let formBusinessRatio = $state(100);
	let formMemo = $state('');
	let formError = $state('');

	// 償却率の自動計算
	const calculatedRate = $derived(getDepreciationRate(formDepreciationMethod, formUsefulLife));

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
		formName = '';
		formCategory = 'equipment';
		formAcquisitionDate = new Date().toISOString().split('T')[0];
		formAcquisitionCost = 0;
		formUsefulLife = 4;
		formDepreciationMethod = 'straight-line';
		formBusinessRatio = 100;
		formMemo = '';
		formError = '';
		dialogOpen = true;
	}

	function openEditDialog(asset: FixedAsset) {
		editingAsset = asset;
		formName = asset.name;
		formCategory = asset.category;
		formAcquisitionDate = asset.acquisitionDate;
		formAcquisitionCost = asset.acquisitionCost;
		formUsefulLife = asset.usefulLife;
		formDepreciationMethod = asset.depreciationMethod;
		formBusinessRatio = asset.businessRatio;
		formMemo = asset.memo ?? '';
		formError = '';
		dialogOpen = true;
	}

	function openDeleteDialog(asset: FixedAsset) {
		deletingAsset = asset;
		deleteDialogOpen = true;
	}

	async function handleSubmit() {
		formError = '';

		// バリデーション
		if (!formName.trim()) {
			formError = '資産名を入力してください';
			return;
		}
		if (!formAcquisitionDate) {
			formError = '取得日を入力してください';
			return;
		}
		if (formAcquisitionCost <= 0) {
			formError = '取得価額は0より大きい値を入力してください';
			return;
		}
		if (formUsefulLife < 1) {
			formError = '耐用年数は1以上を入力してください';
			return;
		}
		if (formBusinessRatio < 0 || formBusinessRatio > 100) {
			formError = '事業専用割合は0〜100の範囲で入力してください';
			return;
		}

		try {
			if (editingAsset) {
				await updateFixedAsset(editingAsset.id, {
					name: formName.trim(),
					category: formCategory,
					acquisitionDate: formAcquisitionDate,
					acquisitionCost: formAcquisitionCost,
					usefulLife: formUsefulLife,
					depreciationMethod: formDepreciationMethod,
					depreciationRate: calculatedRate,
					businessRatio: formBusinessRatio,
					memo: formMemo.trim() || undefined
				});
			} else {
				await addFixedAsset({
					name: formName.trim(),
					category: formCategory,
					acquisitionDate: formAcquisitionDate,
					acquisitionCost: formAcquisitionCost,
					usefulLife: formUsefulLife,
					depreciationMethod: formDepreciationMethod,
					depreciationRate: calculatedRate,
					businessRatio: formBusinessRatio,
					status: 'active',
					memo: formMemo.trim() || undefined
				});
			}
			dialogOpen = false;
			await loadAssets();
		} catch (error) {
			formError = error instanceof Error ? error.message : '保存に失敗しました';
		}
	}

	async function handleDelete() {
		if (!deletingAsset) return;

		try {
			await deleteFixedAsset(deletingAsset.id);
			deleteDialogOpen = false;
			deletingAsset = null;
			await loadAssets();
		} catch (error) {
			console.error('Delete failed:', error);
		}
	}

	// 減価償却シミュレーション
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
		<!-- 資産一覧テーブル -->
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
					{#each activeAssets as asset (asset.id)}
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
										onclick={() => openEditDialog(asset)}
										title="編集"
									>
										<Pencil class="size-4" />
									</button>
									<button
										type="button"
										class="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
										onclick={() => openDeleteDialog(asset)}
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
								activeAssets.reduce((sum, a) => {
									const info = getDepreciationInfo(a);
									return sum + (info?.businessDepreciation ?? 0);
								}, 0)
							)}
						</td>
						<td class="px-4 py-3 text-right font-mono font-medium">
							{formatAmount(
								activeAssets.reduce((sum, a) => {
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
<Dialog.Root bind:open={dialogOpen}>
	<Dialog.Content class="max-h-[90vh] overflow-y-auto sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>
				{editingAsset ? '固定資産を編集' : '固定資産を追加'}
			</Dialog.Title>
			<Dialog.Description>
				{editingAsset ? '固定資産の情報を編集します' : '新しい固定資産を登録します'}
			</Dialog.Description>
		</Dialog.Header>
		<form
			class="space-y-4"
			onsubmit={(e) => {
				e.preventDefault();
				handleSubmit();
			}}
		>
			<div class="space-y-2">
				<Label for="name">資産名</Label>
				<Input id="name" bind:value={formName} placeholder="例: MacBook Pro" />
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-2">
					<Label for="category">カテゴリ</Label>
					<Select.Root
						type="single"
						value={formCategory}
						onValueChange={(v) => v && (formCategory = v as FixedAssetCategory)}
					>
						<Select.Trigger class="w-full">
							{categoryLabels[formCategory]}
						</Select.Trigger>
						<Select.Content>
							{#each Object.entries(categoryLabels) as [value, label] (value)}
								<Select.Item {value}>{label}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
				<div class="space-y-2">
					<Label for="acquisitionDate">取得日</Label>
					<Input id="acquisitionDate" type="date" bind:value={formAcquisitionDate} />
				</div>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-2">
					<Label for="acquisitionCost">取得価額</Label>
					<div class="relative">
						<Input
							id="acquisitionCost"
							type="number"
							bind:value={formAcquisitionCost}
							min={0}
							class="pr-8"
						/>
						<span class="absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground"
							>円</span
						>
					</div>
				</div>
				<div class="space-y-2">
					<Label for="usefulLife">耐用年数</Label>
					<div class="relative">
						<Input
							id="usefulLife"
							type="number"
							bind:value={formUsefulLife}
							min={1}
							max={50}
							class="pr-8"
						/>
						<span class="absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground"
							>年</span
						>
					</div>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-2">
					<Label for="depreciationMethod">償却方法</Label>
					<Select.Root
						type="single"
						value={formDepreciationMethod}
						onValueChange={(v) => v && (formDepreciationMethod = v as DepreciationMethod)}
					>
						<Select.Trigger class="w-full">
							{methodLabels[formDepreciationMethod]}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="straight-line">定額法</Select.Item>
							<Select.Item value="declining-balance">定率法</Select.Item>
						</Select.Content>
					</Select.Root>
				</div>
				<div class="space-y-2">
					<Label for="depreciationRate">償却率</Label>
					<Input
						id="depreciationRate"
						value={calculatedRate.toFixed(3)}
						disabled
						class="bg-muted"
					/>
					<p class="text-xs text-muted-foreground">耐用年数と償却方法から自動計算</p>
				</div>
			</div>

			<div class="space-y-2">
				<Label for="businessRatio">事業専用割合</Label>
				<div class="flex items-center gap-2">
					<Input
						id="businessRatio"
						type="number"
						bind:value={formBusinessRatio}
						min={0}
						max={100}
						class="w-24"
					/>
					<span class="text-sm text-muted-foreground">%</span>
				</div>
				<p class="text-xs text-muted-foreground">
					事業で使用している割合。100%未満の場合、償却費は按分されます
				</p>
			</div>

			<div class="space-y-2">
				<Label for="memo">メモ（任意）</Label>
				<Input id="memo" bind:value={formMemo} placeholder="例: シリアル番号、設置場所など" />
			</div>

			{#if formError}
				<p class="text-sm text-destructive">{formError}</p>
			{/if}

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (dialogOpen = false)}>
					キャンセル
				</Button>
				<Button type="submit">
					{editingAsset ? '更新' : '追加'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- 削除確認ダイアログ -->
<Dialog.Root bind:open={deleteDialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>固定資産を削除</Dialog.Title>
			<Dialog.Description>
				{#if deletingAsset}
					「{deletingAsset.name}」を削除しますか？ この操作は取り消せません。
				{/if}
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (deleteDialogOpen = false)}>キャンセル</Button>
			<Button variant="destructive" onclick={handleDelete}>削除</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
