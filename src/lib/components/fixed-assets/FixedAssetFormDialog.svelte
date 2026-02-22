<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { addFixedAsset, updateFixedAsset } from '$lib/db';
	import type {
		DepreciationMethod,
		FixedAsset,
		FixedAssetCategory
	} from '$lib/types/blue-return-types';
	import { getDepreciationRate } from '$lib/utils/depreciation';

	// カテゴリラベル
	const categoryLabels: Record<FixedAssetCategory, string> = {
		building: '建物',
		structure: '構築物',
		machinery: '機械装置',
		vehicle: '車両運搬具',
		equipment: '工具器具備品',
		other: 'その他'
	};

	// 償却方法ラベル
	const methodLabels: Record<DepreciationMethod, string> = {
		'straight-line': '定額法',
		'declining-balance': '定率法'
	};

	interface Props {
		open: boolean;
		editingAsset: FixedAsset | null;
		onsave: () => void;
	}

	let { open = $bindable(), editingAsset, onsave }: Props = $props();

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

	// ダイアログが開いた時にフォームを初期化
	$effect(() => {
		if (open) {
			if (editingAsset) {
				formName = editingAsset.name;
				formCategory = editingAsset.category;
				formAcquisitionDate = editingAsset.acquisitionDate;
				formAcquisitionCost = editingAsset.acquisitionCost;
				formUsefulLife = editingAsset.usefulLife;
				formDepreciationMethod = editingAsset.depreciationMethod;
				formBusinessRatio = editingAsset.businessRatio;
				formMemo = editingAsset.memo ?? '';
			} else {
				formName = '';
				formCategory = 'equipment';
				formAcquisitionDate = new Date().toISOString().split('T')[0];
				formAcquisitionCost = 0;
				formUsefulLife = 4;
				formDepreciationMethod = 'straight-line';
				formBusinessRatio = 100;
				formMemo = '';
			}
			formError = '';
		}
	});

	async function handleSubmit() {
		formError = '';

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
			open = false;
			onsave();
		} catch (error) {
			formError = error instanceof Error ? error.message : '保存に失敗しました';
		}
	}
</script>

<Dialog.Root bind:open>
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
				<Button type="button" variant="outline" onclick={() => (open = false)}>キャンセル</Button>
				<Button type="submit">
					{editingAsset ? '更新' : '追加'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
