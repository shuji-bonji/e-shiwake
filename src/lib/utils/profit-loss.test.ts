import { describe, it, expect } from 'vitest';
import { generateProfitLoss, formatPLAmount, profitLossToCsv } from './profit-loss';
import type { JournalEntry, Account } from '$lib/types';

const mockAccounts: Account[] = [
	{ code: '1003', name: '普通預金', type: 'asset', isSystem: true, createdAt: '' },
	{ code: '4001', name: '売上高', type: 'revenue', isSystem: true, createdAt: '' },
	{ code: '4002', name: '受取利息', type: 'revenue', isSystem: true, createdAt: '' },
	{ code: '5001', name: '仕入高', type: 'expense', isSystem: true, createdAt: '' },
	{ code: '5017', name: '地代家賃', type: 'expense', isSystem: true, createdAt: '' },
	{ code: '5018', name: '水道光熱費', type: 'expense', isSystem: true, createdAt: '' }
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
		createdAt: '',
		updatedAt: ''
	},
	{
		id: '2',
		date: '2025-01-15',
		lines: [
			{ id: 'l3', type: 'debit', accountCode: '5001', amount: 20000 },
			{ id: 'l4', type: 'credit', accountCode: '1003', amount: 20000 }
		],
		description: '仕入',
		vendor: '仕入先A',
		evidenceStatus: 'none',
		attachments: [],
		createdAt: '',
		updatedAt: ''
	},
	{
		id: '3',
		date: '2025-01-20',
		lines: [
			{ id: 'l5', type: 'debit', accountCode: '5017', amount: 30000 },
			{ id: 'l6', type: 'credit', accountCode: '1003', amount: 30000 }
		],
		description: '家賃支払',
		vendor: '○○不動産',
		evidenceStatus: 'none',
		attachments: [],
		createdAt: '',
		updatedAt: ''
	},
	{
		id: '4',
		date: '2025-01-25',
		lines: [
			{ id: 'l7', type: 'debit', accountCode: '1003', amount: 100 },
			{ id: 'l8', type: 'credit', accountCode: '4002', amount: 100 }
		],
		description: '利息入金',
		vendor: '○○銀行',
		evidenceStatus: 'none',
		attachments: [],
		createdAt: '',
		updatedAt: ''
	}
];

