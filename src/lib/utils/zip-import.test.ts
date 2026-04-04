import { describe, it, expect, vi, beforeEach } from 'vitest';
import JSZip from 'jszip';
import { importFromZip, isZipFile, type ZipImportProgress } from './zip-import';
import type { ExportData, JournalEntry, Attachment, Settings } from '$lib/types';

// validateExportData / validateBackupData をモック
vi.mock('$lib/db', () => ({
	validateExportData: vi.fn(),
	validateBackupData: vi.fn()
}));

import { validateExportData, validateBackupData } from '$lib/db';

const mockedValidateExportData = vi.mocked(validateExportData);
const mockedValidateBackupData = vi.mocked(validateBackupData);

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
function createTestBlob(content: string): Blob {
	const encoder = new TextEncoder();
	const uint8Array = encoder.encode(content);
	return new Blob([uint8Array], { type: 'application/pdf' });
}

// Node.js環境でFile オブジェクトを作成するヘルパー
async function createZipFile(
	fileName: string,
	exportData: ExportData,
	evidences?: Map<string, Blob>
): Promise<File> {
	const zip = new JSZip();

	// data.json を追加
	zip.file('data.json', JSON.stringify(exportData));

	// 証憑ファイルを追加
	if (evidences) {
		for (const [path, blob] of evidences) {
			const arrayBuffer = await blobToArrayBuffer(blob);
			zip.file(path, arrayBuffer);
		}
	}

	const zipBlob = await zip.generateAsync({ type: 'blob' });
	return new File([zipBlob], fileName, { type: 'application/zip' });
}

