<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as RadioGroup from '$lib/components/ui/radio-group/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import {
		getAllAccounts,
		getAllFixedAssets,
		getAllJournals,
		getAllSettingsForExport,
		getAllVendors,
		getAllInvoices,
		getAvailableYears,
		getBackupPreview,
		getLastExportedAt,
		getUnexportedAttachmentCount,
		importBackupData,
		restoreAttachmentBlobs,
		setLastExportedAt,
		setStorageModeForYear,
		type FullRestoreResult
	} from '$lib/db';
	import { setAvailableYears } from '$lib/stores/fiscalYear.svelte.js';
	import type { BackupData, StorageType } from '$lib/types';
	import { downloadZip, exportBackupToZip, type ZipExportProgress } from '$lib/utils/zip-export';
	import { importFromZip, isZipFile, type ZipImportProgress } from '$lib/utils/zip-import';
	import { supportsFileSystemAccess, pickDirectory } from '$lib/utils/filesystem';
	import { getStorageUsage, formatBytes } from '$lib/utils/storage';
	import type { StorageUsage } from '$lib/types';
	import {
		AlertTriangle,
		Archive,
		Check,
		Clock,
		Download,
		FolderOpen,
		HardDrive,
		HardDriveDownload,
		Info,
		Loader2,
		ShieldAlert,
		Upload,
		X
	} from '@lucide/svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { toast } from 'svelte-sonner';

	interface Props {
		availableYears: number[];
		isLoading: boolean;
		directoryHandle: FileSystemDirectoryHandle | null;
		unexportedCount: number;
		onyearschange: (years: number[]) => void;
		onunexportedcountchange: (count: number) => void;
	}

	let {
		availableYears,
		isLoading,
		directoryHandle,
		unexportedCount = $bindable(),
		onyearschange,
		onunexportedcountchange
	}: Props = $props();

	// === 最終バックアップ日時 ===
	let lastBackupAt = $state<string | null>(null);
	let backupWarningDays = $state<number | null>(null);

	$effect(() => {
		if (!isLoading) {
			getLastExportedAt().then((date) => {
				lastBackupAt = date;
				if (date) {
					const diffMs = Date.now() - new Date(date).getTime();
					const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
					backupWarningDays = diffDays >= 30 ? diffDays : null;
				} else {
					backupWarningDays = availableYears.length > 0 ? -1 : null;
				}
			});
		}
	});

	// === 全体サマリ ===
	let totalSummary = $state<{
		journalCount: number;
		attachmentCount: number;
		invoiceCount: number;
		fixedAssetCount: number;
		accountCount: number;
		vendorCount: number;
	} | null>(null);

	$effect(() => {
		if (!isLoading && availableYears.length > 0) {
			loadSummary();
		}
	});

	async function loadSummary() {
		const [journals, accounts, vendors, fixedAssets, invoices] = await Promise.all([
			getAllJournals(),
			getAllAccounts(),
			getAllVendors(),
			getAllFixedAssets(),
			getAllInvoices()
		]);
		const attachmentCount = journals.reduce((sum, j) => sum + j.attachments.length, 0);
		totalSummary = {
			journalCount: journals.length,
			attachmentCount,
			invoiceCount: invoices.length,
			fixedAssetCount: fixedAssets.length,
			accountCount: accounts.length,
			vendorCount: vendors.length
		};
	}

	// === バックアップ（フルスナップショット作成） ===
	let isExporting = $state(false);
	let zipProgress = $state<ZipExportProgress | null>(null);
	let exportSuccess = $state(false);

	async function handleBackup() {
		isExporting = true;
		zipProgress = null;

		try {
			const [journals, accounts, vendors, fixedAssets, invoices, allSettings] = await Promise.all([
				getAllJournals(),
				getAllAccounts(),
				getAllVendors(),
				getAllFixedAssets(),
				getAllInvoices(),
				getAllSettingsForExport()
			]);

			const backupData: BackupData = {
				type: 'backup',
				version: '3.0.0',
				exportedAt: new Date().toISOString(),
				journals,
				accounts,
				vendors,
				fixedAssets,
				invoices,
				allSettings
			};

			const zipBlob = await exportBackupToZip(backupData, {
				includeEvidences: true,
				directoryHandle,
				onProgress: (progress) => {
					zipProgress = progress;
				}
			});

			const dateStr = new Date().toISOString().slice(0, 10);
			downloadZip(zipBlob, `e-shiwake_backup_${dateStr}.zip`);

			const now = new Date().toISOString();
			await setLastExportedAt(now);
			lastBackupAt = now;
			backupWarningDays = null;
			unexportedCount = await getUnexportedAttachmentCount();
			onunexportedcountchange(unexportedCount);

			exportSuccess = true;
			setTimeout(() => {
				exportSuccess = false;
			}, 3000);
		} catch (error) {
			console.error('バックアップエラー:', error);
			toast.error('バックアップの作成に失敗しました');
		} finally {
			isExporting = false;
			zipProgress = null;
		}
	}

	// === リストア（フルリストア） ===
	let importFile = $state<File | null>(null);
	let backupPreview = $state<ReturnType<typeof getBackupPreview> | null>(null);
	let isImporting = $state(false);
	let importResult = $state<FullRestoreResult | null>(null);
	let importError = $state<string | null>(null);
	let zipImportBlobs = new SvelteMap<string, Blob>();
	let zipImportWarnings = $state<string[]>([]);
	let zipImportProgress = $state<ZipImportProgress | null>(null);
	let blobRestoreResult = $state<{ restored: number; failed: number; errors: string[] } | null>(
		null
	);
	let showConfirmDialog = $state(false);

	// === リストア時の証憑保存先選択 ===
	let restoreStorageMode = $state<StorageType | null>(null);
	let restoreDirectoryHandle = $state<FileSystemDirectoryHandle | null>(null);
	let restoreStorageUsage = $state<StorageUsage | null>(null);
	const fsSupported = $derived(supportsFileSystemAccess());
	const restoreStorageModeRequired = $derived(
		zipImportBlobs.size > 0 && restoreStorageMode === null
	);

	async function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];

		if (!file) return;

		importFile = file;
		importError = null;
		importResult = null;
		backupPreview = null;
		zipImportBlobs.clear();
		zipImportWarnings = [];
		zipImportProgress = null;
		blobRestoreResult = null;
		restoreStorageMode = null;
		restoreDirectoryHandle = null;
		restoreStorageUsage = null;

		try {
			if (!isZipFile(file)) {
				importError =
					'ZIPファイルを選択してください。リストアにはバックアップで作成したZIPファイルが必要です。';
				return;
			}

			const result = await importFromZip(file, (progress) => {
				zipImportProgress = progress;
			});

			if (result.dataType === 'export') {
				// ExportData（旧バックアップ or アーカイブ）→ アーカイブページへ誘導
				importError = null;
				importFile = null;
				zipImportBlobs.clear();
				toast.info(
					'このZIPファイルは年度別データです。アーカイブページからリストアしてください。',
					{ duration: 5000 }
				);
				goto('/archive');
				return;
			}

			// BackupData → フルリストア
			backupPreview = getBackupPreview(result.backupData);
			for (const [key, value] of result.attachmentBlobs) {
				zipImportBlobs.set(key, value);
			}
			zipImportWarnings = result.warnings;
			restoreStorageUsage = await getStorageUsage();
		} catch (e) {
			importError = e instanceof Error ? e.message : 'ファイルの読み込みに失敗しました。';
		}
	}

	async function handlePickRestoreDirectory() {
		const handle = await pickDirectory();
		if (handle) {
			restoreDirectoryHandle = handle;
		}
	}

	function handleRestoreClick() {
		// 証憑がある場合、保存先の選択が必須
		if (zipImportBlobs.size > 0 && !restoreStorageMode) {
			importError = '証憑PDFの復元先を選択してください。';
			return;
		}

		// filesystem選択時にフォルダ未選択ならエラー
		if (restoreStorageMode === 'filesystem' && !restoreDirectoryHandle) {
			importError = '証憑の保存先フォルダを選択してください。';
			return;
		}

		importError = null;
		showConfirmDialog = true;
	}

	async function handleRestoreConfirmed() {
		showConfirmDialog = false;

		// ZIP を再度パースして BackupData を取得
		if (!importFile) return;

		isImporting = true;
		importError = null;
		importResult = null;
		blobRestoreResult = null;

		try {
			const result = await importFromZip(importFile);
			if (result.dataType !== 'backup') {
				importError = '予期しないデータ形式です。';
				return;
			}

			const restoreResult = await importBackupData(result.backupData);
			importResult = restoreResult;

			if (restoreResult.success) {
				// 証憑Blobを復元
				if (zipImportBlobs.size > 0 && restoreStorageMode) {
					blobRestoreResult = await restoreAttachmentBlobs(
						zipImportBlobs,
						restoreStorageMode,
						restoreDirectoryHandle
					);

					// 全年度の保存モードを設定
					if (backupPreview?.years) {
						for (const year of backupPreview.years) {
							await setStorageModeForYear(year, restoreStorageMode);
						}
					}
				}

				const years = await getAvailableYears();
				setAvailableYears(years);
				onyearschange(years);
				await loadSummary();
			}
		} catch (e) {
			importError = e instanceof Error ? e.message : 'リストア中にエラーが発生しました';
		} finally {
			isImporting = false;
		}
	}

	function handleClearRestore() {
		importFile = null;
		backupPreview = null;
		importResult = null;
		importError = null;
		zipImportBlobs.clear();
		zipImportWarnings = [];
		zipImportProgress = null;
		blobRestoreResult = null;
		restoreStorageMode = null;
		restoreDirectoryHandle = null;
		restoreStorageUsage = null;
	}

	function formatBackupDate(isoString: string): string {
		const d = new Date(isoString);
		return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
	}
