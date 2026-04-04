<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as RadioGroup from '$lib/components/ui/radio-group/index.js';
	import {
		deleteYearData,
		getAllAccounts,
		getAllFixedAssets,
		getAllVendors,
		getAvailableYears,
		getArchiveRestorePreview,
		getInvoicesByYear,
		getJournalsByYear,
		getAllSettingsForExport,
		getStorageMode,
		importArchiveData,
		initializeDatabase,
		restoreAttachmentBlobs,
		setStorageModeForYear,
		type ArchiveRestoreResult
	} from '$lib/db';
	import { setAvailableYears } from '$lib/stores/fiscalYear.svelte.js';
	import type { ExportData, StorageType } from '$lib/types';
	import {
		exportArchiveZip,
		downloadZip,
		type ArchiveExportProgress
	} from '$lib/utils/archive-export';
	import { importFromZip, isZipFile, type ZipImportProgress } from '$lib/utils/zip-import';
	import {
		getSavedDirectoryHandle,
		supportsFileSystemAccess,
		pickDirectory
	} from '$lib/utils/filesystem';
	import { getStorageUsage, formatBytes } from '$lib/utils/storage';
	import type { StorageUsage } from '$lib/types';
	import {
		AlertTriangle,
		Archive,
		Check,
		FileSearch,
		FolderOpen,
		HardDrive,
		Loader2,
		Trash2,
		Upload,
		X
	} from '@lucide/svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { toast } from 'svelte-sonner';
	import { onMount } from 'svelte';

	// === 状態 ===
	let availableYears = $state<number[]>([]);
	let isLoading = $state(true);
	let storageMode = $state<StorageType>('indexeddb');
	let directoryHandle = $state<FileSystemDirectoryHandle | null>(null);

	// アーカイブ生成状態
	let archiveYear = $state<number | null>(null);
	let archiveProgress = $state<ArchiveExportProgress | null>(null);
	let archiveSuccess = $state<number | null>(null);

	// 年度削除状態
	let deleteTargetYear = $state<number | null>(null);
	let isDeleting = $state(false);

	onMount(async () => {
		await initializeDatabase();

		storageMode = await getStorageMode();
		if (supportsFileSystemAccess()) {
			directoryHandle = await getSavedDirectoryHandle();
		}

		availableYears = await getAvailableYears();
		isLoading = false;
	});

	async function createExportData(year: number): Promise<ExportData> {
		const [journals, accounts, vendors, fixedAssets, invoices, allSettings] = await Promise.all([
			getJournalsByYear(year),
			getAllAccounts(),
			getAllVendors(),
			getAllFixedAssets(),
			getInvoicesByYear(year),
			getAllSettingsForExport()
		]);

		return {
			version: '2.0.0',
			exportedAt: new Date().toISOString(),
			fiscalYear: year,
			journals,
			accounts,
			vendors,
			settings: {
				fiscalYearStart: 1,
				defaultCurrency: 'JPY',
				storageMode,
				autoPurgeBlobAfterExport: false,
				blobRetentionDays: 30
			},
			fixedAssets,
			invoices,
			allSettings
		};
	}

	async function handleExportArchive(year: number) {
		archiveYear = year;
		archiveProgress = null;
		archiveSuccess = null;

		try {
			const exportData = await createExportData(year);
			const journals = await getJournalsByYear(year);

			const zipBlob = await exportArchiveZip(exportData, journals, {
				onProgress: (progress) => {
					archiveProgress = progress;
				},
				directoryHandle
			});

			downloadZip(zipBlob, `e-shiwake_${year}_archive.zip`);

			archiveSuccess = year;
			toast.success(`${year}年度のアーカイブを作成しました`);
		} catch (error) {
			console.error('アーカイブエラー:', error);
			toast.error('アーカイブの作成に失敗しました');
		} finally {
			archiveYear = null;
			archiveProgress = null;
		}
	}

	async function handleDeleteYear(year: number) {
		isDeleting = true;
		try {
			const result = await deleteYearData(year, directoryHandle);
			const years = await getAvailableYears();
			availableYears = years;
			setAvailableYears(years);

			let msg = `${year}年度のデータを削除しました（仕訳 ${result.journalCount}件、証憑 ${result.attachmentCount}件`;
			if (result.invoiceCount > 0) msg += `、請求書 ${result.invoiceCount}件`;
			msg += '）';
			if (result.localFilesFailed > 0) {
				msg += `\n（ローカルファイル ${result.localFilesFailed}件の削除に失敗）`;
			}
			toast.success(msg);
			archiveSuccess = null;
			deleteTargetYear = null;
		} catch (error) {
			console.error('年度削除エラー:', error);
			toast.error('年度データの削除に失敗しました');
		} finally {
			isDeleting = false;
		}
	}

	// === アーカイブリストア ===
	let restoreFile = $state<File | null>(null);
	let restorePreview = $state<{
		fiscalYear: number;
		journalCount: number;
		newJournalCount: number;
		skippedJournalCount: number;
		attachmentCount: number;
	} | null>(null);
	let isRestoring = $state(false);
	let restoreResult = $state<ArchiveRestoreResult | null>(null);
	let restoreError = $state<string | null>(null);
	let restoreBlobs = new SvelteMap<string, Blob>();
	let restoreWarnings = $state<string[]>([]);
	let restoreZipProgress = $state<ZipImportProgress | null>(null);
	let blobRestoreResult = $state<{ restored: number; failed: number; errors: string[] } | null>(
		null
	);

	// リストアデータのバージョン（旧形式検出用）
	let restoreDataVersion = $state<string | null>(null);
	/** 旧バージョン（v0.3.x以前）のZIPかどうか */
	const isLegacyRestore = $derived(
		restoreDataVersion !== null && !restoreDataVersion.startsWith('3.')
	);

	// 証憑保存先選択
	let restoreStorageMode = $state<StorageType | null>(null);
	let restoreDirectoryHandle = $state<FileSystemDirectoryHandle | null>(null);
	let restoreStorageUsage = $state<StorageUsage | null>(null);
	const fsSupported = $derived(supportsFileSystemAccess());
	const restoreStorageModeRequired = $derived(
		restoreBlobs.size > 0 &&
			restoreStorageMode === null &&
			(restorePreview?.newJournalCount ?? 0) > 0
	);

	async function handleRestoreFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		restoreFile = file;
		restoreError = null;
		restoreResult = null;
		restorePreview = null;
		restoreDataVersion = null;
		restoreBlobs.clear();
		restoreWarnings = [];
		restoreZipProgress = null;
		blobRestoreResult = null;
		restoreStorageMode = null;
		restoreDirectoryHandle = null;
		restoreStorageUsage = null;

		try {
			if (!isZipFile(file)) {
				restoreError = 'ZIPファイルを選択してください。';
				return;
			}

			const result = await importFromZip(file, (progress) => {
				restoreZipProgress = progress;
			});

			if (result.dataType === 'backup') {
				// BackupData → バックアップページへ誘導
				restoreError = null;
				restoreFile = null;
				restoreBlobs.clear();
				toast.info(
					'このZIPファイルはフルバックアップです。データ管理ページのバックアップ・リストアからリストアしてください。',
					{ duration: 5000 }
				);
				return;
			}

			// ExportData → アーカイブリストア
			restoreDataVersion = result.exportData.version;
			const preview = await getArchiveRestorePreview(result.exportData);
			restorePreview = preview;
			for (const [key, value] of result.attachmentBlobs) {
				restoreBlobs.set(key, value);
			}
			restoreWarnings = result.warnings;
			restoreStorageUsage = await getStorageUsage();
		} catch (e) {
			restoreError = e instanceof Error ? e.message : 'ファイルの読み込みに失敗しました。';
		}
	}

	async function handlePickRestoreDirectory() {
		const handle = await pickDirectory();
		if (handle) {
			restoreDirectoryHandle = handle;
		}
	}

	async function handleArchiveRestore() {
		if (!restoreFile) return;

		if (restoreBlobs.size > 0 && !restoreStorageMode) {
			restoreError = '証憑PDFの復元先を選択してください。';
			return;
		}

		if (restoreStorageMode === 'filesystem' && !restoreDirectoryHandle) {
			restoreError = '証憑の保存先フォルダを選択してください。';
			return;
		}

		isRestoring = true;
		restoreError = null;
		restoreResult = null;
		blobRestoreResult = null;

		try {
			// ZIP を再パース
			const result = await importFromZip(restoreFile);
			if (result.dataType !== 'export') {
				restoreError = '予期しないデータ形式です。';
				return;
			}

			const archiveResult = await importArchiveData(result.exportData);
			restoreResult = archiveResult;

			if (archiveResult.success) {
				// 証憑Blobを復元
				if (restoreBlobs.size > 0 && restoreStorageMode) {
					blobRestoreResult = await restoreAttachmentBlobs(
						restoreBlobs,
						restoreStorageMode,
						restoreDirectoryHandle
					);

					// この年度の保存モードを設定
					await setStorageModeForYear(result.exportData.fiscalYear, restoreStorageMode);
				}

				const years = await getAvailableYears();
				availableYears = years;
				setAvailableYears(years);
			}
		} catch (e) {
			restoreError = e instanceof Error ? e.message : 'リストア中にエラーが発生しました';
		} finally {
			isRestoring = false;
		}
	}

	function handleClearRestore() {
		restoreFile = null;
		restorePreview = null;
		restoreDataVersion = null;
		restoreResult = null;
		restoreError = null;
		restoreBlobs.clear();
		restoreWarnings = [];
		restoreZipProgress = null;
		blobRestoreResult = null;
		restoreStorageMode = null;
		restoreDirectoryHandle = null;
		restoreStorageUsage = null;
	}
