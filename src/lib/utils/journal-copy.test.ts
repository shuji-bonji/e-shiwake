import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { copyJournalForNew } from './journal-copy';
import type { JournalEntry } from '$lib/types';

describe('copyJournalForNew', () => {
	const originalJournal: JournalEntry = {
		id: 'original-id',
		date: '2025-01-15',
		lines: [
			{ id: 'line1', type: 'debit', accountCode: '5001', amount: 10000 },
			{ id: 'line2', type: 'credit', accountCode: '1001', amount: 10000 }
		],
		description: 'USBケーブル購入',
		vendor: 'Amazon',
		evidenceStatus: 'digital',
		attachments: [
			{
				id: 'attach1',
				journalEntryId: 'original-id',
				documentDate: '2025-01-15',
				documentType: 'receipt',
				originalName: 'receipt.pdf',
				generatedName: '2025-01-15_領収書_USBケーブル購入_10000円_Amazon.pdf',
				mimeType: 'application/pdf',
				size: 12345,
				description: 'USBケーブル購入',
				amount: 10000,
				vendor: 'Amazon',
				storageType: 'indexeddb',
				createdAt: '2025-01-15T10:00:00Z'
			}
		],
		createdAt: '2025-01-15T10:00:00Z',
		updatedAt: '2025-01-15T10:00:00Z'
	};

	beforeEach(() => {
		// 日付を固定
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2025-02-20T12:00:00Z'));

		// crypto.randomUUID をモック
		vi.stubGlobal('crypto', {
			randomUUID: vi.fn().mockReturnValueOnce('new-line1').mockReturnValueOnce('new-line2')
		});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('日付を今日に変更する', () => {
		const copied = copyJournalForNew(originalJournal);
		expect(copied.date).toBe('2025-02-20');
	});

	it('摘要をコピーする', () => {
		const copied = copyJournalForNew(originalJournal);
		expect(copied.description).toBe('USBケーブル購入');
	});

	it('取引先をコピーする', () => {
		const copied = copyJournalForNew(originalJournal);
		expect(copied.vendor).toBe('Amazon');
	});

	it('仕訳明細行をコピーする（新しいIDで）', () => {
		const copied = copyJournalForNew(originalJournal);
		expect(copied.lines).toHaveLength(2);

		// 勘定科目と金額は同じ
		expect(copied.lines[0].accountCode).toBe('5001');
		expect(copied.lines[0].amount).toBe(10000);
		expect(copied.lines[0].type).toBe('debit');

		expect(copied.lines[1].accountCode).toBe('1001');
		expect(copied.lines[1].amount).toBe(10000);
		expect(copied.lines[1].type).toBe('credit');

		// IDは新しく生成される
		expect(copied.lines[0].id).toBe('new-line1');
		expect(copied.lines[1].id).toBe('new-line2');
	});

	it('証跡ステータスをnoneにリセットする', () => {
		const copied = copyJournalForNew(originalJournal);
		expect(copied.evidenceStatus).toBe('none');
	});

	it('添付ファイルをクリアする', () => {
		const copied = copyJournalForNew(originalJournal);
		expect(copied.attachments).toEqual([]);
	});

	it('元の仕訳を変更しない', () => {
		const originalDate = originalJournal.date;
		const originalAttachments = originalJournal.attachments;

		copyJournalForNew(originalJournal);

		expect(originalJournal.date).toBe(originalDate);
		expect(originalJournal.attachments).toBe(originalAttachments);
		expect(originalJournal.attachments).toHaveLength(1);
	});

	it('IDとタイムスタンプは含まれない', () => {
		const copied = copyJournalForNew(originalJournal);

		// 型チェックで id, createdAt, updatedAt は除外されている
		expect('id' in copied).toBe(false);
		expect('createdAt' in copied).toBe(false);
		expect('updatedAt' in copied).toBe(false);
	});
});
