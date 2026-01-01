import { describe, it, expect } from 'vitest';
import { cloneJournal } from './clone';
import type { JournalEntry } from '$lib/types';

describe('cloneJournal', () => {
	it('仕訳を正しくクローンする', () => {
		const journal: JournalEntry = {
			id: 'journal-1',
			date: '2025-01-15',
			lines: [
				{
					id: 'line-1',
					type: 'debit',
					accountCode: '5004',
					amount: 10000,
					taxCategory: 'purchase_10'
				},
				{ id: 'line-2', type: 'credit', accountCode: '1003', amount: 10000 }
			],
			vendor: 'NTT',
			description: '通信費',
			evidenceStatus: 'none',
			attachments: [],
			createdAt: '2025-01-15T10:00:00Z',
			updatedAt: '2025-01-15T10:00:00Z'
		};

		const cloned = cloneJournal(journal);

		expect(cloned).toEqual(journal);
		expect(cloned).not.toBe(journal);
		expect(cloned.lines).not.toBe(journal.lines);
	});

	it('家事按分フラグを保持する', () => {
		const journal: JournalEntry = {
			id: 'journal-1',
			date: '2025-01-15',
			lines: [
				{
					id: 'line-1',
					type: 'debit',
					accountCode: '5004',
					amount: 3300,
					taxCategory: 'purchase_10',
					_businessRatioApplied: true,
					_originalAmount: 10000,
					_businessRatio: 33
				},
				{
					id: 'line-2',
					type: 'debit',
					accountCode: '3002',
					amount: 6700,
					taxCategory: 'na',
					_businessRatioGenerated: true
				},
				{ id: 'line-3', type: 'credit', accountCode: '1003', amount: 10000 }
			],
			vendor: 'NTT',
			description: '通信費',
			evidenceStatus: 'none',
			attachments: [],
			createdAt: '2025-01-15T10:00:00Z',
			updatedAt: '2025-01-15T10:00:00Z'
		};

		const cloned = cloneJournal(journal);

		// 家事按分フラグが保持されていること
		expect(cloned.lines[0]._businessRatioApplied).toBe(true);
		expect(cloned.lines[0]._originalAmount).toBe(10000);
		expect(cloned.lines[0]._businessRatio).toBe(33);
		expect(cloned.lines[1]._businessRatioGenerated).toBe(true);
	});

	it('Blob添付ファイルを保持する', () => {
		const blob = new Blob(['test'], { type: 'application/pdf' });
		const journal: JournalEntry = {
			id: 'journal-1',
			date: '2025-01-15',
			lines: [
				{ id: 'line-1', type: 'debit', accountCode: '5004', amount: 10000 },
				{ id: 'line-2', type: 'credit', accountCode: '1003', amount: 10000 }
			],
			vendor: 'NTT',
			description: '通信費',
			evidenceStatus: 'digital',
			attachments: [
				{
					id: 'att-1',
					journalEntryId: 'journal-1',
					documentDate: '2025-01-15',
					documentType: 'receipt',
					originalName: 'receipt.pdf',
					generatedName: '2025-01-15_領収書_通信費_10000円_NTT.pdf',
					mimeType: 'application/pdf',
					size: 1024,
					description: '通信費',
					amount: 10000,
					vendor: 'NTT',
					storageType: 'indexeddb',
					blob,
					createdAt: '2025-01-15T10:00:00Z'
				}
			],
			createdAt: '2025-01-15T10:00:00Z',
			updatedAt: '2025-01-15T10:00:00Z'
		};

		const cloned = cloneJournal(journal);

		// Blobが保持されていること（参照が同じ）
		expect(cloned.attachments[0].blob).toBe(blob);
	});
});
