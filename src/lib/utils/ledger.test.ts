import { describe, it, expect } from 'vitest';
import { generateLedger, getUsedAccounts } from './ledger';
import type { JournalEntry, Account } from '$lib/types';

const mockAccounts: Account[] = [
	{ code: '1001', name: '現金', type: 'asset', isSystem: true, createdAt: '' },
	{ code: '1003', name: '普通預金', type: 'asset', isSystem: true, createdAt: '' },
	{ code: '4001', name: '売上高', type: 'revenue', isSystem: true, createdAt: '' },
	{ code: '5017', name: '地代家賃', type: 'expense', isSystem: true, createdAt: '' },
	{ code: '3002', name: '事業主貸', type: 'equity', isSystem: true, createdAt: '' }
];

const mockJournals: JournalEntry[] = [
	{
		id: '1',
		date: '2025-01-10',
		lines: [
			{ id: 'l1', type: 'debit', accountCode: '1003', amount: 100000 },
			{ id: 'l2', type: 'credit', accountCode: '4001', amount: 100000 }
		],
		description: '売上入金',
		vendor: 'クライアントA',
		evidenceStatus: 'none',
		attachments: [],
		createdAt: '2025-01-10T00:00:00Z',
		updatedAt: '2025-01-10T00:00:00Z'
	},
	{
		id: '2',
		date: '2025-01-15',
		lines: [
			{ id: 'l3', type: 'debit', accountCode: '5017', amount: 100000 },
			{ id: 'l4', type: 'credit', accountCode: '1003', amount: 100000 }
		],
		description: '家賃支払',
		vendor: '○○不動産',
		evidenceStatus: 'digital',
		attachments: [],
		createdAt: '2025-01-15T00:00:00Z',
		updatedAt: '2025-01-15T00:00:00Z'
	}
];

describe('ledger', () => {
	describe('generateLedger', () => {
		it('普通預金の元帳を正しく生成する', () => {
			const ledger = generateLedger(mockJournals, '1003', mockAccounts, 500000);

			expect(ledger.accountCode).toBe('1003');
			expect(ledger.accountName).toBe('普通預金');
			expect(ledger.openingBalance).toBe(500000);
			expect(ledger.entries).toHaveLength(2);

			// 1件目: 売上入金（借方）
			expect(ledger.entries[0].debit).toBe(100000);
			expect(ledger.entries[0].credit).toBeNull();
			expect(ledger.entries[0].balance).toBe(600000);
			expect(ledger.entries[0].counterAccount).toBe('売上高');

			// 2件目: 家賃支払（貸方）
			expect(ledger.entries[1].debit).toBeNull();
			expect(ledger.entries[1].credit).toBe(100000);
			expect(ledger.entries[1].balance).toBe(500000);
			expect(ledger.entries[1].counterAccount).toBe('地代家賃');

			expect(ledger.totalDebit).toBe(100000);
			expect(ledger.totalCredit).toBe(100000);
			expect(ledger.closingBalance).toBe(500000);
		});

		it('売上高（収益）の元帳を正しく生成する', () => {
			const ledger = generateLedger(mockJournals, '4001', mockAccounts, 0);

			expect(ledger.accountCode).toBe('4001');
			expect(ledger.accountName).toBe('売上高');
			expect(ledger.entries).toHaveLength(1);

			// 収益は貸方で増加
			expect(ledger.entries[0].debit).toBeNull();
			expect(ledger.entries[0].credit).toBe(100000);
			expect(ledger.entries[0].balance).toBe(100000);
			expect(ledger.closingBalance).toBe(100000);
		});

		it('地代家賃（費用）の元帳を正しく生成する', () => {
			const ledger = generateLedger(mockJournals, '5017', mockAccounts, 0);

			expect(ledger.accountCode).toBe('5017');
			expect(ledger.accountName).toBe('地代家賃');
			expect(ledger.entries).toHaveLength(1);

			// 費用は借方で増加
			expect(ledger.entries[0].debit).toBe(100000);
			expect(ledger.entries[0].credit).toBeNull();
			expect(ledger.entries[0].balance).toBe(100000);
			expect(ledger.closingBalance).toBe(100000);
		});

		it('複合仕訳の相手科目が「諸口」になる', () => {
			const journalWithMultipleLines: JournalEntry[] = [
				{
					id: '3',
					date: '2025-01-20',
					lines: [
						{ id: 'l5', type: 'debit', accountCode: '5017', amount: 80000 },
						{ id: 'l6', type: 'debit', accountCode: '3002', amount: 20000 },
						{ id: 'l7', type: 'credit', accountCode: '1003', amount: 100000 }
					],
					description: '家賃支払（家事按分）',
					vendor: '○○不動産',
					evidenceStatus: 'none',
					attachments: [],
					createdAt: '2025-01-20T00:00:00Z',
					updatedAt: '2025-01-20T00:00:00Z'
				}
			];

			const ledger = generateLedger(journalWithMultipleLines, '1003', mockAccounts, 0);
			expect(ledger.entries[0].counterAccount).toBe('諸口');
		});

		it('存在しない科目でエラーになる', () => {
			expect(() => generateLedger(mockJournals, '9999', mockAccounts, 0)).toThrow(
				'勘定科目が見つかりません: 9999'
			);
		});

		it('該当する仕訳がない場合は空の配列を返す', () => {
			const ledger = generateLedger(mockJournals, '1001', mockAccounts, 0);
			expect(ledger.entries).toHaveLength(0);
			expect(ledger.closingBalance).toBe(0);
		});

		it('日付順にソートされる', () => {
			const unorderedJournals: JournalEntry[] = [
				{
					id: '2',
					date: '2025-01-15',
					lines: [
						{ id: 'l3', type: 'debit', accountCode: '1003', amount: 50000 },
						{ id: 'l4', type: 'credit', accountCode: '4001', amount: 50000 }
					],
					description: '売上2',
					vendor: '',
					evidenceStatus: 'none',
					attachments: [],
					createdAt: '2025-01-15T00:00:00Z',
					updatedAt: '2025-01-15T00:00:00Z'
				},
				{
					id: '1',
					date: '2025-01-10',
					lines: [
						{ id: 'l1', type: 'debit', accountCode: '1003', amount: 100000 },
						{ id: 'l2', type: 'credit', accountCode: '4001', amount: 100000 }
					],
					description: '売上1',
					vendor: '',
					evidenceStatus: 'none',
					attachments: [],
					createdAt: '2025-01-10T00:00:00Z',
					updatedAt: '2025-01-10T00:00:00Z'
				}
			];

			const ledger = generateLedger(unorderedJournals, '1003', mockAccounts, 0);
			expect(ledger.entries[0].date).toBe('2025-01-10');
			expect(ledger.entries[1].date).toBe('2025-01-15');
		});
	});

	describe('getUsedAccounts', () => {
		it('使用されている勘定科目を抽出する', () => {
			const used = getUsedAccounts(mockJournals, mockAccounts);

			expect(used).toHaveLength(3);
			expect(used.map((a) => a.code)).toContain('1003');
			expect(used.map((a) => a.code)).toContain('4001');
			expect(used.map((a) => a.code)).toContain('5017');
			expect(used.map((a) => a.code)).not.toContain('1001');
		});

		it('コード順にソートされる', () => {
			const used = getUsedAccounts(mockJournals, mockAccounts);
			expect(used[0].code).toBe('1003');
			expect(used[1].code).toBe('4001');
			expect(used[2].code).toBe('5017');
		});

		it('仕訳がない場合は空配列を返す', () => {
			const used = getUsedAccounts([], mockAccounts);
			expect(used).toHaveLength(0);
		});
	});
});
