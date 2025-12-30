import { describe, it, expect, vi, beforeEach } from 'vitest';
import JSZip from 'jszip';
import { exportToZip, type ZipExportProgress } from './zip-export';
import type { ExportData, JournalEntry, Attachment, Settings } from '$lib/types';

// getAttachmentBlob をモック
vi.mock('$lib/db', () => ({
	getAttachmentBlob: vi.fn()
}));

import { getAttachmentBlob } from '$lib/db';

const mockedGetAttachmentBlob = vi.mocked(getAttachmentBlob);

// テスト用のデータ
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

function createTestSettings(): Settings {
	return {
		fiscalYearStart: 1,
		defaultCurrency: 'JPY',
		storageMode: 'indexeddb',
		autoPurgeBlobAfterExport: false,
		blobRetentionDays: 30
	};
}

function createTestExportData(journals: JournalEntry[] = []): ExportData {
	return {
		version: '1.0.0',
		exportedAt: '2024-01-15T00:00:00Z',
		fiscalYear: 2024,
		journals,
		accounts: [],
		vendors: [],
		settings: createTestSettings()
	};
}

// Blob を ArrayBuffer に変換するヘルパー
async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
	return blob.arrayBuffer();
}

// Node.js環境でJSZip互換のBlobを作成するヘルパー
// JSZipがNode.jsでBlobを正しく処理できるように、arrayBuffer()メソッドを持つBlobを返す
function createTestBlob(content: string): Blob {
	const encoder = new TextEncoder();
	const uint8Array = encoder.encode(content);
	return new Blob([uint8Array], { type: 'application/pdf' });
}

