<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Percent, Check, X } from '@lucide/svelte';
	import type { JournalLine, Account } from '$lib/types';
	import {
		calculateBusinessRatioPreview,
		getBusinessRatioTargetLine,
		hasBusinessRatioApplied,
		getAppliedBusinessRatio
	} from '$lib/utils/business-ratio';
	import { cn } from '$lib/utils.js';

	interface Props {
		lines: JournalLine[];
		accounts: Account[];
		onapply: (targetLineIndex: number, businessRatio: number) => void;
		onremove: () => void;
		class?: string;
	}

	let { lines, accounts, onapply, onremove, class: className }: Props = $props();

	// 按分対象行を取得
	const targetInfo = $derived(getBusinessRatioTargetLine(lines, accounts));

	// 既に按分適用済みか
	const isApplied = $derived(hasBusinessRatioApplied(lines));

	// 適用済みの按分率
	const appliedRatio = $derived(getAppliedBusinessRatio(lines));

	// デフォルトの按分率（適用済みまたは勘定科目のデフォルト）
	const defaultRatio = $derived.by(() => {
		if (appliedRatio !== null) {
			return appliedRatio;
		}
		if (targetInfo?.account.defaultBusinessRatio !== undefined) {
			return targetInfo.account.defaultBusinessRatio;
		}
		return 50;
	});

	// ターゲットのキー（勘定科目コード）- 変更検知用
	const targetKey = $derived(targetInfo?.account.code ?? '');

	// ユーザーが編集した按分率とそのキー
	let editState = $state<{ key: string; ratio: number | null }>({ key: '', ratio: null });

	// キーが変わったらリセット
	const userEditedRatio = $derived(editState.key === targetKey ? editState.ratio : null);

	// 入力中の按分率（ユーザー編集があればそれを、なければデフォルト）
	const inputRatio = $derived(userEditedRatio ?? defaultRatio);

	// ユーザーの入力を処理
	function handleRatioChange(value: number) {
		editState = { key: targetKey, ratio: value };
	}

	// プレビュー計算
	const preview = $derived(
		targetInfo ? calculateBusinessRatioPreview(targetInfo.line.amount, inputRatio) : null
	);

	// 適用ハンドラ
	function handleApply() {
		if (targetInfo) {
			onapply(targetInfo.index, inputRatio);
		}
	}

	// 解除ハンドラ
	function handleRemove() {
		onremove();
	}
</script>

{#if targetInfo || isApplied}
	<div
		class={cn(
			'mt-2 flex flex-wrap items-center gap-2 rounded border border-dashed border-amber-500/50 bg-amber-50 p-2 text-sm dark:bg-amber-900/20',
			className
		)}
	>
		<Percent class="size-4 shrink-0 text-amber-600" />

		{#if isApplied}
			<!-- 按分適用済み表示 -->
			<span class="text-amber-700 dark:text-amber-300">
				家事按分 {appliedRatio}% 適用中
			</span>
			<Button variant="outline" size="sm" class="ml-auto h-7 gap-1 text-xs" onclick={handleRemove}>
				<X class="size-3" />
				按分解除
			</Button>
		{:else if targetInfo}
			<!-- 按分設定入力 -->
			<span class="shrink-0 text-amber-700 dark:text-amber-300">
				{targetInfo.account.name}
			</span>

			<div class="flex items-center gap-1">
				<Input
					type="number"
					value={inputRatio}
					oninput={(e) => handleRatioChange(Number(e.currentTarget.value))}
					min={0}
					max={100}
					class="h-7 w-14 text-right text-sm"
				/>
				<span class="text-muted-foreground">%</span>
			</div>

			{#if preview}
				<span class="text-xs text-muted-foreground">
					事業 {preview.businessAmount.toLocaleString('ja-JP')}円 / 家事 {preview.personalAmount.toLocaleString(
						'ja-JP'
					)}円
				</span>
			{/if}

			<Button variant="default" size="sm" class="ml-auto h-7 gap-1 text-xs" onclick={handleApply}>
				<Check class="size-3" />
				按分適用
			</Button>
		{/if}
	</div>
{/if}
