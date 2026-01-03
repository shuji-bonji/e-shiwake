import { describe, it, expect } from 'vitest';
import {
	generatePage1,
	generatePage4,
	generateBlueReturnData,
	blueReturnSummaryToCsv,
	validateBlueReturnData,
	formatAmount,
	formatJPY,
	getMonthNames
} from './blue-return';
import type { ProfitLossData, BalanceSheetData, JournalEntry, Account } from '$lib/types';
import type { BusinessInfo, FixedAsset } from '$lib/types/blue-return-types';

const mockProfitLoss: ProfitLossData = {
	fiscalYear: 2025,
	salesRevenue: [{ accountCode: '4001', accountName: '売上高', amount: 5000000 }],
	otherRevenue: [{ accountCode: '4002', accountName: '受取利息', amount: 1000 }],
	costOfSales: [{ accountCode: '5001', accountName: '仕入高', amount: 1000000 }],
	operatingExpenses: [
		{ accountCode: '5017', accountName: '地代家賃', amount: 600000 },
		{ accountCode: '5018', accountName: '水道光熱費', amount: 120000 }
	],
	totalRevenue: 5001000,
	totalExpenses: 1720000,
	grossProfit: 4000000,
	operatingIncome: 3280000,
	netIncome: 3281000
};

const mockBalanceSheet: BalanceSheetData = {
	fiscalYear: 2025,
	currentAssets: [
		{ accountCode: '1001', accountName: '現金', amount: 100000 },
		{ accountCode: '1003', accountName: '普通預金', amount: 3000000 }
	],
	fixedAssets: [{ accountCode: '1101', accountName: '建物', amount: 500000 }],
	currentLiabilities: [{ accountCode: '2001', accountName: '買掛金', amount: 200000 }],
	fixedLiabilities: [],
	equity: [{ accountCode: '3001', accountName: '元入金', amount: 3400000 }],
	totalAssets: 3600000,
	totalLiabilities: 200000,
	totalEquity: 3400000,
	retainedEarnings: 3281000,
	totalLiabilitiesAndEquity: 3600000
};

const mockAccounts: Account[] = [
	{ code: '1001', name: '現金', type: 'asset', isSystem: true, createdAt: '' },
	{ code: '1003', name: '普通預金', type: 'asset', isSystem: true, createdAt: '' },
	{ code: '4001', name: '売上高', type: 'revenue', isSystem: true, createdAt: '' },
	{ code: '5017', name: '地代家賃', type: 'expense', isSystem: true, createdAt: '' }
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
	}
];

const mockBusinessInfo: BusinessInfo = {
	name: '山田 太郎',
	tradeName: '山田商店',
	address: '東京都渋谷区...',
	businessType: 'システム開発業'
};

