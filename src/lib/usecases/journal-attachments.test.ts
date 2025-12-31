import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Attachment, JournalEntry } from '$lib/types';
import type { AttachmentAdapter } from '$lib/adapters/attachments';
import {
	saveVendorIfNeeded,
	syncAttachmentsOnBlur,
	addJournalAttachment,
	removeJournalAttachment,
	updateJournalAttachment,
	previewJournalAttachment,
	confirmEvidenceStatusChange
} from './journal-attachments';

// モックアダプターを作成するヘルパー
function createMockAdapter(overrides: Partial<AttachmentAdapter> = {}): AttachmentAdapter {
	return {
		addAttachmentToJournal: vi.fn(),
		removeAttachmentFromJournal: vi.fn(),
		getAttachmentBlob: vi.fn(),
		updateAttachment: vi.fn(),
		syncAttachmentsWithJournal: vi.fn(),
		saveVendor: vi.fn(),
		...overrides
	};
}

// テスト用の仕訳データ
function createMockJournal(overrides: Partial<JournalEntry> = {}): JournalEntry {
	return {
		id: 'journal-1',
		date: '2024-05-15',
		lines: [
			{ id: 'line-1', type: 'debit', accountCode: '5001', amount: 1000 },
			{ id: 'line-2', type: 'credit', accountCode: '1001', amount: 1000 }
		],
		vendor: 'テスト取引先',
		description: 'テスト摘要',
		evidenceStatus: 'none',
		attachments: [],
		createdAt: '2024-05-15T00:00:00.000Z',
		updatedAt: '2024-05-15T00:00:00.000Z',
		...overrides
	};
}

// テスト用の証憑データ
function createMockAttachment(overrides: Partial<Attachment> = {}): Attachment {
	return {
		id: 'attachment-1',
		journalEntryId: 'journal-1',
		documentDate: '2024-05-15',
		documentType: 'receipt',
		originalName: 'test.pdf',
		generatedName: '2024-05-15_領収書_テスト_1000円_テスト取引先.pdf',
		mimeType: 'application/pdf',
		size: 1024,
		description: 'テスト',
		amount: 1000,
		vendor: 'テスト取引先',
		storageType: 'indexeddb',
		createdAt: '2024-05-15T00:00:00.000Z',
		...overrides
	};
}

