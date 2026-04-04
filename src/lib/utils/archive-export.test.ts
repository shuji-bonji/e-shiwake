import { describe, it, expect, vi, beforeEach } from 'vitest';
import JSZip from 'jszip';
import { exportArchiveZip, type ArchiveExportProgress } from './archive-export';
import type { ExportData, JournalEntry, Attachment, Account, Settings } from '$lib/types';

// $lib/db をモック
vi.mock('$lib/db', () => ({
	getAttachmentBlob: vi.fn()
}));

import { getAttachmentBlob } from '$lib/db';

const mockedGetAttachmentBlob = vi.mocked(getAttachmentBlob);

// report-html をモック
vi.mock('./report-html', () => ({
	generateJournalHTML: vi.fn().mockReturnValue('<div>Journal HTML</div>'),
	generateJournalCSV: vi.fn().mockReturnValue('journal,csv,content'),
	generateLedgerHTML: vi.fn().mockReturnValue('<div>Ledger HTML</div>'),
	generateLedgerCSV: vi.fn().mockReturnValue('ledger,csv,content'),
	generateTrialBalanceHTML: vi.fn().mockReturnValue('<div>Trial Balance HTML</div>'),
	generateTrialBalanceCSV: vi.fn().mockReturnValue('trial,balance,csv,content'),
	generateProfitLossHTML: vi.fn().mockReturnValue('<div>Profit Loss HTML</div>'),
	generateProfitLossCSV: vi.fn().mockReturnValue('profit,loss,csv,content'),
	generateBalanceSheetHTML: vi.fn().mockReturnValue('<div>Balance Sheet HTML</div>'),
	generateBalanceSheetCSV: vi.fn().mockReturnValue('balance,sheet,csv,content'),
	generateTaxSummaryHTML: vi.fn().mockReturnValue('<div>Tax Summary HTML</div>'),
	generateTaxSummaryCSV: vi.fn().mockReturnValue('tax,summary,csv,content'),
	getPrintStyles: vi.fn().mockReturnValue('body { margin: 0; }')
}));

// archive-html-template をモック
vi.mock('./archive-html-template', () => ({
	generateArchiveHtml: vi
		.fn()
		.mockReturnValue('<html><head></head><body>Archive Search</body></html>')
}));

import { generateArchiveHtml } from './archive-html-template';

// テスト用のデータヘルパー
function createTestAttachment(overrides: Partial<Attachment> = {}): Attachment {
	return {
		id: 'att-1',
		journalEntryId: 'journal-1',
		documentDate: '2024-01-15',
		documentType: 'receipt',
		originalName: 'test.pdf',
		generatedName: '2024-01-15_領収書_テスト_1000円_テスト会社.pdf',
		mimeType: 'application/pdf',
		size: 1024,
		description: 'テスト',
		amount: 1000,
		vendor: 'テスト会社',
		storageType: 'indexeddb',
		createdAt: '2024-01-15T00:00:00Z',
		...overrides
	};
}

function createTestJournal(overrides: Partial<JournalEntry> = {}): JournalEntry {
	return {
		id: 'journal-1',
		date: '2024-01-15',
		lines: [
			{ id: 'line-1', type: 'debit', accountCode: '5001', amount: 1000 },
			{ id: 'line-2', type: 'credit', accountCode: '1001', amount: 1000 }
		],
		vendor: 'テスト会社',
		description: 'テスト取引',
		evidenceStatus: 'digital',
		attachments: [],
		createdAt: '2024-01-15T00:00:00Z',
		updatedAt: '2024-01-15T00:00:00Z',
		...overrides
	};
}

function createTestAccount(overrides: Partial<Account> = {}): Account {
	return {
		code: '5001',
		name: '消耗品費',
		type: 'expense',
		isSystem: false,
		createdAt: '2024-01-01T00:00:00Z',
		...overrides
	};
}

function createTestSettings(): Settings {
	return {
		fiscalYearStart: 1,
		defaultCurrency: 'JPY',
		storageMode: 'indexeddb',
		autoPurgeBlobAfterExport: false,
		blobRetentionDays: 30
	};
}

function createTestExportData(journals: JournalEntry[], accounts: Account[] = []): ExportData {
	return {
		version: '1.0.0',
		exportedAt: '2024-01-15T00:00:00Z',
		fiscalYear: 2024,
		journals,
		accounts,
		vendors: [],
		settings: createTestSettings()
	};
}

// Blob を ArrayBuffer に変換するヘルパー
async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
	return blob.arrayBuffer();
}