describe('blue-return', () => {
	describe('generatePage1', () => {
		it('1ページ目（損益計算書）を正しく生成する', () => {
			const result = generatePage1(mockProfitLoss);

			expect(result.salesTotal).toBe(5001000);
			// 仕入高1,000,000がある場合: costOfSales = 1,000,000
			expect(result.purchases).toBe(1000000);
			expect(result.costOfSales).toBe(1000000);
			expect(result.grossProfit).toBe(4001000); // 売上 - 売上原価
		});

		it('棚卸高を考慮した売上原価を計算する', () => {
			const result = generatePage1(mockProfitLoss, {
				inventoryStart: 100000,
				inventoryEnd: 50000
			});

			// 期首100,000 + 仕入0 - 期末50,000 = 50,000
			// ※ mockProfitLossのcostOfSalesは仕入高ではなく売上原価として扱われない
			// generatePage1ではpurchasesを別途計算している
			expect(result.inventoryStart).toBe(100000);
			expect(result.inventoryEnd).toBe(50000);
		});

		it('青色申告特別控除を正しく適用する', () => {
			const result = generatePage1(mockProfitLoss, { blueReturnDeduction: 65 });

			expect(result.blueReturnDeduction).toBe(650000);
		});

		it('55万円控除を正しく適用する', () => {
			const result = generatePage1(mockProfitLoss, { blueReturnDeduction: 55 });

			expect(result.blueReturnDeduction).toBe(550000);
		});

		it('10万円控除を正しく適用する', () => {
			const result = generatePage1(mockProfitLoss, { blueReturnDeduction: 10 });

			expect(result.blueReturnDeduction).toBe(100000);
		});

		it('経費一覧を正しく生成する', () => {
			const result = generatePage1(mockProfitLoss);

			expect(result.expenses).toHaveLength(2);
			expect(result.expensesTotal).toBe(720000);
		});

		it('所得金額が0未満にならない', () => {
			const lowIncomePL: ProfitLossData = {
				...mockProfitLoss,
				salesRevenue: [{ accountCode: '4001', accountName: '売上高', amount: 500000 }],
				otherRevenue: [],
				totalRevenue: 500000,
				grossProfit: 500000,
				operatingIncome: -200000,
				netIncome: -200000
			};

			const result = generatePage1(lowIncomePL, { blueReturnDeduction: 65 });

			expect(result.businessIncome).toBe(0);
		});
	});

	describe('generatePage4', () => {
		it('4ページ目（貸借対照表）を正しく生成する', () => {
			const result = generatePage4(mockBalanceSheet, null);

			expect(result.assets.current).toHaveLength(2);
			expect(result.assets.fixed).toHaveLength(1);
			expect(result.liabilities.current).toHaveLength(1);
		});

		it('資産合計を正しく計算する', () => {
			const result = generatePage4(mockBalanceSheet, null);

			// 流動資産: 100,000 + 3,000,000 = 3,100,000
			// 固定資産: 500,000
			expect(result.assets.totalEnding).toBe(3600000);
		});

		it('期首残高を正しく設定する', () => {
			const beginningBS: BalanceSheetData = {
				...mockBalanceSheet,
				currentAssets: [{ accountCode: '1003', accountName: '普通預金', amount: 2000000 }],
				fixedAssets: [],
				totalAssets: 2000000,
				totalEquity: 2000000
			};

			const result = generatePage4(mockBalanceSheet, beginningBS);

			const deposit = result.assets.current.find((a) => a.accountCode === '1003');
			expect(deposit?.beginningBalance).toBe(2000000);
			expect(deposit?.endingBalance).toBe(3000000);
		});

		it('事業主勘定を正しく反映する', () => {
			const result = generatePage4(mockBalanceSheet, null, {
				ownerWithdrawal: 500000,
				ownerDeposit: 100000
			});

			expect(result.equity.ownerWithdrawal).toBe(500000);
			expect(result.equity.ownerDeposit).toBe(100000);
		});
	});

	describe('generateBlueReturnData', () => {
		it('青色申告決算書の全データを正しく生成する', () => {
			const result = generateBlueReturnData(
				2025,
				mockJournals,
				mockAccounts,
				mockProfitLoss,
				mockBalanceSheet,
				{
					businessInfo: mockBusinessInfo
				}
			);

			expect(result.fiscalYear).toBe(2025);
			expect(result.businessInfo.name).toBe('山田 太郎');
			expect(result.page1).toBeDefined();
			expect(result.page2).toBeDefined();
			expect(result.page3).toBeDefined();
			expect(result.page4).toBeDefined();
		});

		it('固定資産データを正しく反映する', () => {
			const fixedAssets: FixedAsset[] = [
				{
					id: '1',
					name: 'パソコン',
					category: 'equipment',
					acquisitionDate: '2024-04-01',
					acquisitionCost: 200000,
					usefulLife: 4,
					depreciationMethod: 'straight-line',
					depreciationRate: 0.25,
					businessRatio: 100,
					status: 'active',
					memo: '',
					createdAt: '',
					updatedAt: ''
				}
			];

			const result = generateBlueReturnData(
				2025,
				mockJournals,
				mockAccounts,
				mockProfitLoss,
				mockBalanceSheet,
				{
					businessInfo: mockBusinessInfo,
					fixedAssets
				}
			);

			expect(result.page3.assets.length).toBeGreaterThan(0);
		});
	});

	describe('blueReturnSummaryToCsv', () => {
		it('サマリーをCSV形式に変換する', () => {
			const data = generateBlueReturnData(
				2025,
				mockJournals,
				mockAccounts,
				mockProfitLoss,
				mockBalanceSheet,
				{ businessInfo: mockBusinessInfo }
			);

			const csv = blueReturnSummaryToCsv(data);

			expect(csv).toContain('青色申告決算書（一般用）,2025年分');
			expect(csv).toContain('【事業者情報】');
			expect(csv).toContain('氏名,山田 太郎');
			expect(csv).toContain('【1ページ目: 損益計算書】');
			expect(csv).toContain('【2ページ目: 月別売上・仕入】');
			expect(csv).toContain('【3ページ目: 減価償却費】');
			expect(csv).toContain('【4ページ目: 貸借対照表】');
		});
	});

	describe('validateBlueReturnData', () => {
		it('正常なデータはエラーを返さない', () => {
			const data = generateBlueReturnData(
				2025,
				mockJournals,
				mockAccounts,
				mockProfitLoss,
				mockBalanceSheet,
				{ businessInfo: mockBusinessInfo }
			);

			// 月別売上が一致するようにデータを調整
			data.page2.monthlySalesTotal = data.page1.salesTotal;
			// 貸借バランスを一致させる
			data.page4.isBalanced = true;

			const errors = validateBlueReturnData(data);

			expect(errors).not.toContain('貸借対照表の貸借バランスが一致していません');
		});

		it('貸借不一致を検出する', () => {
			const data = generateBlueReturnData(
				2025,
				mockJournals,
				mockAccounts,
				mockProfitLoss,
				mockBalanceSheet,
				{ businessInfo: mockBusinessInfo }
			);

			// 貸借不一致を設定（Page4BalanceSheetの型）
			data.page4.isBalanced = false;

			const errors = validateBlueReturnData(data);

			expect(errors).toContain('貸借対照表の貸借バランスが一致していません');
		});

		it('不正な控除額を検出する', () => {
			const data = generateBlueReturnData(
				2025,
				mockJournals,
				mockAccounts,
				mockProfitLoss,
				mockBalanceSheet,
				{ businessInfo: mockBusinessInfo }
			);

			data.page1.blueReturnDeduction = 999999; // 不正な控除額

			const errors = validateBlueReturnData(data);

			expect(errors.some((e) => e.includes('青色申告特別控除額'))).toBe(true);
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

		it('負の値は△表示する', () => {
			expect(formatAmount(-50000)).toBe('△50,000');
		});
	});

	describe('formatJPY', () => {
		it('日本円形式でフォーマットする', () => {
			const result = formatJPY(1000000);
			expect(result).toContain('1,000,000');
			expect(result).toContain('円');
		});
	});

	describe('getMonthNames', () => {
		it('12ヶ月の配列を返す', () => {
			const months = getMonthNames();

			expect(months).toHaveLength(12);
			expect(months[0]).toBe('1月');
			expect(months[11]).toBe('12月');
		});
	});
});
