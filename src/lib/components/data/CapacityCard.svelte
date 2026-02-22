<script lang="ts">
	import SafariStorageDialog from '$lib/components/SafariStorageDialog.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import { purgeAllExportedBlobs, setAutoPurgeBlobSetting } from '$lib/db';
	import type { StorageType, StorageUsage } from '$lib/types';
	import {
		formatBytes,
		getRecommendedUsagePercentage,
		getStorageUsage,
		RECOMMENDED_QUOTA,
		WARNING_THRESHOLD
	} from '$lib/utils/storage';
	import { AlertTriangle, HardDrive, RotateCcw, Trash2 } from '@lucide/svelte';

	interface Props {
		storageMode: StorageType;
		isFileSystemSupported: boolean;
		storageUsage: StorageUsage;
		autoPurgeEnabled: boolean;
		retentionDays: number;
	}

	let {
		storageMode,
		isFileSystemSupported,
		storageUsage = $bindable(),
		autoPurgeEnabled = $bindable(),
		retentionDays
	}: Props = $props();

	let isPurging = $state(false);
	let purgeResult = $state<string | null>(null);
	let purgeDialogOpen = $state(false);
	let safariDialogOpen = $state(false);

	const recommendedPercentage = $derived(getRecommendedUsagePercentage(storageUsage.used));
	const isStorageWarning = $derived(recommendedPercentage >= WARNING_THRESHOLD);

	async function handleAutoPurgeChange(enabled: boolean) {
		autoPurgeEnabled = enabled;
		await setAutoPurgeBlobSetting(enabled);
	}

	async function handlePurgeExportedBlobs() {
		purgeDialogOpen = true;
	}

	async function handleConfirmPurge() {
		purgeDialogOpen = false;
		isPurging = true;
		purgeResult = null;
		try {
			const count = await purgeAllExportedBlobs();
			if (count > 0) {
				purgeResult = `${count}件の証憑データを削除しました`;
				storageUsage = await getStorageUsage();
			} else {
				purgeResult = '削除可能なデータがありません';
			}
		} catch (error) {
			purgeResult = `エラー: ${error instanceof Error ? error.message : '不明なエラー'}`;
		} finally {
			isPurging = false;
		}
	}

	function handleResetSafariWarning() {
		localStorage.removeItem('shownStorageWarning');
		safariDialogOpen = true;
	}
</script>

{#if storageMode === 'indexeddb' || !isFileSystemSupported}
	<Card.Root>
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<HardDrive class="size-5" />
				ストレージ使用量
			</Card.Title>
			<Card.Description>ブラウザに保存されている証憑データの容量を管理します</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-6">
			<div class="space-y-2">
				<div class="flex items-center justify-between text-sm">
					<span>使用中: {formatBytes(storageUsage.used)}</span>
					<span>推奨上限: {formatBytes(RECOMMENDED_QUOTA)}</span>
				</div>
				<div class="h-3 w-full overflow-hidden rounded-full bg-muted">
					<div
						class="h-full transition-all duration-300 {isStorageWarning
							? 'bg-amber-500'
							: 'bg-primary'}"
						style="width: {Math.min(recommendedPercentage, 100)}%"
					></div>
				</div>
				<p class="text-sm text-muted-foreground">
					{recommendedPercentage.toFixed(0)}% 使用中
					{#if storageUsage.quota > 0}
						（ブラウザ上限: {formatBytes(storageUsage.quota)}）
					{/if}
				</p>
			</div>

			{#if isStorageWarning}
				<div
					class="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950"
				>
					<AlertTriangle class="size-5 shrink-0 text-amber-500" />
					<div>
						<p class="font-medium text-amber-800 dark:text-amber-200">
							ストレージ使用量が多くなっています
						</p>
						<p class="text-sm text-amber-700 dark:text-amber-300">
							エクスポートしてから古いデータを削除すると容量を確保できます。
						</p>
					</div>
				</div>
			{/if}

			<div class="flex items-center justify-between rounded-lg border p-4">
				<div class="space-y-0.5">
					<Label for="auto-purge" class="font-medium">エクスポート後に自動削除</Label>
					<p class="text-sm text-muted-foreground">
						エクスポートから{retentionDays}日後に証憑データを削除します
					</p>
				</div>
				<Switch
					id="auto-purge"
					checked={autoPurgeEnabled}
					onCheckedChange={handleAutoPurgeChange}
				/>
			</div>

			<div class="flex items-center justify-between">
				<div>
					<p class="font-medium">エクスポート済みデータを削除</p>
					<p class="text-sm text-muted-foreground">
						エクスポート済みの証憑データを削除して容量を確保します
					</p>
				</div>
				<Button
					variant="destructive"
					size="sm"
					onclick={handlePurgeExportedBlobs}
					disabled={isPurging}
				>
					<Trash2 class="mr-2 size-4" />
					{isPurging ? '削除中...' : '削除'}
				</Button>
			</div>
			{#if purgeResult}
				<p class="text-sm text-muted-foreground">{purgeResult}</p>
			{/if}

			<div class="flex items-center justify-between border-t pt-6">
				<div>
					<p class="font-medium">ブラウザ保存の説明を再表示</p>
					<p class="text-sm text-muted-foreground">
						Safari / iPad向けのストレージ説明を再度表示します
					</p>
				</div>
				<Button variant="outline" size="sm" onclick={handleResetSafariWarning}>
					<RotateCcw class="mr-2 size-4" />
					再表示
				</Button>
			</div>
		</Card.Content>
	</Card.Root>
{/if}

<!-- Safari向け説明ダイアログ -->
<SafariStorageDialog
	open={safariDialogOpen}
	onclose={() => (safariDialogOpen = false)}
	onconfirm={() => (safariDialogOpen = false)}
/>

<!-- 証憑パージ確認ダイアログ -->
<AlertDialog.Root bind:open={purgeDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>エクスポート済み証憑の削除</AlertDialog.Title>
			<AlertDialog.Description>
				エクスポート済みの証憑データを削除しますか？メタデータは残りますが、PDFファイルは復元できなくなります。
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>キャンセル</AlertDialog.Cancel>
			<AlertDialog.Action
				class="bg-destructive/80 text-white hover:bg-destructive/70"
				onclick={handleConfirmPurge}
			>
				削除する
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
