import { describe, it, expect } from 'vitest';
import {
	generateMonthlySales,
	generateMonthlyTotals,
	generateAccountYearlyTotals,
	calculateMiscIncome,
	calculateRentTotal,
	calculateSalaryTotal,
	generatePage2Details,
	monthlySalesToCsv,
	formatAmount
} from './monthly-summary';
import type { JournalEntry, Account } from '$lib/types';

const mockAccounts: Account[] = [
	{ code: '1003', name: '普通預金', type: 'asset', isSystem: true, createdAt: '' },
	{ code: '4001', name: '売上高', type: 'revenue', isSystem: true, createdAt: '' },
	{ code: '4002', name: '受取利息', type: 'revenue', isSystem: true, createdAt: '' },
	{ code: '4003', name: '雑収入', type: 'revenue', isSystem: true, createdAt: '' },
	{ code: '5001', name: '仕入高', type: 'expense', isSystem: true, createdAt: '' },
	{ code: '5016', name: '給料賃金', type: 'expense', isSystem: true, createdAt: '' },
	{ code: '5017', name: '地代家賃', type: 'expense', isSystem: true, createdAt: '' },
	{ code: '5018', name: '水道光熱費', type: 'expense', isSystem: true, createdAt: '' }
];

const mockJournals: JournalEntry[] = [
	{
		id: '1',
		date: '2025-01-15',
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
		date: '2025-01-20',
		lines: [
			{ id: 'l3', type: 'debit', accountCode: '5001', amount: 30000 },
			{ id: 'l4', type: 'credit', accountCode: '1003', amount: 30000 }
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
		date: '2025-02-10',
		lines: [
			{ id: 'l5', type: 'debit', accountCode: '1003', amount: 200000 },
			{ id: 'l6', type: 'credit', accountCode: '4001', amount: 200000 }
		],
		description: '売上入金2月',
		vendor: 'クライアントB',
		evidenceStatus: 'none',
		attachments: [],
		createdAt: '',
		updatedAt: ''
	},
	{
		id: '4',
		date: '2025-02-15',
		lines: [
			{ id: 'l7', type: 'debit', accountCode: '5017', amount: 50000 },
			{ id: 'l8', type: 'credit', accountCode: '1003', amount: 50000 }
		],
		description: '家賃支払',
		vendor: '○○不動産',
		evidenceStatus: 'none',
		attachments: [],
		createdAt: '',
		updatedAt: ''
	},
	{
		id: '5',
		date: '2025-03-01',
		lines: [
			{ id: 'l9', type: 'debit', accountCode: '1003', amount: 1000 },
			{ id: 'l10', type: 'credit', accountCode: '4003', amount: 1000 }
		],
		description: '雑収入',
		vendor: '',
		evidenceStatus: 'none',
		attachments: [],
		createdAt: '',
		updatedAt: ''
	},
	{
		id: '6',
		date: '2025-03-15',
		lines: [
			{ id: 'l11', type: 'debit', accountCode: '5016', amount: 150000 },
			{ id: 'l12', type: 'credit', accountCode: '1003', amount: 150000 }
		],
		description: '給与支払',
		vendor: '従業員A',
		evidenceStatus: 'none',
		attachments: [],
		createdAt: '',
		updatedAt: ''
	}
];

describe('monthly-summary', () => {
	describe('generateMonthlySales', () => {
		it('月別売上・仕入を正しく生成する', () => {
			const result = generateMonthlySales(mockJournals, mockAccounts);

			expect(result).toHaveLength(12);
			expect(result[0].month).toBe(1);
			expect(result[0].sales).toBe(100000);
			expect(result[0].purchases).toBe(30000);
		});

		it('2月の売上を正しく集計する', () => {
			const result = generateMonthlySales(mockJournals, mockAccounts);

			expect(result[1].month).toBe(2);
			expect(result[1].sales).toBe(200000);
			expect(result[1].purchases).toBe(0);
		});

		it('取引がない月は0になる', () => {
			const result = generateMonthlySales(mockJournals, mockAccounts);

			expect(result[11].month).toBe(12);
			expect(result[11].sales).toBe(0);
			expect(result[11].purchases).toBe(0);
		});
	});

	describe('generateMonthlyTotals', () => {
		it('月別売上・仕入・経費を正しく集計する', () => {
			const result = generateMonthlyTotals(mockJournals, mockAccounts);

			expect(result).toHaveLength(12);
			// 1月: 売上100,000、仕入30,000
			expect(result[0].sales).toBe(100000);
			expect(result[0].purchases).toBe(30000);
		});

		it('2月の経費を正しく集計する', () => {
			const result = generateMonthlyTotals(mockJournals, mockAccounts);

			// 2月: 地代家賃50,000
			expect(result[1].expenses).toBe(50000);
		});

		it('3月の経費を正しく集計する', () => {
			const result = generateMonthlyTotals(mockJournals, mockAccounts);

			// 3月: 給料賃金150,000
			expect(result[2].expenses).toBe(150000);
		});
	});

	describe('generateAccountYearlyTotals', () => {
		it('科目別年間集計を正しく生成する', () => {
			const result = generateAccountYearlyTotals(mockJournals, mockAccounts);

			expect(result.length).toBeGreaterThan(0);
		});

		it('収益のみをフィルタリングできる', () => {
			const result = generateAccountYearlyTotals(mockJournals, mockAccounts, 'revenue');

			expect(result.every((r) => r.accountCode.startsWith('4'))).toBe(true);
		});

		it('費用のみをフィルタリングできる', () => {
			const result = generateAccountYearlyTotals(mockJournals, mockAccounts, 'expense');

			expect(result.every((r) => r.accountCode.startsWith('5'))).toBe(true);
		});

		it('月別金額を正しく集計する', () => {
			const result = generateAccountYearlyTotals(mockJournals, mockAccounts, 'revenue');
			const sales = result.find((r) => r.accountCode === '4001');

			expect(sales?.monthlyAmounts[0]).toBe(100000); // 1月
			expect(sales?.monthlyAmounts[1]).toBe(200000); // 2月
			expect(sales?.total).toBe(300000);
		});
	});

	describe('calculateMiscIncome', () => {
		it('雑収入を正しく計算する', () => {
			const result = calculateMiscIncome(mockJournals, mockAccounts);

			expect(result).toBe(1000);
		});

		it('雑収入がない場合は0を返す', () => {
			const journalsWithoutMisc = mockJournals.filter(
				(j) => !j.lines.some((l) => l.accountCode === '4003')
			);
			const result = calculateMiscIncome(journalsWithoutMisc, mockAccounts);

			expect(result).toBe(0);
		});
	});

	describe('calculateRentTotal', () => {
		it('地代家賃を正しく計算する', () => {
			const result = calculateRentTotal(mockJournals, mockAccounts);

			expect(result).toBe(50000);
		});
	});

	describe('calculateSalaryTotal', () => {
		it('給料賃金を正しく計算する', () => {
			const result = calculateSalaryTotal(mockJournals, mockAccounts);

			expect(result).toBe(150000);
		});
	});

	describe('generatePage2Details', () => {
		it('2ページ目のデータを正しく生成する', () => {
			const result = generatePage2Details(mockJournals, mockAccounts);

			expect(result.monthlySales).toHaveLength(12);
			expect(result.monthlySalesTotal).toBe(300000); // 1月100,000 + 2月200,000
			expect(result.monthlyPurchasesTotal).toBe(30000); // 1月30,000
			expect(result.miscIncome).toBe(1000);
			expect(result.salaryTotal).toBe(150000);
			expect(result.rentTotal).toBe(50000);
		});

		it('personalConsumptionは0を返す', () => {
			const result = generatePage2Details(mockJournals, mockAccounts);

			expect(result.personalConsumption).toBe(0);
		});

		it('rentDetailsオプションを正しく適用する', () => {
			const rentDetails = [
				{
					propertyType: 'building' as const,
					landlordAddress: '東京都...',
					landlordName: '○○不動産',
					rentAmount: 50000,
					deposit: 100000,
					businessRatio: 100
				}
			];
			const result = generatePage2Details(mockJournals, mockAccounts, { rentDetails });

			expect(result.rentDetails).toHaveLength(1);
			expect(result.rentDetails[0].landlordName).toBe('○○不動産');
		});
	});

	describe('monthlySalesToCsv', () => {
		it('CSV形式に変換する', () => {
			const monthlySales = generateMonthlySales(mockJournals, mockAccounts);
			const csv = monthlySalesToCsv(monthlySales, 2025);

			expect(csv).toContain('月別売上（収入）金額及び仕入金額,2025年');
			expect(csv).toContain('月,売上（収入）金額,仕入金額');
			expect(csv).toContain('1月,100000,30000');
			expect(csv).toContain('2月,200000,0');
		});

		it('合計行を含む', () => {
			const monthlySales = generateMonthlySales(mockJournals, mockAccounts);
			const csv = monthlySalesToCsv(monthlySales, 2025);

			expect(csv).toContain('合計,300000,30000');
		});
	});

	describe('formatAmount', () => {
		it('金額をカンマ区切りでフォーマットする', () => {
			expect(formatAmount(1000000)).toBe('1,000,000');
			expect(formatAmount(12345)).toBe('12,345');
		});

		it('0は"0"を返す', () => {
			expect(formatAmount(0)).toBe('0');
		});
	});
});