describe('zip-export', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('exportToZip', () => {
		it('証憑なしでZIPを生成できる', async () => {
			const journals: JournalEntry[] = [createTestJournal()];
			const exportData = createTestExportData(journals);

			const blob = await exportToZip(exportData, journals, {
				includeEvidences: false
			});

			expect(blob).toBeInstanceOf(Blob);
			expect(blob.type).toBe('application/zip');

			// ZIPを解凍して中身を確認（Node.js環境ではArrayBufferを使用）
			const arrayBuffer = await blobToArrayBuffer(blob);
			const zip = await JSZip.loadAsync(arrayBuffer);
			const dataJson = await zip.file('data.json')?.async('string');
			expect(dataJson).toBeDefined();

			const parsed = JSON.parse(dataJson!);
			expect(parsed.version).toBe('1.0.0');
			expect(parsed.fiscalYear).toBe(2024);
			expect(parsed.journals).toHaveLength(1);
		});

		it('証憑付きでZIPを生成できる', async () => {
			const testBlob = createTestBlob('test pdf content');
			const attachment = createTestAttachment({ blob: testBlob });
			const journal = createTestJournal({ attachments: [attachment] });
			const journals = [journal];
			const exportData = createTestExportData(journals);

			mockedGetAttachmentBlob.mockResolvedValue(testBlob);

			const blob = await exportToZip(exportData, journals, {
				includeEvidences: true
			});

			expect(blob).toBeInstanceOf(Blob);

			// ZIPを解凍して中身を確認
			const arrayBuffer = await blobToArrayBuffer(blob);
			const zip = await JSZip.loadAsync(arrayBuffer);

			// data.json が存在
			expect(zip.file('data.json')).not.toBeNull();

			// evidences/2024/ フォルダに証憑が存在（ファイル名の存在確認）
			const fileList = Object.keys(zip.files);
			const hasEvidenceFile = fileList.some(
				(f) => f === `evidences/2024/${journal.id}/${attachment.id}/${attachment.generatedName}`
			);
			expect(hasEvidenceFile).toBe(true);
		});

		it('証憑がない仕訳の場合はevidencesフォルダなしでZIPを生成', async () => {
			const journal = createTestJournal({ attachments: [] });
			const journals = [journal];
			const exportData = createTestExportData(journals);

			const blob = await exportToZip(exportData, journals, {
				includeEvidences: true
			});

			const arrayBuffer = await blobToArrayBuffer(blob);
			const zip = await JSZip.loadAsync(arrayBuffer);

			// data.json のみ存在
			expect(zip.file('data.json')).not.toBeNull();
			// evidencesフォルダは空または存在しない
			const evidencesFiles = Object.keys(zip.files).filter((f) => f.startsWith('evidences/'));
			expect(evidencesFiles.length).toBe(0);
		});

		it('進捗コールバックが呼ばれる', async () => {
			const testBlob = createTestBlob('test');
			const attachment = createTestAttachment({ blob: testBlob });
			const journal = createTestJournal({ attachments: [attachment] });
			const journals = [journal];
			const exportData = createTestExportData(journals);

			mockedGetAttachmentBlob.mockResolvedValue(testBlob);

			const progressUpdates: ZipExportProgress[] = [];

			await exportToZip(exportData, journals, {
				includeEvidences: true,
				onProgress: (progress) => progressUpdates.push({ ...progress })
			});

			// 各フェーズが呼ばれていることを確認
			expect(progressUpdates.some((p) => p.phase === 'preparing')).toBe(true);
			expect(progressUpdates.some((p) => p.phase === 'collecting')).toBe(true);
			expect(progressUpdates.some((p) => p.phase === 'compressing')).toBe(true);
			expect(progressUpdates.some((p) => p.phase === 'complete')).toBe(true);
		});

		it('証憑取得に失敗しても処理を続行し、失敗情報を通知する', async () => {
			const attachment1 = createTestAttachment({
				id: 'att-1',
				blob: createTestBlob('1')
			});
			const attachment2 = createTestAttachment({
				id: 'att-2',
				blob: createTestBlob('2')
			});
			const journal = createTestJournal({ attachments: [attachment1, attachment2] });
			const journals = [journal];
			const exportData = createTestExportData(journals);

			// 最初の証憑はエラー、2番目は成功
			mockedGetAttachmentBlob
				.mockRejectedValueOnce(new Error('取得エラー'))
				.mockResolvedValueOnce(createTestBlob('content2'));

			// console.warn をモック
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			const progressUpdates: ZipExportProgress[] = [];
			const blob = await exportToZip(exportData, journals, {
				includeEvidences: true,
				onProgress: (progress) => progressUpdates.push({ ...progress })
			});

			expect(blob).toBeInstanceOf(Blob);

			// エラーがあっても処理は完了
			const arrayBuffer = await blobToArrayBuffer(blob);
			const zip = await JSZip.loadAsync(arrayBuffer);
			expect(zip.file('data.json')).not.toBeNull();

			// 警告が出力されたことを確認
			expect(warnSpy).toHaveBeenCalled();
			warnSpy.mockRestore();

			// 完了フェーズで失敗情報が通知されることを確認
			const completeProgress = progressUpdates.find((p) => p.phase === 'complete');
			expect(completeProgress).toBeDefined();
			expect(completeProgress?.failedAttachments).toBeDefined();
			expect(completeProgress?.failedAttachments).toHaveLength(1);
			expect(completeProgress?.failedAttachments?.[0].error).toBe('取得エラー');
			expect(completeProgress?.message).toContain('1件の証憑取得に失敗');
		});

		it('Blobプロパティがdata.jsonから除外される', async () => {
			const testBlob = createTestBlob('test');
			const attachment = createTestAttachment({ blob: testBlob });
			const journal = createTestJournal({ attachments: [attachment] });
			const journals = [journal];
			const exportData = createTestExportData(journals);

			mockedGetAttachmentBlob.mockResolvedValue(testBlob);

			const blob = await exportToZip(exportData, journals, {
				includeEvidences: true
			});

			const arrayBuffer = await blobToArrayBuffer(blob);
			const zip = await JSZip.loadAsync(arrayBuffer);
			const dataJson = await zip.file('data.json')?.async('string');
			const parsed = JSON.parse(dataJson!);

			// journals[0].attachments[0] に blob プロパティがないことを確認
			expect(parsed.journals[0].attachments[0].blob).toBeUndefined();
			// 他のプロパティは存在
			expect(parsed.journals[0].attachments[0].id).toBe('att-1');
			expect(parsed.journals[0].attachments[0].generatedName).toBeDefined();
		});

		it('filePathのみの証憑も収集対象になる', async () => {
			const attachment = createTestAttachment({
				blob: undefined,
				filePath: '2024/test.pdf',
				storageType: 'filesystem'
			});
			const journal = createTestJournal({ attachments: [attachment] });
			const journals = [journal];
			const exportData = createTestExportData(journals);

			const testBlob = createTestBlob('filesystem content');
			mockedGetAttachmentBlob.mockResolvedValue(testBlob);

			const blob = await exportToZip(exportData, journals, {
				includeEvidences: true
			});

			// getAttachmentBlob が呼ばれたことを確認
			expect(mockedGetAttachmentBlob).toHaveBeenCalledTimes(1);

			const arrayBuffer = await blobToArrayBuffer(blob);
			const zip = await JSZip.loadAsync(arrayBuffer);
			const fileList = Object.keys(zip.files);
			const hasEvidenceFile = fileList.some(
				(f) => f === `evidences/2024/${journal.id}/${attachment.id}/${attachment.generatedName}`
			);
			expect(hasEvidenceFile).toBe(true);
		});

		it('複数年度の証憑を年度別フォルダに分類', async () => {
			const attachment2024 = createTestAttachment({
				id: 'att-2024',
				blob: createTestBlob('2024'),
				generatedName: '2024-06-15_領収書_テスト_1000円_テスト会社.pdf'
			});
			const attachment2023 = createTestAttachment({
				id: 'att-2023',
				blob: createTestBlob('2023'),
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

			mockedGetAttachmentBlob
				.mockResolvedValueOnce(createTestBlob('content2024'))
				.mockResolvedValueOnce(createTestBlob('content2023'));

			const blob = await exportToZip(exportData, journals, {
				includeEvidences: true
			});

			const arrayBuffer = await blobToArrayBuffer(blob);
			const zip = await JSZip.loadAsync(arrayBuffer);
			const fileList = Object.keys(zip.files);

			// 2024年度フォルダ
			const has2024File = fileList.some(
				(f) =>
					f ===
					`evidences/2024/${journal2024.id}/${attachment2024.id}/${attachment2024.generatedName}`
			);
			expect(has2024File).toBe(true);

			// 2023年度フォルダ
			const has2023File = fileList.some(
				(f) =>
					f ===
					`evidences/2023/${journal2023.id}/${attachment2023.id}/${attachment2023.generatedName}`
			);
			expect(has2023File).toBe(true);
		});

		it('includeEvidences=false の場合は証憑を含めない', async () => {
			const testBlob = createTestBlob('test');
			const attachment = createTestAttachment({ blob: testBlob });
			const journal = createTestJournal({ attachments: [attachment] });
			const journals = [journal];
			const exportData = createTestExportData(journals);

			const blob = await exportToZip(exportData, journals, {
				includeEvidences: false
			});

			// getAttachmentBlob は呼ばれない
			expect(mockedGetAttachmentBlob).not.toHaveBeenCalled();

			const arrayBuffer = await blobToArrayBuffer(blob);
			const zip = await JSZip.loadAsync(arrayBuffer);

			// data.json のみ存在
			expect(zip.file('data.json')).not.toBeNull();
			const evidencesFiles = Object.keys(zip.files).filter((f) => f.startsWith('evidences/'));
			expect(evidencesFiles.length).toBe(0);
		});

		it('不正な日付形式でも現在年度にフォールバックしてエラーにならない', async () => {
			const testBlob = createTestBlob('test');
			const attachment = createTestAttachment({ blob: testBlob });
			// 不正な日付形式の仕訳
			const journal = createTestJournal({
				date: 'invalid-date', // 不正な形式
				attachments: [attachment]
			});
			const journals = [journal];
			const exportData = createTestExportData(journals);

			mockedGetAttachmentBlob.mockResolvedValue(testBlob);

			// console.warn をモック
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			// エラーにならずに完了する
			const blob = await exportToZip(exportData, journals, {
				includeEvidences: true
			});

			expect(blob).toBeInstanceOf(Blob);

			// 警告が出力されたことを確認
			expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('不正な日付形式'));
			warnSpy.mockRestore();

			// ZIPが正常に生成されたことを確認
			const arrayBuffer = await blobToArrayBuffer(blob);
			const zip = await JSZip.loadAsync(arrayBuffer);
			expect(zip.file('data.json')).not.toBeNull();
		});
	});
});