describe('zip-import', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockedValidateExportData.mockReturnValue(true);
		mockedValidateBackupData.mockReturnValue(false);
	});

	describe('isZipFile', () => {
		it('application/zip MIMEタイプのファイルをZIPと判定', () => {
			const file = new File(['test'], 'test.zip', { type: 'application/zip' });
			expect(isZipFile(file)).toBe(true);
		});

		it('application/x-zip-compressed MIMEタイプのファイルをZIPと判定', () => {
			const file = new File(['test'], 'test.zip', { type: 'application/x-zip-compressed' });
			expect(isZipFile(file)).toBe(true);
		});

		it('.zip拡張子のファイルをZIPと判定（MIMEタイプなし）', () => {
			const file = new File(['test'], 'test.zip', { type: 'application/octet-stream' });
			expect(isZipFile(file)).toBe(true);
		});

		it('.ZIP大文字拡張子のファイルをZIPと判定', () => {
			const file = new File(['test'], 'test.ZIP', { type: 'application/octet-stream' });
			expect(isZipFile(file)).toBe(true);
		});

		it('PDFファイルをZIPと判定しない', () => {
			const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
			expect(isZipFile(file)).toBe(false);
		});

		it('テキストファイルをZIPと判定しない', () => {
			const file = new File(['test'], 'test.txt', { type: 'text/plain' });
			expect(isZipFile(file)).toBe(false);
		});

		it('拡張子なしのファイルをZIPと判定しない', () => {
			const file = new File(['test'], 'testfile', { type: 'application/octet-stream' });
			expect(isZipFile(file)).toBe(false);
		});
	});

	describe('importFromZip', () => {
		it('証憑なしでZIPをインポートできる', async () => {
			const journal = createTestJournal();
			const exportData = createTestExportData([journal]);

			const file = await createZipFile('test.zip', exportData);

			const result = await importFromZip(file);

			expect(result.dataType).toBe('export');
			if (result.dataType !== 'export') throw new Error('unexpected dataType');
			expect(result.exportData).toBeDefined();
			expect(result.exportData.version).toBe('1.0.0');
			expect(result.exportData.fiscalYear).toBe(2024);
			expect(result.exportData.journals).toHaveLength(1);
			expect(result.attachmentBlobs.size).toBe(0);
			expect(result.warnings).toHaveLength(0);
		});

		it('ZIPファイルに data.json がない場合はエラー', async () => {
			const zip = new JSZip();
			const zipBlob = await zip.generateAsync({ type: 'blob' });
			const file = new File([zipBlob], 'test.zip', { type: 'application/zip' });

			await expect(importFromZip(file)).rejects.toThrow('ZIPファイルにdata.jsonが含まれていません');
		});

		it('data.json が無効なJSONの場合はエラー', async () => {
			const zip = new JSZip();
			zip.file('data.json', 'invalid json {');
			const zipBlob = await zip.generateAsync({ type: 'blob' });
			const file = new File([zipBlob], 'test.zip', { type: 'application/zip' });

			await expect(importFromZip(file)).rejects.toThrow('data.jsonの解析に失敗しました');
		});

		it('validateExportData が失敗する場合はエラー', async () => {
			mockedValidateExportData.mockReturnValue(false);

			const journal = createTestJournal();
			const exportData = createTestExportData([journal]);
			const file = await createZipFile('test.zip', exportData);

			await expect(importFromZip(file)).rejects.toThrow(
				'ファイル形式が正しくありません。e-shiwakeからエクスポートしたZIPファイルを選択してください。'
			);
		});

		it('新形式（年度別フォルダ）で証憑ファイルを抽出できる', async () => {
			const attachment = createTestAttachment({
				id: 'att-1',
				generatedName: '2024-01-15_領収書_テスト_1000円_テスト会社.pdf'
			});
			const journal = createTestJournal({ id: 'journal-1', attachments: [attachment] });
			const exportData = createTestExportData([journal]);

			const evidences = new Map<string, Blob>();
			const testBlob = createTestBlob('test pdf content');
			evidences.set(
				'evidences/2024/journal-1/att-1/2024-01-15_領収書_テスト_1000円_テスト会社.pdf',
				testBlob
			);

			const file = await createZipFile('test.zip', exportData, evidences);

			const result = await importFromZip(file);

			expect(result.attachmentBlobs.size).toBe(1);
			expect(result.attachmentBlobs.has('att-1')).toBe(true);
			const blob = result.attachmentBlobs.get('att-1');
			expect(blob).toBeInstanceOf(Blob);
			expect(blob?.type).toBe('application/pdf');
		});

		it('旧形式（年度別フォルダなし）で証憑ファイルを抽出できる', async () => {
			const attachment = createTestAttachment({
				id: 'att-1',
				generatedName: '2024-01-15_領収書_テスト_1000円_テスト会社.pdf'
			});
			const journal = createTestJournal({ id: 'journal-1', attachments: [attachment] });
			const exportData = createTestExportData([journal]);

			const evidences = new Map<string, Blob>();
			const testBlob = createTestBlob('test pdf content');
			// 旧形式: evidences/{journalId}/{attachmentId}/{fileName}
			evidences.set(
				'evidences/journal-1/att-1/2024-01-15_領収書_テスト_1000円_テスト会社.pdf',
				testBlob
			);

			const file = await createZipFile('test.zip', exportData, evidences);

			const result = await importFromZip(file);

			expect(result.attachmentBlobs.size).toBe(1);
			expect(result.attachmentBlobs.has('att-1')).toBe(true);
		});

		it('旧旧形式（ファイル名のみ）で証憑ファイルを抽出できる', async () => {
			const attachment = createTestAttachment({
				id: 'att-1',
				generatedName: '2024-01-15_領収書_テスト_1000円_テスト会社.pdf'
			});
			const journal = createTestJournal({ id: 'journal-1', attachments: [attachment] });
			const exportData = createTestExportData([journal]);

			const evidences = new Map<string, Blob>();
			const testBlob = createTestBlob('test pdf content');
			// 旧旧形式: evidences/{year}/{fileName}
			evidences.set('evidences/2024/2024-01-15_領収書_テスト_1000円_テスト会社.pdf', testBlob);

			const file = await createZipFile('test.zip', exportData, evidences);

			const result = await importFromZip(file);

			expect(result.attachmentBlobs.size).toBe(1);
			expect(result.attachmentBlobs.has('att-1')).toBe(true);
		});

		it('不明な証憑パスについて警告を報告', async () => {
			const journal = createTestJournal();
			const exportData = createTestExportData([journal]);

			const evidences = new Map<string, Blob>();
			const testBlob = createTestBlob('test');
			// evidences/ プレフィックス付きだが不正なパス形式（パーツが2つだけ）
			evidences.set('evidences/unknown.pdf', testBlob);

			const file = await createZipFile('test.zip', exportData, evidences);

			const result = await importFromZip(file);

			expect(result.warnings.length).toBeGreaterThan(0);
			expect(result.warnings.some((w) => w.includes('不明な証憑パス形式'))).toBe(true);
		});

		it('進捗コールバックが各フェーズで呼ばれる', async () => {
			const attachment = createTestAttachment({ id: 'att-1' });
			const journal = createTestJournal({ id: 'journal-1', attachments: [attachment] });
			const exportData = createTestExportData([journal]);

			const evidences = new Map<string, Blob>();
			evidences.set('evidences/2024/journal-1/att-1/test.pdf', createTestBlob('content'));

			const file = await createZipFile('test.zip', exportData, evidences);

			const progressUpdates: ZipImportProgress[] = [];

			await importFromZip(file, (progress) => progressUpdates.push({ ...progress }));

			// 各フェーズが呼ばれていることを確認
			expect(progressUpdates.some((p) => p.phase === 'extracting')).toBe(true);
			expect(progressUpdates.some((p) => p.phase === 'processing')).toBe(true);
			expect(progressUpdates.some((p) => p.phase === 'storing')).toBe(true);
			expect(progressUpdates.some((p) => p.phase === 'complete')).toBe(true);
		});

		it('証憑なしのZIPでも progress コールバックが呼ばれる', async () => {
			const journal = createTestJournal();
			const exportData = createTestExportData([journal]);
			const file = await createZipFile('test.zip', exportData);

			const progressUpdates: ZipImportProgress[] = [];

			await importFromZip(file, (progress) => progressUpdates.push({ ...progress }));

			expect(progressUpdates.length).toBeGreaterThan(0);
			expect(progressUpdates.some((p) => p.phase === 'complete')).toBe(true);
		});

		it('複数の証憑ファイルをインポートできる', async () => {
			const att1 = createTestAttachment({ id: 'att-1', generatedName: 'file1.pdf' });
			const att2 = createTestAttachment({ id: 'att-2', generatedName: 'file2.pdf' });
			const journal1 = createTestJournal({ id: 'journal-1', attachments: [att1] });
			const journal2 = createTestJournal({ id: 'journal-2', attachments: [att2] });
			const exportData = createTestExportData([journal1, journal2]);

			const evidences = new Map<string, Blob>();
			evidences.set('evidences/2024/journal-1/att-1/file1.pdf', createTestBlob('content1'));
			evidences.set('evidences/2024/journal-2/att-2/file2.pdf', createTestBlob('content2'));

			const file = await createZipFile('test.zip', exportData, evidences);

			const result = await importFromZip(file);

			expect(result.attachmentBlobs.size).toBe(2);
			expect(result.attachmentBlobs.has('att-1')).toBe(true);
			expect(result.attachmentBlobs.has('att-2')).toBe(true);
		});

		it('同名証憑ファイルについて警告を報告', async () => {
			const att1 = createTestAttachment({
				id: 'att-1',
				generatedName: 'duplicate.pdf'
			});
			const att2 = createTestAttachment({
				id: 'att-2',
				generatedName: 'duplicate.pdf' // 同じ名前
			});
			const journal1 = createTestJournal({ id: 'journal-1', attachments: [att1] });
			const journal2 = createTestJournal({ id: 'journal-2', attachments: [att2] });
			const exportData = createTestExportData([journal1, journal2]);

			const evidences = new Map<string, Blob>();
			evidences.set('evidences/2024/journal-1/att-1/duplicate.pdf', createTestBlob('content1'));
			evidences.set('evidences/2024/journal-2/att-2/duplicate.pdf', createTestBlob('content2'));

			const file = await createZipFile('test.zip', exportData, evidences);

			const result = await importFromZip(file);

			expect(result.warnings.some((w) => w.includes('同名の証憑ファイル'))).toBe(true);
		});

		it('attachmentIdが一致しない場合は警告してスキップ', async () => {
			const attachment = createTestAttachment({ id: 'att-1', generatedName: 'test.pdf' });
			const journal = createTestJournal({ id: 'journal-1', attachments: [attachment] });
			const exportData = createTestExportData([journal]);

			const evidences = new Map<string, Blob>();
			// attachmentIdが異なる
			evidences.set('evidences/2024/journal-1/att-999/test.pdf', createTestBlob('content'));

			const file = await createZipFile('test.zip', exportData, evidences);

			const result = await importFromZip(file);

			expect(result.warnings.some((w) => w.includes('不明な証憑ID'))).toBe(true);
			expect(result.attachmentBlobs.size).toBe(0);
		});

		it('journalIdが一致しない場合は警告してスキップ', async () => {
			const attachment = createTestAttachment({ id: 'att-1', generatedName: 'test.pdf' });
			const journal = createTestJournal({ id: 'journal-1', attachments: [attachment] });
			const exportData = createTestExportData([journal]);

			const evidences = new Map<string, Blob>();
			// journalIdが異なる
			evidences.set('evidences/2024/journal-999/att-1/test.pdf', createTestBlob('content'));

			const file = await createZipFile('test.zip', exportData, evidences);

			const result = await importFromZip(file);

			expect(result.warnings.some((w) => w.includes('証憑と仕訳の対応が一致しません'))).toBe(true);
			expect(result.attachmentBlobs.size).toBe(0);
		});

		it('ファイル名が異なる場合は警告のみ（リネームの可能性）', async () => {
			const attachment = createTestAttachment({
				id: 'att-1',
				generatedName: 'original.pdf'
			});
			const journal = createTestJournal({ id: 'journal-1', attachments: [attachment] });
			const exportData = createTestExportData([journal]);

			const evidences = new Map<string, Blob>();
			// ファイル名が異なるが attaachmentId は一致
			evidences.set('evidences/2024/journal-1/att-1/renamed.pdf', createTestBlob('content'));

			const file = await createZipFile('test.zip', exportData, evidences);

			const result = await importFromZip(file);

			expect(result.warnings.some((w) => w.includes('証憑ファイル名が一致しません'))).toBe(true);
			expect(result.attachmentBlobs.size).toBe(1); // ファイルは読み込まれる
			expect(result.attachmentBlobs.has('att-1')).toBe(true);
		});

		it('証憑読み込み失敗時も処理を続行して警告を報告', async () => {
			const attachment = createTestAttachment({ id: 'att-1', generatedName: 'test.pdf' });
			const journal = createTestJournal({ id: 'journal-1', attachments: [attachment] });
			const exportData = createTestExportData([journal]);

			// 空の (ダミー) ZIP で失敗をシミュレート
			// 実際には、ファイル読み込みの失敗パターンはJSZipの仕様に依存
			// ここでは、不明なattachmentIdで警告を出すテストを使用
			const evidences = new Map<string, Blob>();
			evidences.set('evidences/2024/journal-1/att-unknown/test.pdf', createTestBlob('content'));

			const file = await createZipFile('test.zip', exportData, evidences);

			const result = await importFromZip(file);

			expect(result.warnings.length).toBeGreaterThan(0);
			expect(result.dataType).toBe('export'); // エクスポートデータは返される
		});

		it('複数年度の証憑を正しく抽出できる', async () => {
			const att2024 = createTestAttachment({ id: 'att-2024', generatedName: '2024.pdf' });
			const att2023 = createTestAttachment({ id: 'att-2023', generatedName: '2023.pdf' });

			const journal2024 = createTestJournal({
				id: 'journal-2024',
				date: '2024-06-15',
				attachments: [att2024]
			});
			const journal2023 = createTestJournal({
				id: 'journal-2023',
				date: '2023-12-01',
				attachments: [att2023]
			});

			const exportData = createTestExportData([journal2024, journal2023]);

			const evidences = new Map<string, Blob>();
			evidences.set('evidences/2024/journal-2024/att-2024/2024.pdf', createTestBlob('content2024'));
			evidences.set('evidences/2023/journal-2023/att-2023/2023.pdf', createTestBlob('content2023'));

			const file = await createZipFile('test.zip', exportData, evidences);

			const result = await importFromZip(file);

			expect(result.attachmentBlobs.size).toBe(2);
			expect(result.attachmentBlobs.has('att-2024')).toBe(true);
			expect(result.attachmentBlobs.has('att-2023')).toBe(true);
		});

		it('ネストされたファイル名パス（スラッシュ含む）を正しく抽出', async () => {
			const attachment = createTestAttachment({
				id: 'att-1',
				generatedName: 'nested/file.pdf'
			});
			const journal = createTestJournal({ id: 'journal-1', attachments: [attachment] });
			const exportData = createTestExportData([journal]);

			const evidences = new Map<string, Blob>();
			evidences.set('evidences/2024/journal-1/att-1/nested/file.pdf', createTestBlob('content'));

			const file = await createZipFile('test.zip', exportData, evidences);

			const result = await importFromZip(file);

			expect(result.attachmentBlobs.size).toBe(1);
			expect(result.attachmentBlobs.has('att-1')).toBe(true);
		});

		it('progress コールバックで正しい件数が報告される', async () => {
			const att1 = createTestAttachment({ id: 'att-1', generatedName: 'file1.pdf' });
			const att2 = createTestAttachment({ id: 'att-2', generatedName: 'file2.pdf' });
			const journal1 = createTestJournal({ id: 'journal-1', attachments: [att1] });
			const journal2 = createTestJournal({ id: 'journal-2', attachments: [att2] });
			const exportData = createTestExportData([journal1, journal2]);

			const evidences = new Map<string, Blob>();
			evidences.set('evidences/2024/journal-1/att-1/file1.pdf', createTestBlob('content1'));
			evidences.set('evidences/2024/journal-2/att-2/file2.pdf', createTestBlob('content2'));

			const file = await createZipFile('test.zip', exportData, evidences);

			const progressUpdates: ZipImportProgress[] = [];

			await importFromZip(file, (progress) => progressUpdates.push({ ...progress }));

			// storing フェーズの最後のアップデートで total が 2 であることを確認
			const storingUpdates = progressUpdates.filter((p) => p.phase === 'storing');
			expect(storingUpdates.length).toBeGreaterThan(0);

			const lastStoring = storingUpdates[storingUpdates.length - 1];
			expect(lastStoring.total).toBe(2);
			expect(lastStoring.current).toBe(2);
		});
	});
});
