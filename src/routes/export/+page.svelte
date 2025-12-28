<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import {
		Download,
		FileJson,
		FileSpreadsheet,
		Archive,
		AlertTriangle,
		Check
	} from '@lucide/svelte';
	import {
		initializeDatabase,
		getAvailableYears,
		getJournalsByYear,
		getAllAccounts,
		getAllVendors,
		getUnexportedAttachmentCount,
		getStorageMode,
		setLastExportedAt,
		markAttachmentAsExported
	} from '$lib/db';
	import type { ExportData, StorageType } from '$lib/types';

	// 状態
	let availableYears = $state<number[]>([]);
	let isLoading = $state(true);
	let storageMode = $state<StorageType>('indexeddb');
	let unexportedCount = $state(0);
	let exportingYear = $state<number | null>(null);
	let exportSuccess = $state<number | null>(null);

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

						// 個別の添付ファイルをエクスポート済みとしてマーク
						await markAttachmentAsExported(journal.id, attachment.id);
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
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold">エクスポート</h1>
		<p class="text-sm text-muted-foreground">年度別にデータをエクスポートします</p>
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

	{#if isLoading}
		<div class="flex items-center justify-center py-8">
			<p class="text-muted-foreground">読み込み中...</p>
		</div>
	{:else}
		<div class="space-y-4">
			{#each availableYears as year (year)}
				{#await getYearSummary(year)}
					<Card.Root>
						<Card.Header>
							<Card.Title class="flex items-center gap-2">
								{year}年度
							</Card.Title>
						</Card.Header>
						<Card.Content>
							<p class="text-muted-foreground">読み込み中...</p>
						</Card.Content>
					</Card.Root>
				{:then summary}
					<Card.Root class={exportSuccess === year ? 'border-green-500' : ''}>
						<Card.Header>
							<Card.Title class="flex items-center gap-2">
								{year}年度
								{#if exportSuccess === year}
									<Check class="size-5 text-green-500" />
								{/if}
							</Card.Title>
							<Card.Description>
								{year}/1/1 - {year}/12/31
							</Card.Description>
						</Card.Header>
						<Card.Content class="space-y-4">
							<div class="grid grid-cols-2 gap-4 text-sm">
								<div>
									<p class="text-muted-foreground">仕訳数</p>
									<p class="text-lg font-semibold">{summary.journalCount}件</p>
								</div>
								<div>
									<p class="text-muted-foreground">証憑</p>
									<p class="text-lg font-semibold">{summary.attachmentCount}ファイル</p>
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
									<span class="ml-2 text-xs">(有料)</span>
								</Button>
							</div>
						</Card.Content>
					</Card.Root>
				{/await}
			{/each}
		</div>

		{#if availableYears.length === 0}
			<Card.Root>
				<Card.Content class="py-8 text-center">
					<p class="text-muted-foreground">エクスポート可能なデータがありません</p>
				</Card.Content>
			</Card.Root>
		{/if}
	{/if}

	<!-- 説明 -->
	<Card.Root>
		<Card.Header>
			<Card.Title class="text-base">エクスポート形式について</Card.Title>
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
				<p class="font-medium text-foreground">完全バックアップ（有料オプション）</p>
				<p>JSON + 証憑PDFをZIPにまとめてダウンロード。年次アーカイブに最適です。</p>
			</div>
		</Card.Content>
	</Card.Root>

	<p class="text-sm text-muted-foreground">
		電子帳簿保存法により、証憑は7年間の保存が必要です。定期的にバックアップを行ってください。
	</p>
</div>