</script>

<div class="space-y-6">
	<div
		class="sticky top-14 z-10 -mx-4 border-b bg-background px-4 pt-4 pb-3 group-has-data-[collapsible=icon]/sidebar-wrapper:top-12"
	>
		<h1 class="flex items-center gap-2 text-2xl font-bold">
			<Archive class="size-6" />
			アーカイブ
		</h1>
		<p class="text-sm text-muted-foreground">
			検索機能付アーカイブZIPを作成。年度データを長期保存用にまとめます。
		</p>
	</div>

	<!-- アーカイブ作成 -->
	<Card.Root>
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<FileSearch class="size-5" />
				検索機能付アーカイブ
			</Card.Title>
			<Card.Description>
				仕訳データ・証憑PDF・帳簿レポート・検索HTMLをZIPにまとめた「年度決算パッケージ」。アプリを使わずに過去データを閲覧・検索できます。
			</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			{#if isLoading}
				<div class="flex items-center gap-2 text-sm text-muted-foreground">
					<Loader2 class="size-4 animate-spin" />
					データを読み込み中...
				</div>
			{:else if availableYears.length === 0}
				<p class="text-sm text-muted-foreground">仕訳データがありません。</p>
			{:else}
				<div class="space-y-2">
					{#each availableYears as year (year)}
						<div
							class="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
						>
							<div class="flex items-center gap-3">
								<span class="font-medium">{year}年度</span>
							</div>
							<div class="flex items-center gap-2">
								{#if archiveYear === year}
									<div class="flex items-center gap-2 text-sm text-muted-foreground">
										<Loader2 class="size-4 animate-spin" />
										{#if archiveProgress}
											{archiveProgress.message}
										{:else}
											準備中...
										{/if}
									</div>
								{:else if archiveSuccess === year}
									<div class="flex items-center gap-1 text-sm text-green-600">
										<Check class="size-4" />
										作成完了
									</div>
								{:else}
									<Button
										variant="outline"
										size="sm"
										onclick={() => handleExportArchive(year)}
										disabled={archiveYear !== null}
									>
										<Archive class="mr-1 size-4" />
										アーカイブ作成
									</Button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}

			<!-- アーカイブ後の年度削除提案 -->
			{#if archiveSuccess !== null}
				<div class="flex items-start gap-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
					<Archive class="mt-0.5 size-5 shrink-0 text-blue-500" />
					<div class="flex-1 space-y-2">
						<p class="text-sm font-medium text-blue-600 dark:text-blue-400">
							{archiveSuccess}年度のアーカイブが完了しました
						</p>
						<p class="text-sm text-muted-foreground">
							アーカイブは、その年度のすべての証憑とリンクした仕訳を、電帳法対応の検索要件で検索可能にしたパッケージです。e-shiwake自体のデータバックアップはバックアップ・リストアから行ってください。
						</p>
						<p class="text-sm text-muted-foreground">
							ブラウザのストレージ容量を節約するため、この年度のデータを削除できます。
						</p>
						<div class="flex items-center gap-2 pt-1">
							<Button
								variant="outline"
								size="sm"
								onclick={() => (deleteTargetYear = archiveSuccess)}
							>
								<Trash2 class="mr-1 size-4" />
								{archiveSuccess}年度のデータを削除
							</Button>
							<Button variant="ghost" size="sm" onclick={() => (archiveSuccess = null)}>
								閉じる
							</Button>
						</div>
					</div>
				</div>
			{/if}

			{#if archiveProgress?.failedAttachments && archiveProgress.failedAttachments.length > 0}
				<div
					class="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950"
				>
					<AlertTriangle class="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
					<div class="text-sm">
						<p class="font-medium text-amber-800 dark:text-amber-200">
							{archiveProgress.failedAttachments.length}件の証憑取得に失敗しました
						</p>
						<ul class="mt-1 space-y-1 text-amber-700 dark:text-amber-300">
							{#each archiveProgress.failedAttachments.slice(0, 5) as fa, i (i)}
								<li>{fa.fileName}: {fa.error}</li>
							{/each}
							{#if archiveProgress.failedAttachments.length > 5}
								<li>...他 {archiveProgress.failedAttachments.length - 5}件</li>
							{/if}
						</ul>
					</div>
				</div>
			{/if}
		</Card.Content>
	</Card.Root>

	<!-- アーカイブからリストア -->
	<Card.Root>
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<Upload class="size-5" />
				アーカイブからリストア
			</Card.Title>
			<Card.Description>
				アーカイブZIP（または旧バックアップZIP）から年度の仕訳＋証憑をマージ復元します。グローバルデータ（勘定科目・取引先・設定等）は復元されません。
			</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class="flex items-center gap-2">
				<input
					id="archive-restore-file"
					type="file"
					accept=".zip,application/zip"
					onchange={handleRestoreFileSelect}
					class="hidden"
				/>
				<Button
					variant="outline"
					onclick={() => document.getElementById('archive-restore-file')?.click()}
				>
					<Archive class="mr-2 size-4" />
					ZIPファイルを選択
				</Button>
				{#if restoreFile}
					<span class="text-sm text-muted-foreground">{restoreFile.name}</span>
					<Button variant="ghost" size="icon" onclick={handleClearRestore}>
						<X class="size-4" />
					</Button>
				{/if}
			</div>

			{#if restoreZipProgress && restoreZipProgress.phase !== 'complete'}
				<div class="flex items-center gap-3 rounded-lg border p-4">
					<Loader2 class="size-5 animate-spin" />
					<span class="text-sm">{restoreZipProgress.message}</span>
				</div>
			{/if}

			{#if restoreError}
				<div
					class="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4"
				>
					<AlertTriangle class="size-5 shrink-0 text-destructive" />
					<p class="text-sm text-destructive">{restoreError}</p>
				</div>
			{/if}

			{#if restorePreview && !restoreResult}
				<div class="space-y-4 rounded-lg border p-4">
					<div class="flex items-center gap-2">
						<Archive class="size-5 text-primary" />
						<span class="font-medium">{restorePreview.fiscalYear}年度のデータ</span>
					</div>

					<div class="grid grid-cols-3 gap-4 text-sm">
						<div>
							<p class="text-muted-foreground">仕訳（ZIP内）</p>
							<p class="font-semibold">{restorePreview.journalCount}件</p>
						</div>
						<div>
							<p class="text-muted-foreground">新規追加</p>
							<p class="font-semibold text-green-600">{restorePreview.newJournalCount}件</p>
						</div>
						<div>
							<p class="text-muted-foreground">スキップ（既存）</p>
							<p class="font-semibold text-muted-foreground">
								{restorePreview.skippedJournalCount}件
							</p>
						</div>
					</div>

					{#if isLegacyRestore}
						<div
							class="flex items-start gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4"
						>
							<AlertTriangle class="size-5 shrink-0 text-amber-500" />
							<div class="text-sm">
								<p class="font-medium text-amber-600 dark:text-amber-400">
									v0.3.x以前のバックアップ / エクスポートデータです（v{restoreDataVersion}）
								</p>
								<p class="mt-1 text-muted-foreground">
									このZIPからは<strong>仕訳データのみ</strong
									>が復元されます。事業者情報・勘定科目・固定資産・取引先などの設定データは復元されません。
								</p>
								<p class="mt-1 text-muted-foreground">
									設定データを含む完全な復元が必要な場合は、先に<strong
										>データ管理ページでフルバックアップ</strong
									>を作成してください。
								</p>
							</div>
						</div>
					{/if}

					{#if restorePreview.newJournalCount === 0}
						<div
							class="flex items-start gap-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3"
						>
							<Archive class="size-5 shrink-0 text-blue-500" />
							<p class="text-sm text-blue-600 dark:text-blue-400">
								すべての仕訳が既に存在しています。追加されるデータはありません。
							</p>
						</div>
					{/if}

					{#if restoreBlobs.size > 0 && restorePreview.newJournalCount > 0}
						<div class="space-y-3 border-t pt-3">
							<div class="flex items-center gap-2">
								<Archive class="size-4" />
								<span class="text-sm font-medium">証憑ファイル: {restoreBlobs.size}件</span>
							</div>

							<Label>証憑PDFの復元先を選択してください</Label>
							<RadioGroup.Root
								value={restoreStorageMode ?? ''}
								onValueChange={(v) => {
									restoreStorageMode = v as StorageType;
								}}
							>
								<div class="flex items-start space-x-3">
									<RadioGroup.Item
										value="filesystem"
										id="archive-restore-fs"
										disabled={!fsSupported}
									/>
									<div class="grid gap-1">
										<Label
											for="archive-restore-fs"
											class="font-medium {!fsSupported ? 'text-muted-foreground' : ''}"
										>
											ローカルフォルダ
											{#if !fsSupported}
												<span class="text-xs text-muted-foreground">（このブラウザでは非対応）</span
												>
											{/if}
										</Label>
										<p class="text-sm text-muted-foreground">
											ブラウザ容量を消費しません。Chrome/Edge対応。
										</p>
										{#if restoreStorageMode === 'filesystem'}
											<div class="mt-1 flex items-center gap-2">
												<Button variant="outline" size="sm" onclick={handlePickRestoreDirectory}>
													<FolderOpen class="mr-2 size-4" />
													{restoreDirectoryHandle ? 'フォルダを変更' : 'フォルダを選択'}
												</Button>
												{#if restoreDirectoryHandle}
													<span class="text-xs text-green-600">✓ 選択済み</span>
												{:else}
													<span class="text-xs text-amber-600">※ フォルダの選択が必要です</span>
												{/if}
											</div>
										{/if}
									</div>
								</div>
								<div class="flex items-start space-x-3">
									<RadioGroup.Item value="indexeddb" id="archive-restore-idb" />
									<div class="grid gap-1">
										<Label for="archive-restore-idb" class="font-medium">
											ブラウザ内（IndexedDB）
										</Label>
										<p class="text-sm text-muted-foreground">
											全ブラウザ対応。ブラウザの容量を消費します。
										</p>
										{#if restoreStorageMode === 'indexeddb' && restoreStorageUsage}
											{@const estimatedBlobSize = Array.from(restoreBlobs.values()).reduce(
												(sum, blob) => sum + blob.size,
												0
											)}
											{@const afterUsage = restoreStorageUsage.used + estimatedBlobSize}
											{@const quotaLimit = restoreStorageUsage.quota || 0}
											<div class="mt-1 rounded-md bg-muted p-2 text-xs">
												<div class="flex items-center gap-2">
													<HardDrive class="size-3" />
													<span>証憑サイズ: 約{formatBytes(estimatedBlobSize)}</span>
												</div>
												{#if quotaLimit > 0}
													<div class="mt-1">
														<span
															>復元後の使用量: 約{formatBytes(afterUsage)} / {formatBytes(
																quotaLimit
															)}</span
														>
														{#if afterUsage > quotaLimit * 0.8}
															<p class="mt-1 font-medium text-amber-600">
																容量不足のリスクがあります。ローカルフォルダへの保存を推奨します。
															</p>
														{/if}
													</div>
												{/if}
											</div>
										{/if}
									</div>
								</div>
							</RadioGroup.Root>

							{#if restoreWarnings.length > 0}
								<div class="text-xs text-amber-600">
									<p>警告: {restoreWarnings.length}件</p>
								</div>
							{/if}
						</div>
					{/if}

					<div class="pt-2">
						<Button
							onclick={handleArchiveRestore}
							disabled={isRestoring ||
								restoreStorageModeRequired ||
								restorePreview.newJournalCount === 0}
						>
							<Upload class="mr-2 size-4" />
							{isRestoring ? 'リストア中...' : `${restorePreview.newJournalCount}件の仕訳を復元`}
						</Button>
						{#if restoreStorageModeRequired}
							<p class="mt-1 text-xs text-amber-600">※ 証憑PDFの復元先を選択してください</p>
						{/if}
					</div>
				</div>
			{/if}

			{#if restoreResult}
				<div class="space-y-3 rounded-lg border p-4">
					{#if restoreResult.success}
						<div class="flex items-center gap-2 text-green-600">
							<Check class="size-5" />
							<span class="font-medium">アーカイブリストア完了</span>
						</div>
						<div class="grid grid-cols-2 gap-4 text-sm">
							<div>
								<p class="text-muted-foreground">復元した仕訳</p>
								<p class="font-semibold">{restoreResult.journalsRestored}件</p>
							</div>
							<div>
								<p class="text-muted-foreground">スキップ（既存）</p>
								<p class="font-semibold text-muted-foreground">{restoreResult.journalsSkipped}件</p>
							</div>
						</div>
						{#if blobRestoreResult}
							<div class="mt-4 border-t pt-4">
								<div class="flex items-center gap-2 text-sm">
									<Archive class="size-4" />
									<span class="font-medium">証憑ファイルの復元</span>
								</div>
								<div class="mt-2 grid grid-cols-2 gap-4 text-sm">
									<div>
										<p class="text-muted-foreground">復元成功</p>
										<p class="font-semibold text-green-600">{blobRestoreResult.restored}件</p>
									</div>
									{#if blobRestoreResult.failed > 0}
										<div>
											<p class="text-muted-foreground">復元失敗</p>
											<p class="font-semibold text-amber-600">{blobRestoreResult.failed}件</p>
										</div>
									{/if}
								</div>
							</div>
						{/if}
					{:else}
						<div class="flex items-center gap-2 text-destructive">
							<X class="size-5" />
							<span class="font-medium">リストア失敗</span>
						</div>
						{#each restoreResult.errors as error, i (i)}
							<p class="text-sm text-destructive">{error}</p>
						{/each}
					{/if}
					<Button variant="outline" size="sm" onclick={handleClearRestore}>
						別のファイルを選択
					</Button>
				</div>
			{/if}
		</Card.Content>
	</Card.Root>

	<!-- バックアップとの違い -->
	<Card.Root>
		<Card.Header>
			<Card.Title class="text-base">バックアップとの違い</Card.Title>
		</Card.Header>
		<Card.Content>
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b">
							<th class="py-2 pr-4 text-left font-medium text-muted-foreground">項目</th>
							<th class="py-2 pr-4 text-left font-medium text-muted-foreground">
								<div class="flex items-center gap-1">
									<HardDrive class="size-3.5" />
									バックアップ
								</div>
							</th>
							<th class="py-2 text-left font-medium text-muted-foreground">
								<div class="flex items-center gap-1">
									<FileSearch class="size-3.5" />
									アーカイブ
								</div>
							</th>
						</tr>
					</thead>
					<tbody class="text-muted-foreground">
						<tr class="border-b">
							<td class="py-2 pr-4 font-medium text-foreground">目的</td>
							<td class="py-2 pr-4">復元（リストア）するため</td>
							<td class="py-2">閲覧・検索するため</td>
						</tr>
						<tr class="border-b">
							<td class="py-2 pr-4 font-medium text-foreground">証憑PDF</td>
							<td class="py-2 pr-4">✅ 含む</td>
							<td class="py-2">✅ 含む</td>
						</tr>
						<tr class="border-b">
							<td class="py-2 pr-4 font-medium text-foreground">検索HTML</td>
							<td class="py-2 pr-4">—</td>
							<td class="py-2">✅ 含む</td>
						</tr>
						<tr class="border-b">
							<td class="py-2 pr-4 font-medium text-foreground">帳簿レポート</td>
							<td class="py-2 pr-4">—</td>
							<td class="py-2">✅ HTML + CSV（6帳簿）</td>
						</tr>
						<tr class="border-b">
							<td class="py-2 pr-4 font-medium text-foreground">リストア対象</td>
							<td class="py-2 pr-4">全データ（上書き）</td>
							<td class="py-2">仕訳＋証憑のみ（マージ）</td>
						</tr>
						<tr class="border-b">
							<td class="py-2 pr-4 font-medium text-foreground">アプリへの再取り込み</td>
							<td class="py-2 pr-4">✅ フルリストア</td>
							<td class="py-2">✅ アーカイブリストア / 閲覧</td>
						</tr>
						<tr class="border-b">
							<td class="py-2 pr-4 font-medium text-foreground">編集</td>
							<td class="py-2 pr-4">リストア後に編集可能</td>
							<td class="py-2">リストアすれば編集可能 / ZIP内は読み取り専用</td>
						</tr>
						<tr>
							<td class="py-2 pr-4 font-medium text-foreground">主な用途</td>
							<td class="py-2 pr-4">端末移行、事故対策</td>
							<td class="py-2">年度締め、税務調査対応、年度データ復活</td>
						</tr>
					</tbody>
				</table>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- 電帳法対応 -->
	<Card.Root>
		<Card.Header>
			<Card.Title class="text-base">電帳法対応の検索要件</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-3 text-sm text-muted-foreground">
			<p>
				アーカイブZIPには、電帳法の電子取引データ保存（第7条）に対応した検索HTML、および帳簿保存（第4条）に対応した帳簿レポート（仕訳帳・総勘定元帳・試算表・損益計算書・貸借対照表・消費税集計）が含まれます。
			</p>
			<div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
				<div class="rounded-md bg-muted p-3">
					<p class="font-medium text-foreground">取引年月日</p>
					<p>日付範囲で検索可能</p>
				</div>
				<div class="rounded-md bg-muted p-3">
					<p class="font-medium text-foreground">取引金額</p>
					<p>金額範囲で検索可能</p>
				</div>
				<div class="rounded-md bg-muted p-3">
					<p class="font-medium text-foreground">取引先名</p>
					<p>取引先名で検索可能</p>
				</div>
			</div>
		</Card.Content>
	</Card.Root>

	<p class="text-sm text-muted-foreground">
		電子帳簿保存法により、証憑は7年間の保存が必要です。アーカイブZIPは外付けHDDやクラウドストレージに保管してください。
	</p>
</div>

<!-- 年度削除確認ダイアログ -->
<AlertDialog.Root
	open={deleteTargetYear !== null}
	onOpenChange={(open) => {
		if (!open) deleteTargetYear = null;
	}}
>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{deleteTargetYear}年度のデータを削除</AlertDialog.Title>
			<AlertDialog.Description>
				<span class="block">
					この操作は取り消せません。{deleteTargetYear}年度の仕訳データと証憑ファイルがすべて削除されます。
				</span>
				<span class="mt-2 block font-medium text-amber-600">
					削除前に、アーカイブZIPまたはバックアップZIPが安全な場所に保存されていることを確認してください。
				</span>
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel disabled={isDeleting}>キャンセル</AlertDialog.Cancel>
			<AlertDialog.Action
				class="text-destructive-foreground bg-destructive hover:bg-destructive/90"
				disabled={isDeleting}
				onclick={() => {
					if (deleteTargetYear) handleDeleteYear(deleteTargetYear);
				}}
			>
				{#if isDeleting}
					<Loader2 class="mr-2 size-4 animate-spin" />
					削除中...
				{:else}
					<Trash2 class="mr-2 size-4" />
					削除する
				{/if}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
