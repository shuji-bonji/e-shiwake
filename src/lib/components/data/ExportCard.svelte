<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import {
		deleteYearData,
		getAllAccounts,
		getAllVendors,
		getAvailableYears,
		getJournalsByYear,
		getUnexportedAttachmentCount,
		setLastExportedAt
	} from '$lib/db';
	import { setAvailableYears } from '$lib/stores/fiscalYear.svelte.js';
	import type { ExportData, StorageType } from '$lib/types';
	import { omit } from '$lib/utils';
	import { downloadZip, exportToZip, type ZipExportProgress } from '$lib/utils/zip-export';
	import {
		AlertTriangle,
		Archive,
		Check,
		Download,
		FileJson,
		FileSpreadsheet,
		Loader2,
		Trash2
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	interface Props {
		availableYears: number[];
		isLoading: boolean;
		storageMode: StorageType;
		directoryHandle: FileSystemDirectoryHandle | null;
		unexportedCount: number;
		autoPurgeEnabled: boolean;
		retentionDays: number;
		onyearschange: (years: number[]) => void;
		onunexportedcountchange: (count: number) => void;
	}

	let {
		availableYears,
		isLoading,
		storageMode,
		directoryHandle,
		unexportedCount = $bindable(),
		autoPurgeEnabled,
		retentionDays,
		onyearschange,
		onunexportedcountchange
	}: Props = $props();

	// === エクスポート状態 ===
	let exportingYear = $state<number | null>(null);
	let exportSuccess = $state<number | null>(null);
	let zipExportingYear = $state<number | null>(null);
	let zipProgress = $state<ZipExportProgress | null>(null);

	// === 年度削除状態 ===
	let deleteDialogOpen = $state(false);
	let deletingYear = $state<number | null>(null);
	let deletingYearSummary = $state<{ journalCount: number; attachmentCount: number } | null>(null);
	let deleteConfirmChecked = $state(false);
	let deleteConfirmInput = $state('');
	let isDeleting = $state(false);

	const canDelete = $derived(
		deleteConfirmChecked && deletingYear !== null && deleteConfirmInput === String(deletingYear)
	);

	// === ユーティリティ ===
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

	// === エクスポートハンドラ ===
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
			toast.error('エクスポートに失敗しました');
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
			toast.error('CSVエクスポートに失敗しました');
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
				onunexportedcountchange(unexportedCount);
				toast.success(`${exportedCount}件の証憑をダウンロードしました`);
			} else {
				toast.info('ダウンロードする証憑がありません');
			}

			exportSuccess = year;
			setTimeout(() => {
				exportSuccess = null;
			}, 3000);
		} catch (error) {
			console.error('証憑エクスポートエラー:', error);
			toast.error('証憑エクスポートに失敗しました');
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

			await setLastExportedAt(new Date().toISOString());
			unexportedCount = await getUnexportedAttachmentCount();
			onunexportedcountchange(unexportedCount);

			exportSuccess = year;
			setTimeout(() => {
				exportSuccess = null;
			}, 3000);
		} catch (error) {
			console.error('ZIP エクスポートエラー:', error);
			toast.error('ZIP エクスポートに失敗しました');
		} finally {
			zipExportingYear = null;
			zipProgress = null;
		}
	}

	// === 年度削除 ===
	async function openDeleteDialog(year: number) {
		deletingYear = year;
		deletingYearSummary = await getYearSummary(year);
		deleteConfirmChecked = false;
		deleteConfirmInput = '';
		deleteDialogOpen = true;
	}

	async function handleDeleteYear() {
		if (!deletingYear || !canDelete) return;

		isDeleting = true;
		try {
			await deleteYearData(deletingYear);

			const years = await getAvailableYears();
			setAvailableYears(years);
			onyearschange(years);

			deleteDialogOpen = false;
			deletingYear = null;
			deletingYearSummary = null;
		} catch (error) {
			console.error('年度削除エラー:', error);
			toast.error('削除に失敗しました');
		} finally {
			isDeleting = false;
		}
	}
</script>

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
