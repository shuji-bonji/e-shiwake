<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as RadioGroup from '$lib/components/ui/radio-group/index.js';
	import {
		deleteYearData,
		getAllAccounts,
		getAllVendors,
		getAvailableYears,
		getImportPreview,
		getJournalsByYear,
		getStorageMode,
		getUnexportedAttachmentCount,
		importData,
		initializeDatabase,
		setLastExportedAt,
		validateExportData,
		type ImportMode,
		type ImportResult
	} from '$lib/db';
	import { setAvailableYears } from '$lib/stores/fiscalYear.svelte.js';
	import type { ExportData, StorageType } from '$lib/types';
	import {
		AlertTriangle,
		Archive,
		Check,
		Database,
		Download,
		FileJson,
		FileSpreadsheet,
		Trash2,
		Upload,
		X
	} from '@lucide/svelte';
	import { onMount } from 'svelte';

	// エクスポート関連の状態
	let availableYears = $state<number[]>([]);
	let isLoading = $state(true);
	let storageMode = $state<StorageType>('indexeddb');
	let unexportedCount = $state(0);
	let exportingYear = $state<number | null>(null);
	let exportSuccess = $state<number | null>(null);

	// インポート関連の状態
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

	// 年度削除関連の状態
	let deleteDialogOpen = $state(false);
	let deletingYear = $state<number | null>(null);
	let deletingYearSummary = $state<{ journalCount: number; attachmentCount: number } | null>(null);
	let deleteConfirmChecked = $state(false);
	let deleteConfirmInput = $state('');
	let isDeleting = $state(false);

	// 初期化
	onMount(async () => {
		await initializeDatabase();
		availableYears = await getAvailableYears();
		storageMode = await getStorageMode();
		unexportedCount = await getUnexportedAttachmentCount();
		isLoading = false;
	});

	// JSONエクスポートデータを作成
	async function createExportData(year: number): Promise<ExportData> {
		const [journals, accounts, vendors] = await Promise.all([
			getJournalsByYear(year),
			getAllAccounts(),
			getAllVendors()
		]);

		// Blobは除外してJSONに含める
		const journalsWithoutBlob = journals.map((journal) => ({
			...journal,
			attachments: journal.attachments.map((att) => {
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				const { blob, ...rest } = att;
				return rest;
			})
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

	// JSONエクスポート
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

	// CSVエクスポート
	async function handleExportCSV(year: number) {
		exportingYear = year;
		try {
			const journals = await getJournalsByYear(year);
			const accounts = await getAllAccounts();

			const accountMap = new Map(accounts.map((a) => [a.code, a.name]));

			// CSVヘッダー
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

			// CSVデータ行を作成
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

			// CSVを生成（BOM付きでExcel対応）
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

	// 証憑一括エクスポート（iPad向け）
	async function handleExportAttachments(year: number) {
		exportingYear = year;
		try {
			const journals = await getJournalsByYear(year);
			let exportedCount = 0;

			for (const journal of journals) {
				for (const attachment of journal.attachments) {
					// IndexedDBに保存されている未エクスポートの添付ファイルのみ
					if (attachment.storageType === 'indexeddb' && attachment.blob) {
						downloadBlob(attachment.blob, attachment.generatedName);
						exportedCount++;

						// ダウンロード間隔を空ける（ブラウザ制限対策）
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

	// Blobをダウンロード
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

	// 年度のデータ概要を取得
	async function getYearSummary(
		year: number
	): Promise<{ journalCount: number; attachmentCount: number }> {
		const journals = await getJournalsByYear(year);
		const attachmentCount = journals.reduce((sum, j) => sum + j.attachments.length, 0);
		return { journalCount: journals.length, attachmentCount };
	}

	// インポートファイル選択
	async function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];

		if (!file) return;

		importFile = file;
		importError = null;
		importResult = null;
		importPreview = null;
		importData_ = null;

		try {
			const text = await file.text();
			const data = JSON.parse(text);

			if (!validateExportData(data)) {
				importError =
					'ファイル形式が正しくありません。e-shiwakeからエクスポートしたJSONファイルを選択してください。';
				return;
			}

			importData_ = data;
			importPreview = await getImportPreview(data);
		} catch {
			importError = 'ファイルの読み込みに失敗しました。有効なJSONファイルを選択してください。';
		}
	}

	// インポート実行
	async function handleImport() {
		if (!importData_) return;

		isImporting = true;
		importError = null;
		importResult = null;

		try {
			const result = await importData(importData_, importMode);
			importResult = result;

			if (result.success) {
				// 年度リストを更新
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

	// インポートをクリア
	function handleClearImport() {
		importFile = null;
		importData_ = null;
		importPreview = null;
		importResult = null;
		importError = null;
	}

	// 削除ダイアログを開く
	async function openDeleteDialog(year: number) {
		deletingYear = year;
		deletingYearSummary = await getYearSummary(year);
		deleteConfirmChecked = false;
		deleteConfirmInput = '';
		deleteDialogOpen = true;
	}

	// 削除確認の入力が完了しているか
	const canDelete = $derived(
		deleteConfirmChecked && deletingYear !== null && deleteConfirmInput === String(deletingYear)
	);

	// 年度削除を実行
	async function handleDeleteYear() {
		if (!deletingYear || !canDelete) return;

		isDeleting = true;
		try {
			await deleteYearData(deletingYear);

			// 年度リストを更新
			const years = await getAvailableYears();
			setAvailableYears(years);
			availableYears = years;

			// ダイアログを閉じる
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
</script>

<div class="space-y-6">
	<div>
		<h1 class="flex items-center gap-2 text-2xl font-bold">
			<Database class="size-6" />
			データ管理
		</h1>
		<p class="text-sm text-muted-foreground">データのエクスポート・インポートを行います</p>
	</div>

	<!-- 未エクスポート警告（IndexedDBモード時） -->
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
					ブラウザのデータは予期せず消える可能性があります。証憑ファイルをダウンロードしてバックアップしてください。
				</p>
			</div>
		</div>
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
								<Button variant="secondary" size="sm" disabled class="opacity-50">
									<Archive class="mr-2 size-4" />
									完全バックアップ
									<span class="ml-2 text-xs">(準備中)</span>
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
			<!-- ファイル選択 -->
			<div class="space-y-2">
				<Label for="import-file">JSONファイルを選択</Label>
				<div class="flex items-center gap-2">
					<input
						id="import-file"
						type="file"
						accept=".json,application/json"
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

			<!-- エラー表示 -->
			{#if importError}
				<div
					class="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4"
				>
					<AlertTriangle class="size-5 shrink-0 text-destructive" />
					<p class="text-sm text-destructive">{importError}</p>
				</div>
			{/if}

			<!-- プレビュー表示 -->
			{#if importPreview && !importResult}
				<div class="space-y-4 rounded-lg border p-4">
					<div class="flex items-center gap-2">
						<FileJson class="size-5 text-primary" />
						<span class="font-medium">{importPreview.fiscalYear}年度のデータ</span>
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

					<!-- インポートモード選択 -->
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

					<!-- インポートボタン -->
					<div class="pt-2">
						<Button onclick={handleImport} disabled={isImporting}>
							<Upload class="mr-2 size-4" />
							{isImporting ? 'インポート中...' : 'インポート実行'}
						</Button>
					</div>
				</div>
			{/if}

			<!-- インポート結果 -->
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

	<!-- 説明 -->
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
				<p class="font-medium text-foreground">完全バックアップ（準備中）</p>
				<p>JSON + 証憑PDFをZIPにまとめてダウンロード。年次アーカイブに最適です。</p>
			</div>
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
			<!-- チェックボックス確認 -->
			<div class="flex items-start gap-3">
				<Checkbox
					id="delete-confirm-check"
					checked={deleteConfirmChecked}
					onCheckedChange={(v) => (deleteConfirmChecked = !!v)}
				/>
				<Label for="delete-confirm-check" class="text-sm leading-relaxed">
					エクスポート済みであることを確認しました
				</Label>
			</div>

			<!-- 年度入力確認 -->
			<div class="space-y-2">
				<Label for="delete-confirm-input" class="text-sm">
					削除を確定するには「{deletingYear}」と入力：
				</Label>
				<Input
					id="delete-confirm-input"
					bind:value={deleteConfirmInput}
					placeholder={String(deletingYear)}
					class="max-w-32"
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