</script>

<Card.Root>
	<Card.Header>
		<Card.Title class="flex items-center gap-2">
			<HardDriveDownload class="size-5" />
			バックアップ・リストア
		</Card.Title>
		<Card.Description>
			全年度の仕訳・証憑PDF・設定を含むフルスナップショットをZIPファイルとして保存・復元します。端末移行や事故対策に。
		</Card.Description>
	</Card.Header>
	<Card.Content class="space-y-6">
		<!-- バックアップ警告バナー -->
		{#if backupWarningDays === -1}
			<div class="flex items-start gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
				<ShieldAlert class="size-5 shrink-0 text-amber-500" />
				<div class="text-sm">
					<p class="font-medium text-amber-600">バックアップが未作成です</p>
					<p class="mt-1 text-muted-foreground">
						端末の故障やブラウザのデータ消去に備え、定期的にバックアップを作成してください。
					</p>
				</div>
			</div>
		{:else if backupWarningDays !== null && backupWarningDays >= 30}
			<div class="flex items-start gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
				<ShieldAlert class="size-5 shrink-0 text-amber-500" />
				<div class="text-sm">
					<p class="font-medium text-amber-600">
						最終バックアップから{backupWarningDays}日が経過しています
					</p>
					<p class="mt-1 text-muted-foreground">
						データの安全のため、バックアップの更新をおすすめします。
					</p>
				</div>
			</div>
		{/if}

		<!-- 最終バックアップ日時 -->
		{#if lastBackupAt}
			<div class="flex items-center gap-2 text-sm text-muted-foreground">
				<Clock class="size-4" />
				<span>最終バックアップ: {formatBackupDate(lastBackupAt)}</span>
			</div>
		{/if}

		<!-- バックアップ作成セクション -->
		<div class="space-y-3">
			<h3 class="text-sm font-semibold">バックアップ作成</h3>
			{#if isLoading}
				<div class="flex items-center justify-center py-4">
					<p class="text-muted-foreground">読み込み中...</p>
				</div>
			{:else if availableYears.length === 0}
				<p class="text-sm text-muted-foreground">バックアップ可能なデータがありません</p>
			{:else}
				<div class="rounded-lg border p-4 {exportSuccess ? 'border-green-500' : ''}">
					{#if totalSummary}
						<div class="mb-3 grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
							<div>
								<p class="text-muted-foreground">年度</p>
								<p class="font-semibold">{availableYears.join(', ')}</p>
							</div>
							<div>
								<p class="text-muted-foreground">仕訳</p>
								<p class="font-semibold">{totalSummary.journalCount}件</p>
							</div>
							<div>
								<p class="text-muted-foreground">証憑</p>
								<p class="font-semibold">{totalSummary.attachmentCount}件</p>
							</div>
							<div>
								<p class="text-muted-foreground">勘定科目</p>
								<p class="font-semibold">{totalSummary.accountCount}件</p>
							</div>
							<div>
								<p class="text-muted-foreground">取引先</p>
								<p class="font-semibold">{totalSummary.vendorCount}件</p>
							</div>
							{#if totalSummary.invoiceCount > 0}
								<div>
									<p class="text-muted-foreground">請求書</p>
									<p class="font-semibold">{totalSummary.invoiceCount}件</p>
								</div>
							{/if}
							{#if totalSummary.fixedAssetCount > 0}
								<div>
									<p class="text-muted-foreground">固定資産</p>
									<p class="font-semibold">{totalSummary.fixedAssetCount}件</p>
								</div>
							{/if}
						</div>
					{/if}

					<div class="flex items-center gap-3">
						<Button onclick={handleBackup} disabled={isExporting}>
							{#if isExporting}
								<Loader2 class="mr-2 size-4 animate-spin" />
								{#if zipProgress}
									{zipProgress.message}
								{:else}
									準備中...
								{/if}
							{:else}
								<Download class="mr-2 size-4" />
								フルバックアップ作成
							{/if}
						</Button>
						{#if exportSuccess}
							<span class="flex items-center gap-1 text-sm text-green-600">
								<Check class="size-4" />
								ダウンロード完了
							</span>
						{/if}
					</div>
				</div>
			{/if}
		</div>

		<!-- リストアセクション -->
		<div class="space-y-3 border-t pt-4">
			<h3 class="text-sm font-semibold">リストア（復元）</h3>
			<p class="text-sm text-muted-foreground">
				バックアップZIPを選択すると、全データを上書きで復元します。年度別のアーカイブZIPはアーカイブページからリストアできます。
			</p>
			<!-- 旧バージョンZIPの注意 -->
			<div class="flex items-start gap-3 rounded-lg border border-blue-500/50 bg-blue-500/10 p-4">
				<Info class="size-5 shrink-0 text-blue-500" />
				<div class="text-sm">
					<p class="font-medium text-blue-700 dark:text-blue-400">
						v0.3.x以前のバックアップZIPをお持ちの方へ
					</p>
					<p class="mt-1 text-muted-foreground">
						旧バージョンのZIPは<strong>アーカイブリストア</strong
						>（仕訳データのみマージ）として扱われます。事業者情報・勘定科目などの設定データは復元されません。まず<strong
							>フルバックアップを作成</strong
						>してから、旧ZIPはアーカイブページでリストアしてください。
					</p>
				</div>
			</div>
			<div class="space-y-2">
				<div class="flex items-center gap-2">
					<input
						id="restore-file"
						type="file"
						accept=".zip,application/zip"
						onchange={handleFileSelect}
						class="hidden"
					/>
					<Button
						variant="outline"
						onclick={() => document.getElementById('restore-file')?.click()}
					>
						<Archive class="mr-2 size-4" />
						ZIPファイルを選択
					</Button>
					{#if importFile}
						<span class="text-sm text-muted-foreground">{importFile.name}</span>
						<Button variant="ghost" size="icon" onclick={handleClearRestore}>
							<X class="size-4" />
						</Button>
					{/if}
				</div>
			</div>

			{#if zipImportProgress && zipImportProgress.phase !== 'complete'}
				<div class="flex items-center gap-3 rounded-lg border p-4">
					<Loader2 class="size-5 animate-spin" />
					<span class="text-sm">{zipImportProgress.message}</span>
				</div>
			{/if}

			{#if importError}
				<div
					class="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4"
				>
					<AlertTriangle class="size-5 shrink-0 text-destructive" />
					<p class="text-sm text-destructive">{importError}</p>
				</div>
			{/if}

			{#if backupPreview && !importResult}
				<div class="space-y-4 rounded-lg border p-4">
					<!-- 強い警告 -->
					<div
						class="flex items-start gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3"
					>
						<ShieldAlert class="size-5 shrink-0 text-amber-500" />
						<div class="text-sm">
							<p class="font-medium text-amber-600">フルリストア（上書き復元）</p>
							<p class="mt-1 text-muted-foreground">
								現在の全データが削除され、バックアップの内容で完全に置き換わります。
							</p>
						</div>
					</div>

					<div class="flex items-center gap-2">
						<Archive class="size-5 text-primary" />
						<span class="font-medium">
							バックアップ内容（{backupPreview.years.length > 0
								? backupPreview.years.join(', ') + '年度'
								: '年度なし'}）
						</span>
					</div>

					<div class="grid grid-cols-3 gap-4 text-sm">
						<div>
							<p class="text-muted-foreground">仕訳</p>
							<p class="font-semibold">{backupPreview.journalCount}件</p>
						</div>
						<div>
							<p class="text-muted-foreground">勘定科目</p>
							<p class="font-semibold">{backupPreview.accountCount}件</p>
						</div>
						<div>
							<p class="text-muted-foreground">取引先</p>
							<p class="font-semibold">{backupPreview.vendorCount}件</p>
						</div>
						{#if backupPreview.invoiceCount > 0}
							<div>
								<p class="text-muted-foreground">請求書</p>
								<p class="font-semibold">{backupPreview.invoiceCount}件</p>
							</div>
						{/if}
						{#if backupPreview.fixedAssetCount > 0}
							<div>
								<p class="text-muted-foreground">固定資産</p>
								<p class="font-semibold">{backupPreview.fixedAssetCount}件</p>
							</div>
						{/if}
					</div>

					{#if zipImportBlobs.size > 0}
						<div class="space-y-3 border-t pt-3">
							<div class="flex items-center gap-2">
								<Archive class="size-4" />
								<span class="text-sm font-medium">証憑ファイル: {zipImportBlobs.size}件</span>
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
										id="restore-storage-fs"
										disabled={!fsSupported}
									/>
									<div class="grid gap-1">
										<Label
											for="restore-storage-fs"
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
									<RadioGroup.Item value="indexeddb" id="restore-storage-idb" />
									<div class="grid gap-1">
										<Label for="restore-storage-idb" class="font-medium">
											ブラウザ内（IndexedDB）
										</Label>
										<p class="text-sm text-muted-foreground">
											全ブラウザ対応。ブラウザの容量を消費します。
										</p>
										{#if restoreStorageMode === 'indexeddb' && restoreStorageUsage}
											{@const estimatedBlobSize = Array.from(zipImportBlobs.values()).reduce(
												(sum, blob) => sum + blob.size,
												0
											)}
											{@const afterUsage = restoreStorageUsage.used + estimatedBlobSize}
											{@const quotaLimit = restoreStorageUsage.quota || 0}
											<div class="mt-1 rounded-md bg-muted p-2 text-xs">
												<div class="flex items-center gap-2">
													<HardDrive class="size-3" />
													<span>
														証憑サイズ: 約{formatBytes(estimatedBlobSize)}
													</span>
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

							{#if zipImportWarnings.length > 0}
								<div class="text-xs text-amber-600">
									<p>警告: {zipImportWarnings.length}件</p>
								</div>
							{/if}
						</div>
					{/if}

					<div class="pt-2">
						<Button
							variant="destructive"
							onclick={handleRestoreClick}
							disabled={isImporting || restoreStorageModeRequired}
						>
							<Upload class="mr-2 size-4" />
							{isImporting ? 'リストア中...' : '全データを上書きリストア'}
						</Button>
						{#if restoreStorageModeRequired}
							<p class="mt-1 text-xs text-amber-600">※ 証憑PDFの復元先を選択してください</p>
						{/if}
					</div>
				</div>
			{/if}

			{#if importResult}
				<div class="space-y-3 rounded-lg border p-4">
					{#if importResult.success}
						<div class="flex items-center gap-2 text-green-600">
							<Check class="size-5" />
							<span class="font-medium">フルリストア完了</span>
						</div>
						<div class="grid grid-cols-3 gap-4 text-sm">
							<div>
								<p class="text-muted-foreground">仕訳</p>
								<p class="font-semibold">{importResult.journalsRestored}件</p>
							</div>
							<div>
								<p class="text-muted-foreground">勘定科目</p>
								<p class="font-semibold">{importResult.accountsRestored}件</p>
							</div>
							<div>
								<p class="text-muted-foreground">取引先</p>
								<p class="font-semibold">{importResult.vendorsRestored}件</p>
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
						{#each importResult.errors as error, i (i)}
							<p class="text-sm text-destructive">{error}</p>
						{/each}
					{/if}
					<Button variant="outline" size="sm" onclick={handleClearRestore}>
						別のファイルを選択
					</Button>
				</div>
			{/if}
		</div>
	</Card.Content>
</Card.Root>

<!-- フルリストア確認ダイアログ -->
<AlertDialog.Root bind:open={showConfirmDialog}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>全データを上書きリストアしますか？</AlertDialog.Title>
			<AlertDialog.Description>
				現在のすべてのデータ（仕訳・証憑・勘定科目・取引先・固定資産・請求書・設定）が削除され、バックアップの内容で完全に置き換わります。この操作は元に戻せません。
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>キャンセル</AlertDialog.Cancel>
			<AlertDialog.Action
				class="text-destructive-foreground bg-destructive hover:bg-destructive/90"
				onclick={handleRestoreConfirmed}
			>
				上書きリストア実行
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