describe('journal-attachments usecase', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('saveVendorIfNeeded', () => {
		it('取引先が入力されている場合は保存する', async () => {
			const adapter = createMockAdapter();
			await saveVendorIfNeeded('テスト取引先', adapter);
			expect(adapter.saveVendor).toHaveBeenCalledWith('テスト取引先');
		});

		it('取引先が空の場合は保存しない', async () => {
			const adapter = createMockAdapter();
			await saveVendorIfNeeded('', adapter);
			expect(adapter.saveVendor).not.toHaveBeenCalled();
		});

		it('取引先が空白のみの場合は保存しない', async () => {
			const adapter = createMockAdapter();
			await saveVendorIfNeeded('   ', adapter);
			expect(adapter.saveVendor).not.toHaveBeenCalled();
		});
	});

	describe('syncAttachmentsOnBlur', () => {
		it('証憑がない場合はnullを返す', async () => {
			const adapter = createMockAdapter({
				syncAttachmentsWithJournal: vi.fn().mockResolvedValue([])
			});
			const journal = createMockJournal();

			const result = await syncAttachmentsOnBlur({
				journal,
				mainDebitAmount: 1000,
				adapter
			});

			expect(result).toBeNull();
		});

		it('変更がない場合はnullを返す', async () => {
			const attachment = createMockAttachment();
			const adapter = createMockAdapter({
				syncAttachmentsWithJournal: vi.fn().mockResolvedValue([attachment])
			});
			const journal = createMockJournal({ attachments: [attachment] });

			const result = await syncAttachmentsOnBlur({
				journal,
				mainDebitAmount: 1000,
				adapter
			});

			expect(result).toBeNull();
		});

		it('ファイル名が変更された場合は新しい証憑配列を返す', async () => {
			const oldAttachment = createMockAttachment();
			const newAttachment = createMockAttachment({
				generatedName: '2024-05-15_領収書_新しい摘要_2000円_新取引先.pdf'
			});
			const adapter = createMockAdapter({
				syncAttachmentsWithJournal: vi.fn().mockResolvedValue([newAttachment])
			});
			const journal = createMockJournal({ attachments: [oldAttachment] });

			const result = await syncAttachmentsOnBlur({
				journal,
				mainDebitAmount: 2000,
				adapter
			});

			expect(result).toEqual([newAttachment]);
		});
	});

	describe('addJournalAttachment', () => {
		it('証憑を追加して更新された仕訳を返す', async () => {
			const newAttachment = createMockAttachment();
			const adapter = createMockAdapter({
				addAttachmentToJournal: vi.fn().mockResolvedValue(newAttachment)
			});
			const journal = createMockJournal();
			const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });

			const result = await addJournalAttachment({
				journal,
				file,
				documentDate: '2024-05-15',
				documentType: 'receipt',
				generatedName: '2024-05-15_領収書_テスト_1000円_テスト取引先.pdf',
				updatedVendor: '新取引先',
				mainAmount: 1000,
				adapter
			});

			expect(result.attachments).toHaveLength(1);
			expect(result.attachments[0]).toEqual(newAttachment);
			expect(result.evidenceStatus).toBe('digital');
			expect(result.vendor).toBe('新取引先');
		});

		it('既存の証憑がある場合は追加される', async () => {
			const existingAttachment = createMockAttachment({ id: 'existing' });
			const newAttachment = createMockAttachment({ id: 'new' });
			const adapter = createMockAdapter({
				addAttachmentToJournal: vi.fn().mockResolvedValue(newAttachment)
			});
			const journal = createMockJournal({ attachments: [existingAttachment] });
			const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });

			const result = await addJournalAttachment({
				journal,
				file,
				documentDate: '2024-05-15',
				documentType: 'receipt',
				generatedName: 'test.pdf',
				updatedVendor: 'テスト取引先',
				mainAmount: 1000,
				adapter
			});

			expect(result.attachments).toHaveLength(2);
			expect(result.attachments[0]).toEqual(existingAttachment);
			expect(result.attachments[1]).toEqual(newAttachment);
		});

		it('日付から年度を正しく抽出する', async () => {
			const adapter = createMockAdapter({
				addAttachmentToJournal: vi.fn().mockResolvedValue(createMockAttachment())
			});
			const journal = createMockJournal({ date: '2023-12-31' });
			const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });

			await addJournalAttachment({
				journal,
				file,
				documentDate: '2023-12-31',
				documentType: 'receipt',
				generatedName: 'test.pdf',
				updatedVendor: 'テスト',
				mainAmount: 1000,
				adapter
			});

			expect(adapter.addAttachmentToJournal).toHaveBeenCalledWith(
				journal.id,
				expect.objectContaining({ year: 2023 }),
				undefined
			);
		});

		it('不正な日付形式の場合は現在年度を使用する', async () => {
			const currentYear = new Date().getFullYear();
			const adapter = createMockAdapter({
				addAttachmentToJournal: vi.fn().mockResolvedValue(createMockAttachment())
			});
			const journal = createMockJournal({ date: 'invalid-date' });
			const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });

			await addJournalAttachment({
				journal,
				file,
				documentDate: '2024-05-15',
				documentType: 'receipt',
				generatedName: 'test.pdf',
				updatedVendor: 'テスト',
				mainAmount: 1000,
				adapter
			});

			expect(adapter.addAttachmentToJournal).toHaveBeenCalledWith(
				journal.id,
				expect.objectContaining({ year: currentYear }),
				undefined
			);
		});
	});

	describe('removeJournalAttachment', () => {
		it('証憑を削除して更新された仕訳を返す', async () => {
			const attachment = createMockAttachment();
			const adapter = createMockAdapter();
			const journal = createMockJournal({
				attachments: [attachment],
				evidenceStatus: 'digital'
			});

			const result = await removeJournalAttachment({
				journal,
				attachmentId: attachment.id,
				adapter
			});

			expect(adapter.removeAttachmentFromJournal).toHaveBeenCalledWith(
				journal.id,
				attachment.id,
				undefined
			);
			expect(result.attachments).toHaveLength(0);
			expect(result.evidenceStatus).toBe('none');
		});

		it('他に証憑がある場合はevidenceStatusはdigitalのまま', async () => {
			const attachment1 = createMockAttachment({ id: 'att-1' });
			const attachment2 = createMockAttachment({ id: 'att-2' });
			const adapter = createMockAdapter();
			const journal = createMockJournal({
				attachments: [attachment1, attachment2],
				evidenceStatus: 'digital'
			});

			const result = await removeJournalAttachment({
				journal,
				attachmentId: 'att-1',
				adapter
			});

			expect(result.attachments).toHaveLength(1);
			expect(result.attachments[0].id).toBe('att-2');
			expect(result.evidenceStatus).toBe('digital');
		});
	});

	describe('updateJournalAttachment', () => {
		it('証憑を更新して更新された仕訳を返す', async () => {
			const attachment = createMockAttachment();
			const updatedAttachment = createMockAttachment({
				description: '更新後の摘要',
				amount: 2000
			});
			const adapter = createMockAdapter({
				updateAttachment: vi.fn().mockResolvedValue(updatedAttachment)
			});
			const journal = createMockJournal({ attachments: [attachment] });

			const result = await updateJournalAttachment({
				journal,
				attachmentId: attachment.id,
				updates: {
					documentDate: '2024-05-15',
					documentType: 'receipt',
					description: '更新後の摘要',
					amount: 2000,
					vendor: 'テスト取引先'
				},
				adapter
			});

			expect(result.attachments).toHaveLength(1);
			expect(result.attachments[0].description).toBe('更新後の摘要');
			expect(result.attachments[0].amount).toBe(2000);
		});
	});

	describe('previewJournalAttachment', () => {
		it('BlobをURLに変換してウィンドウを開く', async () => {
			const blob = new Blob(['test'], { type: 'application/pdf' });
			const adapter = createMockAdapter({
				getAttachmentBlob: vi.fn().mockResolvedValue(blob)
			});
			const journal = createMockJournal();
			const attachment = createMockAttachment();

			// グローバル関数をモック
			const mockCreateObjectURL = vi.fn().mockReturnValue('blob:test-url');
			const mockRevokeObjectURL = vi.fn();
			const mockWindowOpen = vi.fn();

			global.URL.createObjectURL = mockCreateObjectURL;
			global.URL.revokeObjectURL = mockRevokeObjectURL;
			global.window = { open: mockWindowOpen } as unknown as Window & typeof globalThis;

			await previewJournalAttachment({
				journal,
				attachment,
				adapter
			});

			expect(adapter.getAttachmentBlob).toHaveBeenCalledWith(journal.id, attachment.id, undefined);
			expect(mockCreateObjectURL).toHaveBeenCalledWith(blob);
			expect(mockWindowOpen).toHaveBeenCalledWith('blob:test-url', '_blank');
		});

		it('Blobがnullの場合は何もしない', async () => {
			const adapter = createMockAdapter({
				getAttachmentBlob: vi.fn().mockResolvedValue(null)
			});
			const journal = createMockJournal();
			const attachment = createMockAttachment();

			const mockWindowOpen = vi.fn();
			global.window = { open: mockWindowOpen } as unknown as Window & typeof globalThis;

			await previewJournalAttachment({
				journal,
				attachment,
				adapter
			});

			expect(mockWindowOpen).not.toHaveBeenCalled();
		});
	});

	describe('confirmEvidenceStatusChange', () => {
		it('全ての証憑を削除してステータスを更新する', async () => {
			const attachment1 = createMockAttachment({ id: 'att-1' });
			const attachment2 = createMockAttachment({ id: 'att-2' });
			const adapter = createMockAdapter();
			const journal = createMockJournal({
				attachments: [attachment1, attachment2],
				evidenceStatus: 'digital'
			});

			const result = await confirmEvidenceStatusChange({
				journal,
				nextStatus: 'paper',
				adapter
			});

			expect(adapter.removeAttachmentFromJournal).toHaveBeenCalledTimes(2);
			expect(adapter.removeAttachmentFromJournal).toHaveBeenCalledWith(
				journal.id,
				'att-1',
				undefined
			);
			expect(adapter.removeAttachmentFromJournal).toHaveBeenCalledWith(
				journal.id,
				'att-2',
				undefined
			);
			expect(result.attachments).toHaveLength(0);
			expect(result.evidenceStatus).toBe('paper');
		});

		it('証憑がない場合もステータスを更新する', async () => {
			const adapter = createMockAdapter();
			const journal = createMockJournal({ evidenceStatus: 'none' });

			const result = await confirmEvidenceStatusChange({
				journal,
				nextStatus: 'paper',
				adapter
			});

			expect(adapter.removeAttachmentFromJournal).not.toHaveBeenCalled();
			expect(result.evidenceStatus).toBe('paper');
		});
	});
});