// Node.js環境でJSZip互換のBlobを作成するヘルパー
function createTestBlob(content: string): Blob {
	const encoder = new TextEncoder();
	const uint8Array = encoder.encode(content);
	return new Blob([uint8Array], { type: 'application/pdf' });
}

describe('archive-export', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('exportArchiveZip', () => {
		it('generates ZIP with data.json', async () => {
			const journals: JournalEntry[] = [createTestJournal()];
			const exportData = createTestExportData(journals);

			const blob = await exportArchiveZip(exportData, journals, {});

			expect(blob).toBeInstanceOf(Blob);
			expect(blob.type).toBe('application/zip');

			// ZIPを解凍して中身を確認
			const arrayBuffer = await blobToArrayBuffer(blob);
			const zip = await JSZip.loadAsync(arrayBuffer);
			const dataJson = await zip.file('data.json')?.async('string');
			expect(dataJson).toBeDefined();

			const parsed = JSON.parse(dataJson!);
			expect(parsed.version).toBe('1.0.0');
			expect(parsed.fiscalYear).toBe(2024);
			expect(parsed.journals).toHaveLength(1);
		});

		it('includes index.html (archive search HTML)', async () => {
			const journals: JournalEntry[] = [createTestJournal()];
			const exportData = createTestExportData(journals);

			const blob = await exportArchiveZip(exportData, journals, {});

			const arrayBuffer = await blobToArrayBuffer(blob);
			const zip = await JSZip.loadAsync(arrayBuffer);

			// index.html が存在することを確認
			const indexHtml = await zip.file('index.html')?.async('string');
			expect(indexHtml).toBeDefined();
			expect(indexHtml).toContain('Archive Search');

			// generateArchiveHtml が呼ばれたことを確認
			expect(generateArchiveHtml).toHaveBeenCalled();
		});

		it('includes reports/html/ folder with 6 HTML reports', async () => {
			const journals: JournalEntry[] = [createTestJournal()];
			const accounts: Account[] = [createTestAccount()];
			const exportData = createTestExportData(journals, accounts);

			const blob = await exportArchiveZip(exportData, journals, {});

			const arrayBuffer = await blobToArrayBuffer(blob);
			const zip = await JSZip.loadAsync(arrayBuffer);

			const fileList = Object.keys(zip.files);

			// 6つのHTML帳簿ファイルが存在することを確認
			const htmlFiles = fileList.filter((f) => f.startsWith('reports/html/') && !zip.files[f].dir);
			expect(htmlFiles).toContain('reports/html/仕訳帳_2024.html');
			expect(htmlFiles).toContain('reports/html/総勘定元帳_2024.html');
			expect(htmlFiles).toContain('reports/html/試算表_2024.html');
			expect(htmlFiles).toContain('reports/html/損益計算書_2024.html');
			expect(htmlFiles).toContain('reports/html/貸借対照表_2024.html');
			expect(htmlFiles).toContain('reports/html/消費税集計_2024.html');
			expect(htmlFiles).toHaveLength(6);
		});

		it('includes reports/csv/ folder with 6 CSV reports', async () => {
			const journals: JournalEntry[] = [createTestJournal()];
			const accounts: Account[] = [createTestAccount()];
			const exportData = createTestExportData(journals, accounts);

			const blob = await exportArchiveZip(exportData, journals, {});

			const arrayBuffer = await blobToArrayBuffer(blob);
			const zip = await JSZip.loadAsync(arrayBuffer);

			const fileList = Object.keys(zip.files);

			// 6つのCSVファイルが存在することを確認
			const csvFiles = fileList.filter((f) => f.startsWith('reports/csv/') && !zip.files[f].dir);
			expect(csvFiles).toContain('reports/csv/仕訳帳_2024.csv');
			expect(csvFiles).toContain('reports/csv/総勘定元帳_2024.csv');
			expect(csvFiles).toContain('reports/csv/試算表_2024.csv');
			expect(csvFiles).toContain('reports/csv/損益計算書_2024.csv');
			expect(csvFiles).toContain('reports/csv/貸借対照表_2024.csv');
			expect(csvFiles).toContain('reports/csv/消費税集計_2024.csv');
			expect(csvFiles).toHaveLength(6);
		});

		it('collects evidence files from IndexedDB attachments', async () => {
			const testBlob = createTestBlob('test pdf content');
			const attachment = createTestAttachment();
			const journal = createTestJournal({ attachments: [attachment] });
			const journals = [journal];
			const exportData = createTestExportData(journals);

			mockedGetAttachmentBlob.mockResolvedValue(testBlob);

			const blob = await exportArchiveZip(exportData, journals, {});

			const arrayBuffer = await blobToArrayBuffer(blob);
			const zip = await JSZip.loadAsync(arrayBuffer);

			// evidences フォルダに証憑が存在することを確認
			const fileList = Object.keys(zip.files);
			const hasEvidenceFile = fileList.some(
				(f) => f === `evidences/2024/${journal.id}/${attachment.id}/${attachment.generatedName}`
			);
			expect(hasEvidenceFile).toBe(true);

			// getAttachmentBlob が呼ばれたことを確認
			expect(mockedGetAttachmentBlob).toHaveBeenCalledWith(journal.id, attachment.id, undefined);
		});

		it('skips purged blobs (blobPurgedAt is set)', async () => {
			const attachment = createTestAttachment({
				blobPurgedAt: '2024-01-20T00:00:00Z'
			});
			const journal = createTestJournal({ attachments: [attachment] });
			const journals = [journal];
			const exportData = createTestExportData(journals);

			const blob = await exportArchiveZip(exportData, journals, {});

			// getAttachmentBlob は呼ばれない（purgedAtが設定されているため）
			expect(mockedGetAttachmentBlob).not.toHaveBeenCalled();

			const arrayBuffer = await blobToArrayBuffer(blob);
			const zip = await JSZip.loadAsync(arrayBuffer);

			// evidencesフォルダは存在しない
			const fileList = Object.keys(zip.files);
			const evidencesFiles = fileList.filter((f) => f.startsWith('evidences/'));
			expect(evidencesFiles).toHaveLength(0);
		});

		it('progress callback is called with correct phases', async () => {
			const testBlob = createTestBlob('test');
			const attachment = createTestAttachment();
			const journal = createTestJournal({ attachments: [attachment] });
			const journals = [journal];
			const exportData = createTestExportData(journals);

			mockedGetAttachmentBlob.mockResolvedValue(testBlob);

			const progressUpdates: ArchiveExportProgress[] = [];

			await exportArchiveZip(exportData, journals, {
				onProgress: (progress) => progressUpdates.push({ ...progress })
			});

			// 各フェーズが呼ばれていることを確認
			expect(progressUpdates.some((p) => p.phase === 'preparing')).toBe(true);
			expect(progressUpdates.some((p) => p.phase === 'collecting')).toBe(true);
			expect(progressUpdates.some((p) => p.phase === 'generating')).toBe(true);
			expect(progressUpdates.some((p) => p.phase === 'compressing')).toBe(true);
			expect(progressUpdates.some((p) => p.phase === 'complete')).toBe(true);
		});

		it('handles no attachments gracefully', async () => {
			const journal = createTestJournal({ attachments: [] });
			const journals = [journal];
			const exportData = createTestExportData(journals);

			const blob = await exportArchiveZip(exportData, journals, {});

			expect(blob).toBeInstanceOf(Blob);

			// getAttachmentBlob は呼ばれない
			expect(mockedGetAttachmentBlob).not.toHaveBeenCalled();

			const arrayBuffer = await blobToArrayBuffer(blob);
			const zip = await JSZip.loadAsync(arrayBuffer);

			// data.json, index.html, reports/ は存在
			expect(zip.file('data.json')).not.toBeNull();
			expect(zip.file('index.html')).not.toBeNull();

			// evidencesフォルダは存在しない
			const fileList = Object.keys(zip.files);
			const evidencesFiles = fileList.filter((f) => f.startsWith('evidences/'));
			expect(evidencesFiles).toHaveLength(0);
		});

		it('reports failed attachments when getAttachmentBlob returns null', async () => {
			const attachment = createTestAttachment();
			const journal = createTestJournal({ attachments: [attachment] });
			const journals = [journal];
			const exportData = createTestExportData(journals);

			mockedGetAttachmentBlob.mockResolvedValue(null);

			const progressUpdates: ArchiveExportProgress[] = [];

			const blob = await exportArchiveZip(exportData, journals, {
				onProgress: (progress) => progressUpdates.push({ ...progress })
			});

			expect(blob).toBeInstanceOf(Blob);

			// 完了フェーズで失敗情報が通知されることを確認
			const completeProgress = progressUpdates.find((p) => p.phase === 'complete');
			expect(completeProgress).toBeDefined();
			expect(completeProgress?.failedAttachments).toBeDefined();
			expect(completeProgress?.failedAttachments).toHaveLength(1);
			expect(completeProgress?.failedAttachments?.[0].fileName).toBe(attachment.generatedName);
			expect(completeProgress?.failedAttachments?.[0].error).toContain('見つかりません');
			expect(completeProgress?.message).toContain('1件の証憑取得に失敗');
		});

		it('reports failed attachments when getAttachmentBlob throws error', async () => {
			const attachment = createTestAttachment();
			const journal = createTestJournal({ attachments: [attachment] });
			const journals = [journal];
			const exportData = createTestExportData(journals);

			mockedGetAttachmentBlob.mockRejectedValue(new Error('取得エラー'));

			const progressUpdates: ArchiveExportProgress[] = [];

			const blob = await exportArchiveZip(exportData, journals, {
				onProgress: (progress) => progressUpdates.push({ ...progress })
			});

			expect(blob).toBeInstanceOf(Blob);

			// 完了フェーズで失敗情報が通知されることを確認
			const completeProgress = progressUpdates.find((p) => p.phase === 'complete');
			expect(completeProgress?.failedAttachments).toHaveLength(1);
			expect(completeProgress?.failedAttachments?.[0].error).toBe('取得エラー');
			expect(completeProgress?.message).toContain('1件の証憑取得に失敗');
		});

		it('handles multiple attachments with mixed success and failure', async () => {
			const attachment1 = createTestAttachment({ id: 'att-1' });
			const attachment2 = createTestAttachment({ id: 'att-2' });
			const attachment3 = createTestAttachment({ id: 'att-3' });
			const journal = createTestJournal({ attachments: [attachment1, attachment2, attachment3] });
			const journals = [journal];
			const exportData = createTestExportData(journals);

			// 最初と2番目は成功、3番目は失敗
			mockedGetAttachmentBlob
				.mockResolvedValueOnce(createTestBlob('content1'))
				.mockResolvedValueOnce(createTestBlob('content2'))
				.mockResolvedValueOnce(null);

			const progressUpdates: ArchiveExportProgress[] = [];

			const blob = await exportArchiveZip(exportData, journals, {
				onProgress: (progress) => progressUpdates.push({ ...progress })
			});

			expect(blob).toBeInstanceOf(Blob);

			// 完了フェーズで失敗情報が通知されることを確認
			const completeProgress = progressUpdates.find((p) => p.phase === 'complete');
			expect(completeProgress?.failedAttachments).toHaveLength(1);
			expect(completeProgress?.failedAttachments?.[0].fileName).toBe(attachment3.generatedName);

			// ZIPに2つのファイルが含まれていることを確認
			const arrayBuffer = await blobToArrayBuffer(blob);
			const zip = await JSZip.loadAsync(arrayBuffer);
			const fileList = Object.keys(zip.files);
			const evidencesFiles = fileList.filter(
				(f) => f.startsWith('evidences/') && !zip.files[f].dir
			);
			expect(evidencesFiles).toHaveLength(2);
		});

		it('includes HTML report content with print styles', async () => {
			const journals: JournalEntry[] = [createTestJournal()];
			const accounts: Account[] = [createTestAccount()];
			const exportData = createTestExportData(journals, accounts);

			const blob = await exportArchiveZip(exportData, journals, {});

			const arrayBuffer = await blobToArrayBuffer(blob);
			const zip = await JSZip.loadAsync(arrayBuffer);

			// HTMLファイルのコンテンツを確認
			const journalHtml = await zip.file('reports/html/仕訳帳_2024.html')?.async('string');
			expect(journalHtml).toBeDefined();
			expect(journalHtml).toContain('<!DOCTYPE html>');
			expect(journalHtml).toContain('Journal HTML');
			expect(journalHtml).toContain('body { margin: 0; }'); // print styles
			expect(journalHtml).toContain('charset=');
		});

		it('includes CSV report content', async () => {
			const journals: JournalEntry[] = [createTestJournal()];
			const accounts: Account[] = [createTestAccount()];
			const exportData = createTestExportData(journals, accounts);

			const blob = await exportArchiveZip(exportData, journals, {});

			const arrayBuffer = await blobToArrayBuffer(blob);
			const zip = await JSZip.loadAsync(arrayBuffer);

			// CSVファイルのコンテンツを確認
			const journalCsv = await zip.file('reports/csv/仕訳帳_2024.csv')?.async('string');
			expect(journalCsv).toBeDefined();
			expect(journalCsv).toBe('journal,csv,content');
		});

		it('organizes evidence files by fiscal year', async () => {
			const testBlob1 = createTestBlob('content1');
			const testBlob2 = createTestBlob('content2');

			const attachment2024 = createTestAttachment({
				id: 'att-2024',
				generatedName: '2024-06-15_領収書_テスト_1000円_テスト会社.pdf'
			});
			const attachment2023 = createTestAttachment({
				id: 'att-2023',
				generatedName: '2023-12-01_領収書_テスト_1000円_テスト会社.pdf'
			});

			const journal2024 = createTestJournal({
				id: 'j-2024',
				date: '2024-06-15',
				attachments: [attachment2024]
			});
			const journal2023 = createTestJournal({
				id: 'j-2023',
				date: '2023-12-01',
				attachments: [attachment2023]
			});

			const journals = [journal2024, journal2023];
			const exportData = createTestExportData(journals);

			mockedGetAttachmentBlob.mockResolvedValueOnce(testBlob1).mockResolvedValueOnce(testBlob2);

			const blob = await exportArchiveZip(exportData, journals, {});

			const arrayBuffer = await blobToArrayBuffer(blob);
			const zip = await JSZip.loadAsync(arrayBuffer);
			const fileList = Object.keys(zip.files);

			// 2024年度フォルダに証憑が存在
			const has2024File = fileList.some(
				(f) =>
					f ===
					`evidences/2024/${journal2024.id}/${attachment2024.id}/${attachment2024.generatedName}`
			);
			expect(has2024File).toBe(true);

			// 2023年度フォルダに証憑が存在
			const has2023File = fileList.some(
				(f) =>
					f ===
					`evidences/2023/${journal2023.id}/${attachment2023.id}/${attachment2023.generatedName}`
			);
			expect(has2023File).toBe(true);
		});

		it('handles directoryHandle option and passes it to getAttachmentBlob', async () => {
			const testBlob = createTestBlob('test');
			const attachment = createTestAttachment();
			const journal = createTestJournal({ attachments: [attachment] });
			const journals = [journal];
			const exportData = createTestExportData(journals);

			mockedGetAttachmentBlob.mockResolvedValue(testBlob);

			const mockDirectoryHandle = {} as FileSystemDirectoryHandle;

			await exportArchiveZip(exportData, journals, {
				directoryHandle: mockDirectoryHandle
			});

			// getAttachmentBlob が directoryHandle と共に呼ばれたことを確認
			expect(mockedGetAttachmentBlob).toHaveBeenCalledWith(
				journal.id,
				attachment.id,
				mockDirectoryHandle
			);
		});

		it('includes filesystem storage attachments with filePath', async () => {
			const testBlob = createTestBlob('filesystem content');
			const attachment = createTestAttachment({
				id: 'att-fs',
				filePath: '2024/test.pdf',
				storageType: 'filesystem'
			});
			const journal = createTestJournal({ attachments: [attachment] });
			const journals = [journal];
			const exportData = createTestExportData(journals);

			mockedGetAttachmentBlob.mockResolvedValue(testBlob);

			const blob = await exportArchiveZip(exportData, journals, {});

			// getAttachmentBlob が呼ばれたことを確認
			expect(mockedGetAttachmentBlob).toHaveBeenCalledTimes(1);

			const arrayBuffer = await blobToArrayBuffer(blob);
			const zip = await JSZip.loadAsync(arrayBuffer);
			const fileList = Object.keys(zip.files);

			// ファイルが証憑フォルダに存在
			const hasFile = fileList.some(
				(f) => f === `evidences/2024/${journal.id}/${attachment.id}/${attachment.generatedName}`
			);
			expect(hasFile).toBe(true);
		});

		it('collecting phase progress updates with current/total counts', async () => {
			const testBlob = createTestBlob('test');
			const att1 = createTestAttachment({ id: 'att-1' });
			const att2 = createTestAttachment({ id: 'att-2' });
			const journal = createTestJournal({ attachments: [att1, att2] });
			const journals = [journal];
			const exportData = createTestExportData(journals);

			mockedGetAttachmentBlob.mockResolvedValueOnce(testBlob).mockResolvedValueOnce(testBlob);

			const progressUpdates: ArchiveExportProgress[] = [];

			await exportArchiveZip(exportData, journals, {
				onProgress: (progress) => progressUpdates.push({ ...progress })
			});

			// 収集フェーズの更新を確認
			const collectingPhases = progressUpdates.filter((p) => p.phase === 'collecting');
			expect(collectingPhases.length).toBeGreaterThan(0);

			// 最初の更新が current=0, total=2
			expect(collectingPhases[0].current).toBe(0);
			expect(collectingPhases[0].total).toBe(2);

			// 最後の更新が current=2, total=2
			const lastCollecting = collectingPhases[collectingPhases.length - 1];
			expect(lastCollecting.current).toBe(2);
			expect(lastCollecting.total).toBe(2);
		});
	});
});
