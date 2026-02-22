<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as RadioGroup from '$lib/components/ui/radio-group/index.js';
	import {
		getAvailableYears,
		getImportPreview,
		importData,
		restoreAttachmentBlobs,
		validateExportData,
		type ImportMode,
		type ImportResult
	} from '$lib/db';
	import { setAvailableYears } from '$lib/stores/fiscalYear.svelte.js';
	import type { ExportData, StorageType } from '$lib/types';
	import { importFromZip, isZipFile, type ZipImportProgress } from '$lib/utils/zip-import';
	import { AlertTriangle, Archive, Check, FileJson, Loader2, Upload, X } from '@lucide/svelte';

	interface Props {
		storageMode: StorageType;
		directoryHandle: FileSystemDirectoryHandle | null;
		onyearschange: (years: number[]) => void;
	}

	let { storageMode, directoryHandle, onyearschange }: Props = $props();

	// === インポート状態 ===
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

	// === ハンドラ ===
	async function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];

		if (!file) return;

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
				isZipImport = true;
				const result = await importFromZip(file, (progress) => {
					zipImportProgress = progress;
				});

				importData_ = result.exportData;
				zipImportBlobs = result.attachmentBlobs;
				zipImportWarnings = result.warnings;
				importPreview = await getImportPreview(result.exportData);
			} else {
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
				if (isZipImport && zipImportBlobs.size > 0) {
					blobRestoreResult = await restoreAttachmentBlobs(
						zipImportBlobs,
						storageMode,
						directoryHandle
					);
				}

				const years = await getAvailableYears();
				setAvailableYears(years);
				onyearschange(years);
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
</script>

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
				<Button variant="outline" size="sm" onclick={handleClearImport}>別のファイルを選択</Button>
			</div>
		{/if}

		<p class="text-sm text-muted-foreground">
			※証憑ファイル（PDF）はインポートされません。証憑は別途保存してください。
		</p>
	</Card.Content>
</Card.Root>
