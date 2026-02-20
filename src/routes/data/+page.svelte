<script lang="ts">
	import SafariStorageDialog from '$lib/components/SafariStorageDialog.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Progress } from '$lib/components/ui/progress/index.js';
	import * as RadioGroup from '$lib/components/ui/radio-group/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import {
		deleteYearData,
		getAllAccounts,
		getAllVendors,
		getAttachmentsForFolderMigration,
		getAutoPurgeBlobSetting,
		getAvailableYears,
		getBlobRetentionDays,
		getFilesystemAttachmentCount,
		getImportPreview,
		getJournalsByYear,
		getSetting,
		getStorageMode,
		getUnexportedAttachmentCount,
		importData,
		initializeDatabase,
		migrateAttachmentToNewFolder,
		purgeAllExportedBlobs,
		restoreAttachmentBlobs,
		seedTestData2024,
		setAutoPurgeBlobSetting,
		setLastExportedAt,
		setSetting,
		setStorageMode,
		validateExportData,
		type ImportMode,
		type ImportResult
	} from '$lib/db';
	import { setAvailableYears } from '$lib/stores/fiscalYear.svelte.js';
	import { useMigrationStore } from '$lib/stores/migration.svelte.js';
	import type { ExportData, StorageType, StorageUsage } from '$lib/types';
	import type { BusinessInfo } from '$lib/types/blue-return-types';
	import {
		clearDirectoryHandle,
		getDirectoryDisplayName,
		getSavedDirectoryHandle,
		pickDirectory,
		saveDirectoryHandle,
		supportsFileSystemAccess
	} from '$lib/utils/filesystem';
	import {
		formatBytes,
		getRecommendedUsagePercentage,
		getStorageUsage,
		RECOMMENDED_QUOTA,
		WARNING_THRESHOLD
	} from '$lib/utils/storage';
	import { downloadZip, exportToZip, type ZipExportProgress } from '$lib/utils/zip-export';
	import { importFromZip, isZipFile, type ZipImportProgress } from '$lib/utils/zip-import';
	import { omit } from '$lib/utils';
	import { createDebounce } from '$lib/utils/debounce';
	import {
		AlertTriangle,
		Archive,
		Check,
		Download,
		FileJson,
		FileSpreadsheet,
		Folder,
		FolderOpen,
		HardDrive,
		Loader2,
		RotateCcw,
		Settings,
		Trash2,
		Upload,
		X
	} from '@lucide/svelte';
	import { onMount } from 'svelte';

	// === 証憑保存設定 ===
	let storageMode = $state<StorageType>('indexeddb');
	let directoryHandle = $state<FileSystemDirectoryHandle | null>(null);
	let directoryName = $state<string | null>(null);
	let isFileSystemSupported = $state(false);
	let radioGroupKey = $state(0); // RadioGroup強制再レンダリング用

	// === マイグレーション ===
	const migration = useMigrationStore();
	let migrationDialogOpen = $state(false);
	let pendingStorageMode = $state<StorageType | null>(null);
	let migrationTargetCount = $state(0);

	// === フォルダ確認ダイアログ ===
	let folderConfirmDialogOpen = $state(false);

	// === フォルダ変更時のPDF移行 ===
	let folderMigrationDialogOpen = $state(false);
	let oldDirectoryHandle = $state<FileSystemDirectoryHandle | null>(null);
	let newDirectoryHandle = $state<FileSystemDirectoryHandle | null>(null);
	let folderMigrationCount = $state(0);
	let isFolderMigrating = $state(false);
	let folderMigrationProgress = $state(0);
	let folderMigrationError = $state<string | null>(null);

	// === 容量管理設定 ===
	let storageUsage = $state<StorageUsage>({ used: 0, quota: 0, percentage: 0 });
	let autoPurgeEnabled = $state(true);
	let retentionDays = $state(30);
	let isPurging = $state(false);
	let purgeResult = $state<string | null>(null);

	// Safari向け説明ダイアログ
	let safariDialogOpen = $state(false);

	// 派生値
	const recommendedPercentage = $derived(getRecommendedUsagePercentage(storageUsage.used));
	const isStorageWarning = $derived(recommendedPercentage >= WARNING_THRESHOLD);

	// === エクスポート関連 ===
	let availableYears = $state<number[]>([]);
	let isLoading = $state(true);
	let unexportedCount = $state(0);
	let exportingYear = $state<number | null>(null);
	let exportSuccess = $state<number | null>(null);

	// === ZIP エクスポート関連 ===
	let zipExportingYear = $state<number | null>(null);
	let zipProgress = $state<ZipExportProgress | null>(null);

	// === インポート関連 ===
	let importFile = $state<File | null>(null);
	let importData_ = $state<ExportData | null>(null);
	let importPreview = $state<{
		fiscalYear: number;
		journalCount: number;
		newJournalCount: number;
		accountCount: number;
		newAccountCount: number;
		vendorCount: number;
		newVendorCount: number;
	} | null>(null);
	let importMode = $state<ImportMode>('merge');
	let isImporting = $state(false);
	let importResult = $state<ImportResult | null>(null);
	let importError = $state<string | null>(null);
	// ZIP インポート用
	let isZipImport = $state(false);
	let zipImportBlobs = $state<Map<string, Blob>>(new Map());
	let zipImportWarnings = $state<string[]>([]);
	let zipImportProgress = $state<ZipImportProgress | null>(null);
	let blobRestoreResult = $state<{ restored: number; failed: number; errors: string[] } | null>(
		null
	);

	// === 年度削除関連 ===
	let deleteDialogOpen = $state(false);
	let deletingYear = $state<number | null>(null);
	let deletingYearSummary = $state<{ journalCount: number; attachmentCount: number } | null>(null);
	let deleteConfirmChecked = $state(false);
	let deleteConfirmInput = $state('');
	let isDeleting = $state(false);

	// === 開発用ツール ===
	let isSeeding = $state(false);
	let seedResult = $state<string | null>(null);

	// === 事業者情報 ===
	let businessInfo = $state<BusinessInfo>({
		name: '',
		tradeName: '',
		address: '',
		businessType: '',
		phoneNumber: '',
		email: '',
		bankName: '',
		branchName: '',
		accountType: 'ordinary',
		accountNumber: '',
		accountHolder: '',
		invoiceRegistrationNumber: ''
	});

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

		// 年度リスト
		availableYears = await getAvailableYears();

		// 事業者情報を読み込み
		const savedBusinessInfo = await getSetting('businessInfo');
		if (savedBusinessInfo) {
			businessInfo = savedBusinessInfo;
		}

		isLoading = false;
	});

	// 事業者情報を自動保存（デバウンス付き）
	const saveBusinessInfoDebounced = createDebounce(async () => {
		try {
			const snapshot = $state.snapshot(businessInfo);
			const plainBusinessInfo = JSON.parse(JSON.stringify(snapshot)) as BusinessInfo;
			await setSetting('businessInfo', plainBusinessInfo);
		} catch (e) {
			console.error('businessInfo自動保存エラー:', e);
		}
	}, 500);

	// === 保存モード関連 ===
	async function handleStorageModeChange(mode: StorageType) {
		// 同じモードなら何もしない
		if (mode === storageMode) return;

		// ファイルシステムモードへの切り替え
		if (mode === 'filesystem') {
			if (directoryHandle) {
				// 既存フォルダがある場合は確認ダイアログを表示
				pendingStorageMode = mode;
				folderConfirmDialogOpen = true;
				return;
			} else {
				// ディレクトリ未設定の場合は選択
				const handle = await pickDirectory();
				if (!handle) {
					radioGroupKey++;
					return;
				}
				directoryHandle = handle;
				directoryName = getDirectoryDisplayName(handle);
				await saveDirectoryHandle(handle);
			}
		}

		// マイグレーション対象があるかチェック
		const targetCount = await migration.getTargetCount(mode);

		if (targetCount > 0) {
			// 状態をリセットしてダイアログ表示
			migration.reset();
			pendingStorageMode = mode;
			migrationTargetCount = targetCount;
			migrationDialogOpen = true;
			return;
		}

		// マイグレーション不要の場合はモードを切り替え
		storageMode = mode;
		await setStorageMode(mode);
	}

	// フォルダ確認ダイアログ: このフォルダを使用
	async function handleConfirmCurrentFolder() {
		folderConfirmDialogOpen = false;

		// マイグレーション対象があるかチェック
		const targetCount = await migration.getTargetCount('filesystem');

		if (targetCount > 0) {
			migration.reset();
			pendingStorageMode = 'filesystem';
			migrationTargetCount = targetCount;
			migrationDialogOpen = true;
			return;
		}

		// マイグレーション不要の場合はモードを切り替え
		storageMode = 'filesystem';
		await setStorageMode('filesystem');
	}

	// フォルダ確認ダイアログ: 別のフォルダを選択
	async function handleSelectDifferentFolder() {
		folderConfirmDialogOpen = false;

		const handle = await pickDirectory();
		if (!handle) {
			radioGroupKey++;
			pendingStorageMode = null;
			return;
		}

		// 既存フォルダと異なる場合はPDF移行を確認
		if (directoryHandle && handle.name !== directoryHandle.name) {
			// filesystem添付ファイルの数を取得
			const count = await getFilesystemAttachmentCount();
			if (count > 0) {
				oldDirectoryHandle = directoryHandle;
				newDirectoryHandle = handle;
				folderMigrationCount = count;
				folderMigrationDialogOpen = true;
				return;
			}
		}

		// 移行対象がない場合はそのままフォルダを更新
		directoryHandle = handle;
		directoryName = getDirectoryDisplayName(handle);
		await saveDirectoryHandle(handle);

		// マイグレーション対象があるかチェック（ブラウザ→ローカル）
		const targetCount = await migration.getTargetCount('filesystem');
		if (targetCount > 0) {
			migration.reset();
			pendingStorageMode = 'filesystem';
			migrationTargetCount = targetCount;
			migrationDialogOpen = true;
			return;
		}

		storageMode = 'filesystem';
		await setStorageMode('filesystem');
	}

	// フォルダ確認ダイアログ: キャンセル
	function handleCancelFolderConfirm() {
		folderConfirmDialogOpen = false;
		pendingStorageMode = null;
		radioGroupKey++;
	}

	// === マイグレーション関連 ===
	async function handleStartMigration() {
		if (!pendingStorageMode || !directoryHandle) return;

		const success = await migration.startMigration(pendingStorageMode, directoryHandle);

		if (success) {
			storageMode = pendingStorageMode;
			migrationDialogOpen = false;
			pendingStorageMode = null;
			migrationTargetCount = 0;

			// ストレージ使用量を更新
			storageUsage = await getStorageUsage();
		}
	}

	function handleCancelMigration() {
		// マイグレーションをキャンセルし、モード切り替えも中止
		migration.cancel();
		migration.reset();
		migrationDialogOpen = false;
		pendingStorageMode = null;
		migrationTargetCount = 0;
		// RadioGroupの選択状態を元に戻すために強制再レンダリング
		radioGroupKey++;
	}

	function handleCloseMigrationDialog() {
		if (migration.isRunning) return;
		migration.reset();
		migrationDialogOpen = false;
		pendingStorageMode = null;
		migrationTargetCount = 0;
		// RadioGroupの選択状態を元に戻すために強制再レンダリング
		radioGroupKey++;
	}

	// === フォルダ変更時のPDF移行 ===
	async function handleStartFolderMigration() {
		if (!oldDirectoryHandle || !newDirectoryHandle) return;

		isFolderMigrating = true;
		folderMigrationProgress = 0;
		folderMigrationError = null;

		try {
			const items = await getAttachmentsForFolderMigration();
			const total = items.length;

			for (let i = 0; i < items.length; i++) {
				await migrateAttachmentToNewFolder(items[i], oldDirectoryHandle, newDirectoryHandle);
				folderMigrationProgress = (i + 1) / total;
			}

			// 成功したら新しいフォルダを設定
			directoryHandle = newDirectoryHandle;
			directoryName = getDirectoryDisplayName(newDirectoryHandle);
			await saveDirectoryHandle(newDirectoryHandle);

			// ダイアログを閉じる
			folderMigrationDialogOpen = false;
			oldDirectoryHandle = null;
			newDirectoryHandle = null;
			folderMigrationCount = 0;

			// モード切り替え（まだブラウザ保存だった場合）
			if (storageMode !== 'filesystem') {
				// ブラウザ→ローカルのマイグレーション対象をチェック
				const targetCount = await migration.getTargetCount('filesystem');
				if (targetCount > 0) {
					migration.reset();
					pendingStorageMode = 'filesystem';
					migrationTargetCount = targetCount;
					migrationDialogOpen = true;
				} else {
					storageMode = 'filesystem';
					await setStorageMode('filesystem');
				}
			}
		} catch (err) {
			folderMigrationError = err instanceof Error ? err.message : '不明なエラー';
		} finally {
			isFolderMigrating = false;
		}
	}

	function handleCancelFolderMigration() {
		// フォルダ変更をキャンセル（元のフォルダを使い続ける）
		folderMigrationDialogOpen = false;
		oldDirectoryHandle = null;
		newDirectoryHandle = null;
		folderMigrationCount = 0;
		folderMigrationProgress = 0;
		folderMigrationError = null;
		radioGroupKey++;
	}

	async function handleSelectDirectory() {
		const handle = await pickDirectory();
		if (!handle) return;

		// 既存フォルダと異なる場合はPDF移行を確認
		if (directoryHandle && storageMode === 'filesystem') {
			const count = await getFilesystemAttachmentCount();
			if (count > 0) {
				oldDirectoryHandle = directoryHandle;
				newDirectoryHandle = handle;
				folderMigrationCount = count;
				folderMigrationDialogOpen = true;
				return;
			}
		}

		// 移行対象がない場合はそのままフォルダを更新
		directoryHandle = handle;
		directoryName = getDirectoryDisplayName(handle);
		await saveDirectoryHandle(handle);

		if (storageMode !== 'filesystem') {
			storageMode = 'filesystem';
			await setStorageMode('filesystem');
		}
	}

	async function handleClearDirectory() {
		await clearDirectoryHandle();
		directoryHandle = null;
		directoryName = null;
		storageMode = 'indexeddb';
		await setStorageMode('indexeddb');
	}

	// === 容量管理関連 ===
	async function handleAutoPurgeChange(enabled: boolean) {
		autoPurgeEnabled = enabled;
		await setAutoPurgeBlobSetting(enabled);
	}

	async function handlePurgeExportedBlobs() {
		if (
			!confirm(
				'エクスポート済みの証憑データを削除しますか？\nメタデータは残りますが、PDFファイルは復元できなくなります。'
			)
		) {
			return;
		}

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

	// === エクスポート関連 ===
	async function createExportData(year: number): Promise<ExportData> {
		const [journals, accounts, vendors] = await Promise.all([
			getJournalsByYear(year),
			getAllAccounts(),
			getAllVendors()
		]);

		const journalsWithoutBlob = journals.map((journal) => ({
			...journal,
			attachments: journal.attachments.map((att) => omit(att, ['blob']))
		}));

		return {
			version: '1.0.0',
			exportedAt: new Date().toISOString(),
			fiscalYear: year,
			journals: journalsWithoutBlob,
			accounts,
			vendors,
			settings: {
				fiscalYearStart: 1,
				defaultCurrency: 'JPY',
				storageMode,
				autoPurgeBlobAfterExport: true,
				blobRetentionDays: 30
			}
		};
	}

	async function handleExportJSON(year: number) {
		exportingYear = year;
		try {
			const data = await createExportData(year);
			const json = JSON.stringify(data, null, 2);
			const blob = new Blob([json], { type: 'application/json' });
			downloadBlob(blob, `e-shiwake_${year}_export.json`);
			exportSuccess = year;
			setTimeout(() => {
				exportSuccess = null;
			}, 3000);
		} catch (error) {
			console.error('エクスポートエラー:', error);
			alert('エクスポートに失敗しました');
		} finally {
			exportingYear = null;
		}
	}

	async function handleExportCSV(year: number) {
		exportingYear = year;
		try {
			const journals = await getJournalsByYear(year);
			const accounts = await getAllAccounts();

			const accountMap = new Map(accounts.map((a) => [a.code, a.name]));

			const headers = [
				'日付',
				'摘要',
				'取引先',
				'借方科目',
				'借方金額',
				'貸方科目',
				'貸方金額',
				'証跡'
			];

			const rows = journals.flatMap((journal) => {
				const debitLines = journal.lines.filter((l) => l.type === 'debit');
				const creditLines = journal.lines.filter((l) => l.type === 'credit');
				const maxLines = Math.max(debitLines.length, creditLines.length);

				return Array.from({ length: maxLines }, (_, i) => {
					const debit = debitLines[i];
					const credit = creditLines[i];
					return [
						i === 0 ? journal.date : '',
						i === 0 ? journal.description : '',
						i === 0 ? journal.vendor : '',
						debit ? accountMap.get(debit.accountCode) || debit.accountCode : '',
						debit ? debit.amount.toString() : '',
						credit ? accountMap.get(credit.accountCode) || credit.accountCode : '',
						credit ? credit.amount.toString() : '',
						i === 0
							? journal.evidenceStatus === 'digital'
								? 'あり'
								: journal.evidenceStatus === 'paper'
									? '紙'
									: 'なし'
							: ''
					];
				});
			});

			const csvContent =
				'\uFEFF' +
				[headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join(
					'\n'
				);

			const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
			downloadBlob(blob, `e-shiwake_${year}_仕訳帳.csv`);
			exportSuccess = year;
			setTimeout(() => {
				exportSuccess = null;
			}, 3000);
		} catch (error) {
			console.error('CSVエクスポートエラー:', error);
			alert('CSVエクスポートに失敗しました');
		} finally {
			exportingYear = null;
		}
	}

	async function handleExportAttachments(year: number) {
		exportingYear = year;
		try {
			const journals = await getJournalsByYear(year);
			let exportedCount = 0;

			for (const journal of journals) {
				for (const attachment of journal.attachments) {
					if (attachment.storageType === 'indexeddb' && attachment.blob) {
						downloadBlob(attachment.blob, attachment.generatedName);
						exportedCount++;
						await new Promise((resolve) => setTimeout(resolve, 500));
					}
				}
			}

			if (exportedCount > 0) {
				await setLastExportedAt(new Date().toISOString());
				unexportedCount = await getUnexportedAttachmentCount();
				alert(`${exportedCount}件の証憑をダウンロードしました`);
			} else {
				alert('ダウンロードする証憑がありません');
			}

			exportSuccess = year;
			setTimeout(() => {
				exportSuccess = null;
			}, 3000);
		} catch (error) {
			console.error('証憑エクスポートエラー:', error);
			alert('証憑エクスポートに失敗しました');
		} finally {
			exportingYear = null;
		}
	}

	async function handleExportZip(year: number) {
		zipExportingYear = year;
		zipProgress = null;

		try {
			const journals = await getJournalsByYear(year);
			const accounts = await getAllAccounts();
			const vendors = await getAllVendors();

			const exportData: ExportData = {
				version: '1.0.0',
				exportedAt: new Date().toISOString(),
				fiscalYear: year,
				journals: journals.map((journal) => ({
					...journal,
					attachments: journal.attachments.map((att) => omit(att, ['blob']))
				})),
				accounts,
				vendors,
				settings: {
					fiscalYearStart: 1,
					defaultCurrency: 'JPY',
					storageMode,
					autoPurgeBlobAfterExport: autoPurgeEnabled,
					blobRetentionDays: retentionDays
				}
			};

			const zipBlob = await exportToZip(exportData, journals, {
				includeEvidences: true,
				directoryHandle,
				onProgress: (progress) => {
					zipProgress = progress;
				}
			});

			downloadZip(zipBlob, `e-shiwake_${year}_backup.zip`);

			// エクスポート成功を記録
			await setLastExportedAt(new Date().toISOString());
			unexportedCount = await getUnexportedAttachmentCount();

			exportSuccess = year;
			setTimeout(() => {
				exportSuccess = null;
			}, 3000);
		} catch (error) {
			console.error('ZIP エクスポートエラー:', error);
			alert('ZIP エクスポートに失敗しました');
		} finally {
			zipExportingYear = null;
			zipProgress = null;
		}
	}

	function downloadBlob(blob: Blob, filename: string) {
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	async function getYearSummary(
		year: number
	): Promise<{ journalCount: number; attachmentCount: number }> {
		const journals = await getJournalsByYear(year);
		const attachmentCount = journals.reduce((sum, j) => sum + j.attachments.length, 0);
		return { journalCount: journals.length, attachmentCount };
	}

	// === インポート関連 ===
	async function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];

		if (!file) return;

		// 状態をリセット
		importFile = file;
		importError = null;
		importResult = null;
		importPreview = null;
		importData_ = null;
		isZipImport = false;
		zipImportBlobs = new Map();
		zipImportWarnings = [];
		zipImportProgress = null;
		blobRestoreResult = null;

		try {
			if (isZipFile(file)) {
				// ZIPファイルの場合
				isZipImport = true;
				const result = await importFromZip(file, (progress) => {
					zipImportProgress = progress;
				});

				importData_ = result.exportData;
				zipImportBlobs = result.attachmentBlobs;
				zipImportWarnings = result.warnings;
				importPreview = await getImportPreview(result.exportData);
			} else {
				// JSONファイルの場合
				const text = await file.text();
				const data = JSON.parse(text);

				if (!validateExportData(data)) {
					importError =
						'ファイル形式が正しくありません。e-shiwakeからエクスポートしたファイルを選択してください。';
					return;
				}

				importData_ = data;
				importPreview = await getImportPreview(data);
			}
		} catch (e) {
			importError = e instanceof Error ? e.message : 'ファイルの読み込みに失敗しました。';
		}
	}

	async function handleImport() {
		if (!importData_) return;

		isImporting = true;
		importError = null;
		importResult = null;
		blobRestoreResult = null;

		try {
			const result = await importData(importData_, importMode);
			importResult = result;

			if (result.success) {
				// ZIPインポートの場合、証憑Blobを復元
				if (isZipImport && zipImportBlobs.size > 0) {
					blobRestoreResult = await restoreAttachmentBlobs(
						zipImportBlobs,
						storageMode,
						directoryHandle
					);
				}

				const years = await getAvailableYears();
				setAvailableYears(years);
				availableYears = years;
			}
		} catch (e) {
			importError = e instanceof Error ? e.message : 'インポート中にエラーが発生しました';
		} finally {
			isImporting = false;
		}
	}

	function handleClearImport() {
		importFile = null;
		importData_ = null;
		importPreview = null;
		importResult = null;
		importError = null;
		isZipImport = false;
		zipImportBlobs = new Map();
		zipImportWarnings = [];
		zipImportProgress = null;
		blobRestoreResult = null;
	}

	// === 年度削除関連 ===
	async function openDeleteDialog(year: number) {
		deletingYear = year;
		deletingYearSummary = await getYearSummary(year);
		deleteConfirmChecked = false;
		deleteConfirmInput = '';
		deleteDialogOpen = true;
	}

	const canDelete = $derived(
		deleteConfirmChecked && deletingYear !== null && deleteConfirmInput === String(deletingYear)
	);

	async function handleDeleteYear() {
		if (!deletingYear || !canDelete) return;

		isDeleting = true;
		try {
			await deleteYearData(deletingYear);

			const years = await getAvailableYears();
			setAvailableYears(years);
			availableYears = years;

			deleteDialogOpen = false;
			deletingYear = null;
			deletingYearSummary = null;
		} catch (error) {
			console.error('年度削除エラー:', error);
			alert('削除に失敗しました');
		} finally {
			isDeleting = false;
		}
	}

	// === 開発用ツール ===
	async function handleSeedData() {
		isSeeding = true;
		seedResult = null;
		try {
			await initializeDatabase();
			const count = await seedTestData2024();
			seedResult = `${count}件の仕訳を追加しました`;
			const years = await getAvailableYears();
			setAvailableYears(years);
			availableYears = years;
		} catch (error) {
			seedResult = `エラー: ${error instanceof Error ? error.message : '不明なエラー'}`;
		} finally {
			isSeeding = false;
		}
	}
</script>

<div class="space-y-6">
	<div
		class="sticky top-14 z-10 -mx-4 border-b bg-background px-4 pt-4 pb-3 group-has-data-[collapsible=icon]/sidebar-wrapper:top-12"
	>
		<h1 class="flex items-center gap-2 text-2xl font-bold">
			<Settings class="size-6" />
			設定・データ管理
		</h1>
		<p class="text-sm text-muted-foreground">証憑の保存設定とデータのエクスポート・インポート</p>
	</div>

	<!-- 事業者情報 -->
	<Card.Root>
		<Card.Header>
			<Card.Title>事業者情報</Card.Title>
			<Card.Description>請求書に表示される事業者情報を設定します（自動保存）</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-6">
			<!-- 基本情報 -->
			<div class="space-y-4">
				<h3 class="text-sm font-medium">基本情報</h3>
				<div class="grid gap-4 sm:grid-cols-2">
					<div class="space-y-2">
						<Label for="business-name">氏名 *</Label>
						<Input
							id="business-name"
							bind:value={businessInfo.name}
							placeholder="山田 太郎"
							oninput={saveBusinessInfoDebounced}
						/>
					</div>
					<div class="space-y-2">
						<Label for="business-trade-name">屋号</Label>
						<Input
							id="business-trade-name"
							bind:value={businessInfo.tradeName}
							placeholder="○○事務所"
							oninput={saveBusinessInfoDebounced}
						/>
					</div>
					<div class="space-y-2 sm:col-span-2">
						<Label for="business-address">住所 *</Label>
						<Input
							id="business-address"
							bind:value={businessInfo.address}
							placeholder="東京都○○区..."
							oninput={saveBusinessInfoDebounced}
						/>
					</div>
					<div class="space-y-2">
						<Label for="business-phone">電話番号</Label>
						<Input
							id="business-phone"
							bind:value={businessInfo.phoneNumber}
							placeholder="03-1234-5678"
							oninput={saveBusinessInfoDebounced}
						/>
					</div>
					<div class="space-y-2">
						<Label for="business-email">メールアドレス</Label>
						<Input
							id="business-email"
							type="email"
							bind:value={businessInfo.email}
							placeholder="info@example.com"
							oninput={saveBusinessInfoDebounced}
						/>
					</div>
				</div>
			</div>

			<!-- インボイス登録番号 -->
			<div class="space-y-4">
				<h3 class="text-sm font-medium">インボイス制度</h3>
				<div class="space-y-2">
					<Label for="invoice-registration">適格請求書発行事業者登録番号</Label>
					<Input
						id="invoice-registration"
						bind:value={businessInfo.invoiceRegistrationNumber}
						placeholder="T1234567890123"
						oninput={saveBusinessInfoDebounced}
					/>
					<p class="text-xs text-muted-foreground">
						登録番号は「T」+ 13桁の数字です。未登録の場合は空欄のままにしてください。
					</p>
				</div>
			</div>

			<!-- 振込先情報 -->
			<div class="space-y-4">
				<h3 class="text-sm font-medium">振込先情報</h3>
				<div class="grid gap-4 sm:grid-cols-2">
					<div class="space-y-2">
						<Label for="bank-name">銀行名</Label>
						<Input
							id="bank-name"
							bind:value={businessInfo.bankName}
							placeholder="○○銀行"
							oninput={saveBusinessInfoDebounced}
						/>
					</div>
					<div class="space-y-2">
						<Label for="branch-name">支店名</Label>
						<Input
							id="branch-name"
							bind:value={businessInfo.branchName}
							placeholder="○○支店"
							oninput={saveBusinessInfoDebounced}
						/>
					</div>
					<div class="space-y-2">
						<Label>口座種別</Label>
						<Select.Root
							type="single"
							value={businessInfo.accountType || 'ordinary'}
							onValueChange={(v) => {
								businessInfo.accountType = v as 'ordinary' | 'current';
								saveBusinessInfoDebounced();
							}}
						>
							<Select.Trigger>
								{businessInfo.accountType === 'current' ? '当座' : '普通'}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="ordinary">普通</Select.Item>
								<Select.Item value="current">当座</Select.Item>
							</Select.Content>
						</Select.Root>
					</div>
					<div class="space-y-2">
						<Label for="account-number">口座番号</Label>
						<Input
							id="account-number"
							bind:value={businessInfo.accountNumber}
							placeholder="1234567"
							oninput={saveBusinessInfoDebounced}
						/>
					</div>
					<div class="space-y-2 sm:col-span-2">
						<Label for="account-holder">口座名義</Label>
						<Input
							id="account-holder"
							bind:value={businessInfo.accountHolder}
							placeholder="ヤマダ タロウ"
							oninput={saveBusinessInfoDebounced}
						/>
					</div>
				</div>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- 証憑保存先設定 -->
	<Card.Root>
		<Card.Header>
			<Card.Title>証憑（PDF）の保存先</Card.Title>
			<Card.Description>仕訳に紐付けるPDFファイルの保存方法を選択します</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-6">
			{#if isFileSystemSupported}
				{#key radioGroupKey}
					<RadioGroup.Root
						value={storageMode}
						onValueChange={(v) => handleStorageModeChange(v as StorageType)}
					>
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
								<Label for="storage-indexeddb" class="font-medium">ブラウザに保存</Label>
								<p class="text-sm text-muted-foreground">
									ブラウザのIndexedDBに保存します。定期的にエクスポートしてバックアップしてください。
								</p>
							</div>
						</div>
					</RadioGroup.Root>
				{/key}

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
									<Button variant="ghost" onclick={handleClearDirectory}>クリア</Button>
								{/if}
							</div>
						</div>
					</div>
				{/if}

				{#if storageMode === 'indexeddb' && unexportedCount > 0}
					<div
						class="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950"
					>
						<AlertTriangle class="size-5 shrink-0 text-amber-500" />
						<div>
							<p class="font-medium text-amber-800 dark:text-amber-200">
								{unexportedCount}件の証憑が未エクスポートです
							</p>
							<p class="text-sm text-amber-700 dark:text-amber-300">
								ブラウザのデータは予期せず消える可能性があります。エクスポートでバックアップしてください。
							</p>
						</div>
					</div>
				{/if}
			{:else}
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
					<div
						class="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950"
					>
						<AlertTriangle class="size-5 shrink-0 text-amber-500" />
						<div>
							<p class="font-medium text-amber-800 dark:text-amber-200">
								{unexportedCount}件の証憑が未エクスポートです
							</p>
							<p class="text-sm text-amber-700 dark:text-amber-300">
								iPadやiPhoneではブラウザのデータが予期せず消える可能性があります。
								定期的にバックアップしてください。
							</p>
						</div>
					</div>
				{/if}
			{/if}
		</Card.Content>
	</Card.Root>

	<!-- ストレージ使用量（IndexedDBモード時のみ） -->
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

	<!-- エクスポートセクション -->
	<Card.Root>
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<Download class="size-5" />
				エクスポート
			</Card.Title>
			<Card.Description>年度別にデータをエクスポートします</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			{#if isLoading}
				<div class="flex items-center justify-center py-8">
					<p class="text-muted-foreground">読み込み中...</p>
				</div>
			{:else if availableYears.length === 0}
				<div class="py-4 text-center">
					<p class="text-muted-foreground">エクスポート可能なデータがありません</p>
				</div>
			{:else}
				{#each availableYears as year (year)}
					{#await getYearSummary(year)}
						<div class="rounded-lg border p-4">
							<p class="font-medium">{year}年度</p>
							<p class="text-sm text-muted-foreground">読み込み中...</p>
						</div>
					{:then summary}
						<div class="rounded-lg border p-4 {exportSuccess === year ? 'border-green-500' : ''}">
							<div class="mb-3 flex items-center justify-between">
								<div class="flex items-center gap-2">
									<p class="font-medium">{year}年度</p>
									{#if exportSuccess === year}
										<Check class="size-5 text-green-500" />
									{/if}
								</div>
								<div class="flex items-center gap-2">
									<p class="text-sm text-muted-foreground">
										{year}/1/1 - {year}/12/31
									</p>
									<Button
										variant="ghost"
										size="icon"
										class="size-7 text-muted-foreground hover:text-destructive"
										onclick={() => openDeleteDialog(year)}
									>
										<Trash2 class="size-4" />
										<span class="sr-only">年度を削除</span>
									</Button>
								</div>
							</div>

							<div class="mb-4 grid grid-cols-2 gap-4 text-sm">
								<div>
									<p class="text-muted-foreground">仕訳数</p>
									<p class="font-semibold">{summary.journalCount}件</p>
								</div>
								<div>
									<p class="text-muted-foreground">証憑</p>
									<p class="font-semibold">{summary.attachmentCount}ファイル</p>
								</div>
							</div>

							<div class="flex flex-wrap gap-2">
								<Button
									variant="outline"
									size="sm"
									onclick={() => handleExportJSON(year)}
									disabled={exportingYear !== null}
								>
									<FileJson class="mr-2 size-4" />
									JSON
								</Button>
								<Button
									variant="outline"
									size="sm"
									onclick={() => handleExportCSV(year)}
									disabled={exportingYear !== null}
								>
									<FileSpreadsheet class="mr-2 size-4" />
									CSV
								</Button>
								{#if storageMode === 'indexeddb' && summary.attachmentCount > 0}
									<Button
										variant="outline"
										size="sm"
										onclick={() => handleExportAttachments(year)}
										disabled={exportingYear !== null}
									>
										<Download class="mr-2 size-4" />
										証憑ダウンロード
									</Button>
								{/if}
								<Button
									variant="outline"
									size="sm"
									onclick={() => handleExportZip(year)}
									disabled={zipExportingYear !== null || exportingYear !== null}
								>
									{#if zipExportingYear === year}
										<Loader2 class="mr-2 size-4 animate-spin" />
										{#if zipProgress}
											{zipProgress.message}
										{:else}
											準備中...
										{/if}
									{:else}
										<Archive class="mr-2 size-4" />
										ZIP
									{/if}
								</Button>
							</div>
						</div>
					{/await}
				{/each}
			{/if}
		</Card.Content>
	</Card.Root>

	<!-- インポートセクション -->
	<Card.Root>
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<Upload class="size-5" />
				インポート
			</Card.Title>
			<Card.Description>エクスポートしたJSONファイルからデータを復元します</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-6">
			<div class="space-y-2">
				<Label for="import-file">JSON/ZIPファイルを選択</Label>
				<div class="flex items-center gap-2">
					<input
						id="import-file"
						type="file"
						accept=".json,.zip,application/json,application/zip"
						onchange={handleFileSelect}
						class="hidden"
					/>
					<Button variant="outline" onclick={() => document.getElementById('import-file')?.click()}>
						<FileJson class="mr-2 size-4" />
						ファイルを選択
					</Button>
					{#if importFile}
						<span class="text-sm text-muted-foreground">{importFile.name}</span>
						<Button variant="ghost" size="icon" onclick={handleClearImport}>
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

			{#if importPreview && !importResult}
				<div class="space-y-4 rounded-lg border p-4">
					<div class="flex items-center gap-2">
						{#if isZipImport}
							<Archive class="size-5 text-primary" />
						{:else}
							<FileJson class="size-5 text-primary" />
						{/if}
						<span class="font-medium">{importPreview.fiscalYear}年度のデータ</span>
						{#if isZipImport}
							<span class="text-xs text-muted-foreground">（ZIPファイル）</span>
						{/if}
					</div>

					<div class="grid grid-cols-3 gap-4 text-sm">
						<div>
							<p class="text-muted-foreground">仕訳</p>
							<p class="font-semibold">
								{importPreview.journalCount}件
								{#if importPreview.newJournalCount > 0}
									<span class="text-green-600">（新規 {importPreview.newJournalCount}件）</span>
								{/if}
							</p>
						</div>
						<div>
							<p class="text-muted-foreground">勘定科目</p>
							<p class="font-semibold">
								{importPreview.accountCount}件
								{#if importPreview.newAccountCount > 0}
									<span class="text-green-600">（新規 {importPreview.newAccountCount}件）</span>
								{/if}
							</p>
						</div>
						<div>
							<p class="text-muted-foreground">取引先</p>
							<p class="font-semibold">
								{importPreview.vendorCount}件
								{#if importPreview.newVendorCount > 0}
									<span class="text-green-600">（新規 {importPreview.newVendorCount}件）</span>
								{/if}
							</p>
						</div>
					</div>

					{#if isZipImport && zipImportBlobs.size > 0}
						<div class="flex items-center gap-2 rounded-md bg-muted p-2 text-sm">
							<Archive class="size-4" />
							<span>証憑ファイル: {zipImportBlobs.size}件</span>
							<span class="text-muted-foreground">（現在の保存設定に従って復元されます）</span>
						</div>
						{#if zipImportWarnings.length > 0}
							<div class="text-xs text-amber-600">
								<p>警告: {zipImportWarnings.length}件</p>
							</div>
						{/if}
					{/if}

					<div class="space-y-2 border-t pt-2">
						<Label>インポートモード</Label>
						<RadioGroup.Root bind:value={importMode}>
							<div class="flex items-start space-x-3">
								<RadioGroup.Item value="merge" id="import-merge" />
								<div class="grid gap-1">
									<Label for="import-merge" class="font-medium">マージ（推奨）</Label>
									<p class="text-sm text-muted-foreground">
										既存のデータを残し、新規データのみ追加します
									</p>
								</div>
							</div>
							<div class="flex items-start space-x-3">
								<RadioGroup.Item value="overwrite" id="import-overwrite" />
								<div class="grid gap-1">
									<Label for="import-overwrite" class="font-medium">上書き</Label>
									<p class="text-sm text-muted-foreground">
										対象年度の既存データを削除して置き換えます
									</p>
								</div>
							</div>
						</RadioGroup.Root>
					</div>

					<div class="pt-2">
						<Button onclick={handleImport} disabled={isImporting}>
							<Upload class="mr-2 size-4" />
							{isImporting ? 'インポート中...' : 'インポート実行'}
						</Button>
					</div>
				</div>
			{/if}

			{#if importResult}
				<div class="space-y-3 rounded-lg border p-4">
					{#if importResult.success}
						<div class="flex items-center gap-2 text-green-600">
							<Check class="size-5" />
							<span class="font-medium">インポート完了</span>
						</div>
						<div class="grid grid-cols-3 gap-4 text-sm">
							<div>
								<p class="text-muted-foreground">仕訳</p>
								<p class="font-semibold">{importResult.journalsImported}件</p>
							</div>
							<div>
								<p class="text-muted-foreground">勘定科目</p>
								<p class="font-semibold">{importResult.accountsImported}件</p>
							</div>
							<div>
								<p class="text-muted-foreground">取引先</p>
								<p class="font-semibold">{importResult.vendorsImported}件</p>
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
								{#if blobRestoreResult.errors.length > 0}
									<div class="mt-2 text-xs text-muted-foreground">
										{#each blobRestoreResult.errors.slice(0, 3) as error, i (i)}
											<p>{error}</p>
										{/each}
										{#if blobRestoreResult.errors.length > 3}
											<p>...他 {blobRestoreResult.errors.length - 3}件</p>
										{/if}
									</div>
								{/if}
							</div>
						{/if}
					{:else}
						<div class="flex items-center gap-2 text-destructive">
							<X class="size-5" />
							<span class="font-medium">インポート失敗</span>
						</div>
						{#each importResult.errors as error, i (i)}
							<p class="text-sm text-destructive">{error}</p>
						{/each}
					{/if}
					<Button variant="outline" size="sm" onclick={handleClearImport}>
						別のファイルを選択
					</Button>
				</div>
			{/if}

			<p class="text-sm text-muted-foreground">
				※証憑ファイル（PDF）はインポートされません。証憑は別途保存してください。
			</p>
		</Card.Content>
	</Card.Root>

	<!-- データ形式について -->
	<Card.Root>
		<Card.Header>
			<Card.Title class="text-base">データ形式について</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-3 text-sm text-muted-foreground">
			<div>
				<p class="font-medium text-foreground">JSON</p>
				<p>
					仕訳・勘定科目・取引先・設定を含む完全なデータ。バックアップや他端末への移行に使用します。
				</p>
			</div>
			<div>
				<p class="font-medium text-foreground">CSV</p>
				<p>仕訳データのみをフラット形式で出力。Excel等での確認や他ソフトへの連携に使用します。</p>
			</div>
			<div>
				<p class="font-medium text-foreground">証憑ダウンロード</p>
				<p>ブラウザに保存されている証憑PDFを個別にダウンロードします（iPad向け）。</p>
			</div>
			<div>
				<p class="font-medium text-foreground">ZIP（完全バックアップ）</p>
				<p>JSON + 証憑PDFをZIPにまとめてダウンロード。年次アーカイブに最適です。</p>
			</div>
		</Card.Content>
	</Card.Root>

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
					<p class="text-sm text-muted-foreground">テスト用に2024年の仕訳データ14件を追加します</p>
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

	<p class="text-sm text-muted-foreground">
		電子帳簿保存法により、証憑は7年間の保存が必要です。定期的にバックアップを行ってください。
	</p>
</div>

<!-- 年度削除確認ダイアログ -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title class="flex items-center gap-2">
				<AlertTriangle class="size-5 text-destructive" />
				{deletingYear}年度のデータを削除
			</AlertDialog.Title>
			<AlertDialog.Description class="space-y-3">
				<p>以下のデータが完全に削除されます。</p>
				{#if deletingYearSummary}
					<ul class="list-inside list-disc space-y-1 text-foreground">
						<li>仕訳 {deletingYearSummary.journalCount}件</li>
						<li>証憑 {deletingYearSummary.attachmentCount}ファイル</li>
					</ul>
				{/if}
				<div
					class="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
				>
					<AlertTriangle class="mt-0.5 size-4 shrink-0" />
					<p class="text-sm">電帳法により7年間の保存が必要です</p>
				</div>
			</AlertDialog.Description>
		</AlertDialog.Header>

		<div class="space-y-4 py-4">
			<div class="flex items-start gap-3">
				<input
					type="checkbox"
					id="delete-confirm-check"
					checked={deleteConfirmChecked}
					onchange={(e) => (deleteConfirmChecked = e.currentTarget.checked)}
					class="size-4 rounded border-gray-300"
				/>
				<Label for="delete-confirm-check" class="text-sm leading-relaxed">
					エクスポート済みであることを確認しました
				</Label>
			</div>

			<div class="space-y-2">
				<Label for="delete-confirm-input" class="text-sm">
					削除を確定するには「{deletingYear}」と入力：
				</Label>
				<input
					type="text"
					id="delete-confirm-input"
					value={deleteConfirmInput}
					oninput={(e) => (deleteConfirmInput = e.currentTarget.value)}
					placeholder={String(deletingYear)}
					class="flex h-9 max-w-32 rounded-md border border-input bg-background px-3 py-1 text-base shadow-xs outline-none"
				/>
			</div>
		</div>

		<AlertDialog.Footer>
			<AlertDialog.Cancel>キャンセル</AlertDialog.Cancel>
			<Button
				variant="destructive"
				onclick={handleDeleteYear}
				disabled={!canDelete || isDeleting}
				class="bg-destructive/80 text-white hover:bg-destructive/70"
			>
				{isDeleting ? '削除中...' : '削除'}
			</Button>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<!-- Safari向け説明ダイアログ -->
<SafariStorageDialog bind:open={safariDialogOpen} onconfirm={() => {}} />

<!-- マイグレーション確認ダイアログ -->
<AlertDialog.Root bind:open={migrationDialogOpen} onOpenChange={handleCloseMigrationDialog}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title class="flex items-center gap-2">
				{#if migration.isRunning}
					<Loader2 class="size-5 animate-spin" />
				{:else}
					<HardDrive class="size-5" />
				{/if}
				証憑データの移行
			</AlertDialog.Title>
			<AlertDialog.Description class="space-y-3">
				{#if !migration.isRunning && migration.errors.length === 0}
					<p>
						{pendingStorageMode === 'filesystem'
							? 'ブラウザに保存されている'
							: 'フォルダに保存されている'}証憑データを移行しますか？
					</p>
					<p class="text-foreground">
						対象: <strong>{migrationTargetCount}件</strong>の添付ファイル
					</p>
					<p class="text-sm">
						{pendingStorageMode === 'filesystem'
							? '移行すると、証憑PDFがブラウザ内からフォルダに移動します。'
							: '移行すると、証憑PDFがフォルダからブラウザ内に移動します。'}
					</p>
				{:else if migration.isRunning}
					<p>証憑データを移行中です。しばらくお待ちください...</p>
				{:else if migration.errors.length > 0}
					<p class="text-destructive">一部のファイルの移行に失敗しました。</p>
				{/if}
			</AlertDialog.Description>
		</AlertDialog.Header>

		{#if migration.isRunning || migration.progress > 0}
			<div class="space-y-4 py-4">
				<Progress value={migration.progress * 100} class="w-full" />
				<p class="text-center text-sm text-muted-foreground">
					{migration.completed} / {migration.total} 完了
					{#if migration.errors.length > 0}
						<span class="text-destructive">（{migration.errors.length}件のエラー）</span>
					{/if}
				</p>
			</div>
		{/if}

		{#if migration.errors.length > 0 && !migration.isRunning}
			<div
				class="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-destructive/50 bg-destructive/10 p-3"
			>
				<p class="text-sm font-medium text-destructive">エラー一覧:</p>
				{#each migration.errors as error (error.attachmentId)}
					<p class="text-xs text-destructive">
						{error.fileName}: {error.error}
					</p>
				{/each}
			</div>
		{/if}

		<AlertDialog.Footer>
			{#if !migration.isRunning && migration.progress === 0}
				<AlertDialog.Cancel onclick={handleCancelMigration}>キャンセル</AlertDialog.Cancel>
				<Button onclick={handleStartMigration}>移行を開始</Button>
			{:else if migration.isRunning}
				<Button variant="outline" onclick={handleCancelMigration}>中止</Button>
			{:else}
				<Button onclick={handleCloseMigrationDialog}>閉じる</Button>
			{/if}
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<!-- フォルダ確認ダイアログ -->
<AlertDialog.Root bind:open={folderConfirmDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title class="flex items-center gap-2">
				<Folder class="size-5" />
				保存先フォルダの確認
			</AlertDialog.Title>
			<AlertDialog.Description class="space-y-3">
				<p>以下のフォルダに証憑PDFを保存します。</p>
				<div class="flex items-center gap-2 rounded-lg border p-3">
					<FolderOpen class="size-5 text-green-500" />
					<span class="font-medium">{directoryName}</span>
				</div>
			</AlertDialog.Description>
		</AlertDialog.Header>

		<AlertDialog.Footer class="flex-col gap-2 sm:flex-row">
			<AlertDialog.Cancel onclick={handleCancelFolderConfirm}>キャンセル</AlertDialog.Cancel>
			<Button variant="outline" onclick={handleSelectDifferentFolder}>別のフォルダを選択</Button>
			<Button onclick={handleConfirmCurrentFolder}>このフォルダを使用</Button>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<!-- フォルダ移行ダイアログ -->
<AlertDialog.Root bind:open={folderMigrationDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title class="flex items-center gap-2">
				{#if isFolderMigrating}
					<Loader2 class="size-5 animate-spin" />
				{:else}
					<Folder class="size-5" />
				{/if}
				証憑PDFの移行
			</AlertDialog.Title>
			<AlertDialog.Description class="space-y-3">
				{#if !isFolderMigrating && !folderMigrationError}
					<p>
						既存のPDFファイル（<strong>{folderMigrationCount}件</strong
						>）を新しいフォルダに移動しますか？
					</p>
					<p class="text-sm text-muted-foreground">
						移行しない場合、証憑PDFへのアクセスができなくなります。
					</p>
				{:else if isFolderMigrating}
					<p>PDFファイルを移行中です。しばらくお待ちください...</p>
				{:else if folderMigrationError}
					<p class="text-destructive">移行中にエラーが発生しました: {folderMigrationError}</p>
				{/if}
			</AlertDialog.Description>
		</AlertDialog.Header>

		{#if isFolderMigrating || folderMigrationProgress > 0}
			<div class="space-y-4 py-4">
				<Progress value={folderMigrationProgress * 100} class="w-full" />
				<p class="text-center text-sm text-muted-foreground">
					{Math.round(folderMigrationProgress * 100)}% 完了
				</p>
			</div>
		{/if}

		<AlertDialog.Footer>
			{#if !isFolderMigrating && folderMigrationProgress === 0}
				<AlertDialog.Cancel onclick={handleCancelFolderMigration}>
					キャンセル（フォルダ変更を中止）
				</AlertDialog.Cancel>
				<Button onclick={handleStartFolderMigration}>移行を開始</Button>
			{:else if isFolderMigrating}
				<Button variant="outline" disabled>移行中...</Button>
			{:else}
				<Button onclick={handleCancelFolderMigration}>閉じる</Button>
			{/if}
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
