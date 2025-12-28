<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as RadioGroup from '$lib/components/ui/radio-group/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import { Folder, FolderOpen, AlertTriangle, HardDrive, Trash2, RotateCcw } from '@lucide/svelte';
	import {
		seedTestData2024,
		initializeDatabase,
		getAvailableYears,
		getStorageMode,
		setStorageMode,
		getUnexportedAttachmentCount,
		getAutoPurgeBlobSetting,
		setAutoPurgeBlobSetting,
		getBlobRetentionDays,
		purgeAllExportedBlobs
	} from '$lib/db';
	import { setAvailableYears } from '$lib/stores/fiscalYear.svelte.js';
	import {
		supportsFileSystemAccess,
		pickDirectory,
		getSavedDirectoryHandle,
		saveDirectoryHandle,
		clearDirectoryHandle,
		getDirectoryDisplayName
	} from '$lib/utils/filesystem';
	import {
		getStorageUsage,
		formatBytes,
		getRecommendedUsagePercentage,
		RECOMMENDED_QUOTA,
		WARNING_THRESHOLD
	} from '$lib/utils/storage';
	import SafariStorageDialog from '$lib/components/SafariStorageDialog.svelte';
	import type { StorageType, StorageUsage } from '$lib/types';

	// 証憑保存設定
	let storageMode = $state<StorageType>('indexeddb');
	let directoryHandle = $state<FileSystemDirectoryHandle | null>(null);
	let directoryName = $state<string | null>(null);
	let unexportedCount = $state(0);
	let isFileSystemSupported = $state(false);

	// 容量管理設定
	let storageUsage = $state<StorageUsage>({ used: 0, quota: 0, percentage: 0 });
	let autoPurgeEnabled = $state(true);
	let retentionDays = $state(30);
	let isPurging = $state(false);
	let purgeResult = $state<string | null>(null);

	// 開発用ツール
	let isSeeding = $state(false);
	let seedResult = $state<string | null>(null);

	// Safari向け説明ダイアログ
	let safariDialogOpen = $state(false);

	// 派生値
	const recommendedPercentage = $derived(getRecommendedUsagePercentage(storageUsage.used));
	const isStorageWarning = $derived(recommendedPercentage >= WARNING_THRESHOLD);

	// 初期化
	onMount(async () => {
		await initializeDatabase();

		// File System Access APIのサポート確認
		isFileSystemSupported = supportsFileSystemAccess();

		// 現在の保存モードを取得
		storageMode = await getStorageMode();

		// ディレクトリハンドルを取得
		if (isFileSystemSupported) {
			directoryHandle = await getSavedDirectoryHandle();
			if (directoryHandle) {
				directoryName = getDirectoryDisplayName(directoryHandle);
			}
		}

		// 未エクスポートの添付ファイル数を取得
		unexportedCount = await getUnexportedAttachmentCount();

		// ストレージ使用量を取得
		storageUsage = await getStorageUsage();

		// 容量管理設定を取得
		autoPurgeEnabled = await getAutoPurgeBlobSetting();
		retentionDays = await getBlobRetentionDays();
	});

	// 保存モードの変更
	async function handleStorageModeChange(mode: StorageType) {
		storageMode = mode;
		await setStorageMode(mode);

		// filesystemモードでディレクトリが未設定の場合、選択を促す
		if (mode === 'filesystem' && !directoryHandle) {
			await handleSelectDirectory();
		}
	}

	// ディレクトリ選択
	async function handleSelectDirectory() {
		const handle = await pickDirectory();
		if (handle) {
			directoryHandle = handle;
			directoryName = getDirectoryDisplayName(handle);
			await saveDirectoryHandle(handle);

			// ファイルシステムモードに自動切り替え
			if (storageMode !== 'filesystem') {
				storageMode = 'filesystem';
				await setStorageMode('filesystem');
			}
		}
	}

	// ディレクトリ設定をクリア
	async function handleClearDirectory() {
		await clearDirectoryHandle();
		directoryHandle = null;
		directoryName = null;

		// IndexedDBモードに切り替え
		storageMode = 'indexeddb';
		await setStorageMode('indexeddb');
	}

	// 自動削除設定の変更
	async function handleAutoPurgeChange(enabled: boolean) {
		autoPurgeEnabled = enabled;
		await setAutoPurgeBlobSetting(enabled);
	}

	// エクスポート済みデータを削除
	async function handlePurgeExportedBlobs() {
		if (!confirm('エクスポート済みの証憑データを削除しますか？\nメタデータは残りますが、PDFファイルは復元できなくなります。')) {
			return;
		}

		isPurging = true;
		purgeResult = null;
		try {
			const count = await purgeAllExportedBlobs();
			if (count > 0) {
				purgeResult = `${count}件の証憑データを削除しました`;
				// ストレージ使用量を再取得
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

	// テストデータ追加
	async function handleSeedData() {
		isSeeding = true;
		seedResult = null;
		try {
			await initializeDatabase();
			const count = await seedTestData2024();
			seedResult = `${count}件の仕訳を追加しました`;
			// 年度リストを更新
			const years = await getAvailableYears();
			setAvailableYears(years);
		} catch (error) {
			seedResult = `エラー: ${error instanceof Error ? error.message : '不明なエラー'}`;
		} finally {
			isSeeding = false;
		}
	}

	// Safari向け説明を再表示
	function handleResetSafariWarning() {
		localStorage.removeItem('shownStorageWarning');
		safariDialogOpen = true;
	}
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold">設定</h1>
		<p class="text-sm text-muted-foreground">アプリケーションの設定を管理します</p>
	</div>

	<!-- 証憑保存先設定 -->
	<Card.Root>
		<Card.Header>
			<Card.Title>証憑（PDF）の保存先</Card.Title>
			<Card.Description>
				仕訳に紐付けるPDFファイルの保存方法を選択します
			</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-6">
			{#if isFileSystemSupported}
				<!-- File System Access API対応ブラウザ -->
				<RadioGroup.Root value={storageMode} onValueChange={(v) => handleStorageModeChange(v as StorageType)}>
					<div class="flex items-start space-x-3">
						<RadioGroup.Item value="filesystem" id="storage-filesystem" />
						<div class="grid gap-1.5">
							<Label for="storage-filesystem" class="font-medium">
								ローカルフォルダに保存（推奨）
							</Label>
							<p class="text-sm text-muted-foreground">
								選択したフォルダに年度別で自動保存します。バックアップが容易で、他のソフトからもアクセス可能です。
							</p>
						</div>
					</div>
					<div class="flex items-start space-x-3">
						<RadioGroup.Item value="indexeddb" id="storage-indexeddb" />
						<div class="grid gap-1.5">
							<Label for="storage-indexeddb" class="font-medium">
								ブラウザに保存
							</Label>
							<p class="text-sm text-muted-foreground">
								ブラウザのIndexedDBに保存します。定期的にエクスポートしてバックアップしてください。
							</p>
						</div>
					</div>
				</RadioGroup.Root>

				<!-- ディレクトリ選択（filesystemモード時） -->
				{#if storageMode === 'filesystem'}
					<div class="rounded-lg border p-4">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-3">
								{#if directoryHandle}
									<FolderOpen class="size-5 text-green-500" />
									<div>
										<p class="font-medium">{directoryName}</p>
										<p class="text-sm text-muted-foreground">保存先フォルダ</p>
									</div>
								{:else}
									<Folder class="size-5 text-muted-foreground" />
									<div>
										<p class="font-medium text-muted-foreground">未設定</p>
										<p class="text-sm text-muted-foreground">保存先フォルダを選択してください</p>
									</div>
								{/if}
							</div>
							<div class="flex gap-2">
								<Button variant="outline" onclick={handleSelectDirectory}>
									{directoryHandle ? '変更' : '選択'}
								</Button>
								{#if directoryHandle}
									<Button variant="ghost" onclick={handleClearDirectory}>
										クリア
									</Button>
								{/if}
							</div>
						</div>
					</div>
				{/if}

				<!-- 未エクスポート警告（indexeddbモード時） -->
				{#if storageMode === 'indexeddb' && unexportedCount > 0}
					<div class="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
						<AlertTriangle class="size-5 shrink-0 text-amber-500" />
						<div>
							<p class="font-medium text-amber-800 dark:text-amber-200">
								{unexportedCount}件の証憑が未エクスポートです
							</p>
							<p class="text-sm text-amber-700 dark:text-amber-300">
								ブラウザのデータは予期せず消える可能性があります。エクスポートページからバックアップしてください。
							</p>
						</div>
					</div>
				{/if}
			{:else}
				<!-- File System Access API非対応（iPadなど） -->
				<div class="rounded-lg border p-4">
					<div class="flex items-start gap-3">
						<Folder class="size-5 text-muted-foreground" />
						<div>
							<p class="font-medium">ブラウザに保存</p>
							<p class="text-sm text-muted-foreground">
								このブラウザではローカルフォルダへの保存に対応していません。
								PDFはブラウザ内に保存されます。
							</p>
						</div>
					</div>
				</div>

				{#if unexportedCount > 0}
					<div class="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
						<AlertTriangle class="size-5 shrink-0 text-amber-500" />
						<div>
							<p class="font-medium text-amber-800 dark:text-amber-200">
								{unexportedCount}件の証憑が未エクスポートです
							</p>
							<p class="text-sm text-amber-700 dark:text-amber-300">
								iPadやiPhoneではブラウザのデータが予期せず消える可能性があります。
								エクスポートページから定期的にバックアップしてください。
							</p>
						</div>
					</div>
				{/if}
			{/if}
		</Card.Content>
	</Card.Root>

	<!-- ストレージ使用量（IndexedDBモード時のみ表示） -->
	{#if storageMode === 'indexeddb' || !isFileSystemSupported}
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<HardDrive class="size-5" />
					ストレージ使用量
				</Card.Title>
				<Card.Description>
					ブラウザに保存されている証憑データの容量を管理します
				</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-6">
				<!-- 使用量表示 -->
				<div class="space-y-2">
					<div class="flex items-center justify-between text-sm">
						<span>使用中: {formatBytes(storageUsage.used)}</span>
						<span>推奨上限: {formatBytes(RECOMMENDED_QUOTA)}</span>
					</div>
					<div class="h-3 w-full overflow-hidden rounded-full bg-muted">
						<div
							class="h-full transition-all duration-300 {isStorageWarning ? 'bg-amber-500' : 'bg-primary'}"
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

				<!-- 容量警告 -->
				{#if isStorageWarning}
					<div class="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
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

				<!-- 自動削除設定 -->
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

				<!-- 手動削除ボタン -->
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

				<!-- Safari向け説明を再表示 -->
				<div class="flex items-center justify-between border-t pt-6">
					<div>
						<p class="font-medium">ブラウザ保存の説明を再表示</p>
						<p class="text-sm text-muted-foreground">
							Safari / iPad向けのストレージ説明を再度表示します
						</p>
					</div>
					<Button
						variant="outline"
						size="sm"
						onclick={handleResetSafariWarning}
					>
						<RotateCcw class="mr-2 size-4" />
						再表示
					</Button>
				</div>
			</Card.Content>
		</Card.Root>
	{/if}

	<!-- 開発用ツール -->
	<Card.Root>
		<Card.Header>
			<Card.Title>開発用ツール</Card.Title>
			<Card.Description>テスト用のデータ操作</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class="flex items-center justify-between">
				<div>
					<p class="font-medium">2024年ダミーデータ</p>
					<p class="text-sm text-muted-foreground">
						テスト用に2024年の仕訳データ14件を追加します
					</p>
				</div>
				<Button onclick={handleSeedData} disabled={isSeeding}>
					{isSeeding ? '追加中...' : 'データを追加'}
				</Button>
			</div>
			{#if seedResult}
				<p class="text-sm text-muted-foreground">{seedResult}</p>
			{/if}
		</Card.Content>
	</Card.Root>
</div>

<!-- Safari向け説明ダイアログ -->
<SafariStorageDialog
	bind:open={safariDialogOpen}
	onconfirm={() => {}}
/>