describe('profit-loss', () => {
	describe('generateProfitLoss', () => {
		it('損益計算書を正しく生成する', () => {
			const pl = generateProfitLoss(mockJournals, mockAccounts, 2025);

			expect(pl.fiscalYear).toBe(2025);
			expect(pl.salesRevenue).toHaveLength(1);
			expect(pl.otherRevenue).toHaveLength(1);
			expect(pl.costOfSales).toHaveLength(1);
			expect(pl.operatingExpenses).toHaveLength(1);
		});

		it('売上高を正しく集計する', () => {
			const pl = generateProfitLoss(mockJournals, mockAccounts, 2025);

			const sales = pl.salesRevenue.find((r) => r.accountCode === '4001');
			expect(sales?.amount).toBe(100000);
			expect(pl.totalRevenue).toBe(100100); // 売上100,000 + 受取利息100
		});

		it('売上原価を正しく集計する', () => {
			const pl = generateProfitLoss(mockJournals, mockAccounts, 2025);

			const cost = pl.costOfSales.find((r) => r.accountCode === '5001');
			expect(cost?.amount).toBe(20000);
		});

		it('販管費を正しく集計する', () => {
			const pl = generateProfitLoss(mockJournals, mockAccounts, 2025);

			const rent = pl.operatingExpenses.find((r) => r.accountCode === '5017');
			expect(rent?.amount).toBe(30000);
		});

		it('営業外収益を正しく集計する', () => {
			const pl = generateProfitLoss(mockJournals, mockAccounts, 2025);

			const interest = pl.otherRevenue.find((r) => r.accountCode === '4002');
			expect(interest?.amount).toBe(100);
		});

		it('売上総利益を正しく計算する', () => {
			const pl = generateProfitLoss(mockJournals, mockAccounts, 2025);

			// 売上高100,000 - 仕入高20,000 = 80,000
			expect(pl.grossProfit).toBe(80000);
		});

		it('営業利益を正しく計算する', () => {
			const pl = generateProfitLoss(mockJournals, mockAccounts, 2025);

			// 売上総利益80,000 - 販管費30,000 = 50,000
			expect(pl.operatingIncome).toBe(50000);
		});

		it('当期純利益を正しく計算する', () => {
			const pl = generateProfitLoss(mockJournals, mockAccounts, 2025);

			// 営業利益50,000 + 営業外収益100 = 50,100
			expect(pl.netIncome).toBe(50100);
		});

		it('仕訳がない場合は0の損益計算書を返す', () => {
			const pl = generateProfitLoss([], mockAccounts, 2025);

			expect(pl.salesRevenue).toHaveLength(0);
			expect(pl.totalRevenue).toBe(0);
			expect(pl.grossProfit).toBe(0);
			expect(pl.operatingIncome).toBe(0);
			expect(pl.netIncome).toBe(0);
		});

		it('収益の借方記入（返品等）を正しく処理する', () => {
			const returnJournals: JournalEntry[] = [
				{
					id: '1',
					date: '2025-01-10',
					lines: [
						{ id: 'l1', type: 'debit', accountCode: '1003', amount: 100000 },
						{ id: 'l2', type: 'credit', accountCode: '4001', amount: 100000 }
					],
					description: '売上',
					vendor: '',
					evidenceStatus: 'none',
					attachments: [],
					createdAt: '',
					updatedAt: ''
				},
				{
					id: '2',
					date: '2025-01-15',
					lines: [
						{ id: 'l3', type: 'debit', accountCode: '4001', amount: 10000 },
						{ id: 'l4', type: 'credit', accountCode: '1003', amount: 10000 }
					],
					description: '売上返品',
					vendor: '',
					evidenceStatus: 'none',
					attachments: [],
					createdAt: '',
					updatedAt: ''
				}
			];

			const pl = generateProfitLoss(returnJournals, mockAccounts, 2025);
			const sales = pl.salesRevenue.find((r) => r.accountCode === '4001');
			// 100,000 - 10,000 = 90,000
			expect(sales?.amount).toBe(90000);
		});

		it('科目コード順にソートされる', () => {
			const multipleExpenseJournals: JournalEntry[] = [
				{
					id: '1',
					date: '2025-01-10',
					lines: [
						{ id: 'l1', type: 'debit', accountCode: '5018', amount: 10000 },
						{ id: 'l2', type: 'credit', accountCode: '1003', amount: 10000 }
					],
					description: '電気代',
					vendor: '',
					evidenceStatus: 'none',
					attachments: [],
					createdAt: '',
					updatedAt: ''
				},
				{
					id: '2',
					date: '2025-01-15',
					lines: [
						{ id: 'l3', type: 'debit', accountCode: '5017', amount: 30000 },
						{ id: 'l4', type: 'credit', accountCode: '1003', amount: 30000 }
					],
					description: '家賃',
					vendor: '',
					evidenceStatus: 'none',
					attachments: [],
					createdAt: '',
					updatedAt: ''
				}
			];

			const pl = generateProfitLoss(multipleExpenseJournals, mockAccounts, 2025);
			expect(pl.operatingExpenses[0].accountCode).toBe('5017');
			expect(pl.operatingExpenses[1].accountCode).toBe('5018');
		});
	});

	describe('formatPLAmount', () => {
		it('金額をカンマ区切りでフォーマットする', () => {
			expect(formatPLAmount(1000000)).toBe('1,000,000');
			expect(formatPLAmount(12345)).toBe('12,345');
		});

		it('0は"0"を返す', () => {
			expect(formatPLAmount(0)).toBe('0');
		});

		it('負の値は△表示する', () => {
			expect(formatPLAmount(-50000)).toBe('△50,000');
			expect(formatPLAmount(-1234567)).toBe('△1,234,567');
		});
	});

	describe('profitLossToCsv', () => {
		it('CSV形式に変換される', () => {
			const pl = generateProfitLoss(mockJournals, mockAccounts, 2025);
			const csv = profitLossToCsv(pl);

			expect(csv).toContain('損益計算書,2025年度');
			expect(csv).toContain('【売上高】');
			expect(csv).toContain('【売上原価】');
			expect(csv).toContain('売上総利益');
			expect(csv).toContain('【販売費及び一般管理費】');
			expect(csv).toContain('営業利益');
			expect(csv).toContain('【営業外収益】');
			expect(csv).toContain('当期純利益');
		});

		it('金額が正しく含まれる', () => {
			const pl = generateProfitLoss(mockJournals, mockAccounts, 2025);
			const csv = profitLossToCsv(pl);

			expect(csv).toContain('4001,売上高,100000');
			expect(csv).toContain('5001,仕入高,20000');
			expect(csv).toContain('5017,地代家賃,30000');
			expect(csv).toContain('4002,受取利息,100');
			expect(csv).toContain(',当期純利益,50100');
		});
	});
});
