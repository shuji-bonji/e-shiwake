import { describe, it, expect } from 'vitest';
import { generateBalanceSheet, formatBSAmount, balanceSheetToCsv } from './balance-sheet';
import type { JournalEntry, Account } from '$lib/types';

const mockAccounts: Account[] = [
	// 流動資産
	{ code: '1001', name: '現金', type: 'asset', isSystem: true, createdAt: '' },
	{ code: '1003', name: '普通預金', type: 'asset', isSystem: true, createdAt: '' },
	{ code: '1005', name: '売掛金', type: 'asset', isSystem: true, createdAt: '' },
	// 固定資産
	{ code: '1017', name: '車両運搬具', type: 'asset', isSystem: true, createdAt: '' },
	{ code: '1018', name: '工具器具備品', type: 'asset', isSystem: true, createdAt: '' },
	// 流動負債
	{ code: '2001', name: '買掛金', type: 'liability', isSystem: true, createdAt: '' },
	{ code: '2002', name: '短期借入金', type: 'liability', isSystem: true, createdAt: '' },
	// 固定負債
	{ code: '2003', name: '長期借入金', type: 'liability', isSystem: true, createdAt: '' },
	// 純資産
	{ code: '3001', name: '元入金', type: 'equity', isSystem: true, createdAt: '' },
	// 収益・費用（貸借対照表では無視される）
	{ code: '4001', name: '売上高', type: 'revenue', isSystem: true, createdAt: '' },
	{ code: '5001', name: '仕入高', type: 'expense', isSystem: true, createdAt: '' }
];

const mockJournals: JournalEntry[] = [
	{
		id: '1',
		date: '2025-01-10',
		lines: [
			{ id: 'l1', type: 'debit', accountCode: '1003', amount: 100000 }, // 普通預金増加
			{ id: 'l2', type: 'credit', accountCode: '3001', amount: 100000 } // 元入金増加
		],
		description: '元入れ',
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
			{ id: 'l3', type: 'debit', accountCode: '1001', amount: 50000 }, // 現金増加
			{ id: 'l4', type: 'credit', accountCode: '1003', amount: 50000 } // 普通預金減少
		],
		description: '現金引き出し',
		vendor: '',
		evidenceStatus: 'none',
		attachments: [],
		createdAt: '',
		updatedAt: ''
	},
	{
		id: '3',
		date: '2025-01-20',
		lines: [
			{ id: 'l5', type: 'debit', accountCode: '1018', amount: 200000 }, // 工具器具備品増加
			{ id: 'l6', type: 'credit', accountCode: '2003', amount: 200000 } // 長期借入金増加
		],
		description: '備品購入（ローン）',
		vendor: '',
		evidenceStatus: 'none',
		attachments: [],
		createdAt: '',
		updatedAt: ''
	}
];

describe('balance-sheet', () => {
	describe('generateBalanceSheet', () => {
		it('貸借対照表を正しく生成する', () => {
			const bs = generateBalanceSheet(mockJournals, mockAccounts, 2025);

			expect(bs.fiscalYear).toBe(2025);
			expect(bs.currentAssets.length).toBeGreaterThan(0);
			expect(bs.fixedAssets.length).toBeGreaterThan(0);
		});

		it('流動資産を正しく集計する', () => {
			const bs = generateBalanceSheet(mockJournals, mockAccounts, 2025);

			const cash = bs.currentAssets.find((r) => r.accountCode === '1001');
			const bank = bs.currentAssets.find((r) => r.accountCode === '1003');

			expect(cash?.amount).toBe(50000); // 引き出した分
			expect(bank?.amount).toBe(50000); // 100,000 - 50,000
		});

		it('固定資産を正しく集計する', () => {
			const bs = generateBalanceSheet(mockJournals, mockAccounts, 2025);

			const equipment = bs.fixedAssets.find((r) => r.accountCode === '1018');
			expect(equipment?.amount).toBe(200000);
		});

		it('流動負債を正しく集計する', () => {
			const journalsWithPayables: JournalEntry[] = [
				{
					id: '1',
					date: '2025-01-10',
					lines: [
						{ id: 'l1', type: 'debit', accountCode: '5001', amount: 30000 },
						{ id: 'l2', type: 'credit', accountCode: '2001', amount: 30000 }
					],
					description: '仕入（買掛）',
					vendor: '',
					evidenceStatus: 'none',
					attachments: [],
					createdAt: '',
					updatedAt: ''
				}
			];

			const bs = generateBalanceSheet(journalsWithPayables, mockAccounts, 2025);

			const payables = bs.currentLiabilities.find((r) => r.accountCode === '2001');
			expect(payables?.amount).toBe(30000);
		});

		it('固定負債を正しく集計する', () => {
			const bs = generateBalanceSheet(mockJournals, mockAccounts, 2025);

			const longTermDebt = bs.fixedLiabilities.find((r) => r.accountCode === '2003');
			expect(longTermDebt?.amount).toBe(200000);
		});

		it('純資産を正しく集計する', () => {
			const bs = generateBalanceSheet(mockJournals, mockAccounts, 2025);

			const capital = bs.equity.find((r) => r.accountCode === '3001');
			expect(capital?.amount).toBe(100000);
		});

		it('当期純利益を繰越利益として加算する', () => {
			const bs = generateBalanceSheet(mockJournals, mockAccounts, 2025, 50000);

			expect(bs.retainedEarnings).toBe(50000);
			expect(bs.totalEquity).toBe(150000); // 元入金100,000 + 当期純利益50,000
		});

		it('資産合計を正しく計算する', () => {
			const bs = generateBalanceSheet(mockJournals, mockAccounts, 2025);

			// 流動資産: 現金50,000 + 普通預金50,000 = 100,000
			// 固定資産: 工具器具備品200,000
			// 合計: 300,000
			expect(bs.totalAssets).toBe(300000);
		});

		it('負債・純資産合計を正しく計算する', () => {
			const bs = generateBalanceSheet(mockJournals, mockAccounts, 2025);

			// 負債: 長期借入金200,000
			// 純資産: 元入金100,000
			// 合計: 300,000
			expect(bs.totalLiabilitiesAndEquity).toBe(300000);
		});

		it('貸借が一致する', () => {
			const bs = generateBalanceSheet(mockJournals, mockAccounts, 2025);

			expect(bs.totalAssets).toBe(bs.totalLiabilitiesAndEquity);
		});

		it('仕訳がない場合は0の貸借対照表を返す', () => {
			const bs = generateBalanceSheet([], mockAccounts, 2025);

			expect(bs.currentAssets).toHaveLength(0);
			expect(bs.fixedAssets).toHaveLength(0);
			expect(bs.currentLiabilities).toHaveLength(0);
			expect(bs.fixedLiabilities).toHaveLength(0);
			expect(bs.equity).toHaveLength(0);
			expect(bs.totalAssets).toBe(0);
			expect(bs.totalLiabilities).toBe(0);
			expect(bs.totalEquity).toBe(0);
		});

		it('残高が0の科目は表示しない', () => {
			const journals: JournalEntry[] = [
				{
					id: '1',
					date: '2025-01-10',
					lines: [
						{ id: 'l1', type: 'debit', accountCode: '1001', amount: 10000 },
						{ id: 'l2', type: 'credit', accountCode: '3001', amount: 10000 }
					],
					description: '元入れ',
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
						{ id: 'l3', type: 'debit', accountCode: '3001', amount: 10000 },
						{ id: 'l4', type: 'credit', accountCode: '1001', amount: 10000 }
					],
					description: '出金',
					vendor: '',
					evidenceStatus: 'none',
					attachments: [],
					createdAt: '',
					updatedAt: ''
				}
			];

			const bs = generateBalanceSheet(journals, mockAccounts, 2025);

			// 現金と元入金の残高が0になるので表示されない
			expect(bs.currentAssets.find((r) => r.accountCode === '1001')).toBeUndefined();
			expect(bs.equity.find((r) => r.accountCode === '3001')).toBeUndefined();
		});

		it('収益・費用は貸借対照表に含まない', () => {
			const journals: JournalEntry[] = [
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
				}
			];

			const bs = generateBalanceSheet(journals, mockAccounts, 2025);

			// 売上高（収益）は貸借対照表に含まれない
			const allItems = [
				...bs.currentAssets,
				...bs.fixedAssets,
				...bs.currentLiabilities,
				...bs.fixedLiabilities,
				...bs.equity
			];
			expect(allItems.find((r) => r.accountCode === '4001')).toBeUndefined();
		});

		it('科目コード順にソートされる', () => {
			const journals: JournalEntry[] = [
				{
					id: '1',
					date: '2025-01-10',
					lines: [
						{ id: 'l1', type: 'debit', accountCode: '1005', amount: 50000 },
						{ id: 'l2', type: 'credit', accountCode: '4001', amount: 50000 }
					],
					description: '売上（売掛）',
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
						{ id: 'l3', type: 'debit', accountCode: '1001', amount: 30000 },
						{ id: 'l4', type: 'credit', accountCode: '3001', amount: 30000 }
					],
					description: '元入れ',
					vendor: '',
					evidenceStatus: 'none',
					attachments: [],
					createdAt: '',
					updatedAt: ''
				}
			];

			const bs = generateBalanceSheet(journals, mockAccounts, 2025);

			// 1001（現金）が1005（売掛金）より先に来る
			expect(bs.currentAssets[0].accountCode).toBe('1001');
			expect(bs.currentAssets[1].accountCode).toBe('1005');
		});
	});

	describe('formatBSAmount', () => {
		it('金額をカンマ区切りでフォーマットする', () => {
			expect(formatBSAmount(1000000)).toBe('1,000,000');
			expect(formatBSAmount(12345)).toBe('12,345');
		});

		it('0は"0"を返す', () => {
			expect(formatBSAmount(0)).toBe('0');
		});

		it('負の値は△表示する', () => {
			expect(formatBSAmount(-50000)).toBe('△50,000');
			expect(formatBSAmount(-1234567)).toBe('△1,234,567');
		});
	});

	describe('balanceSheetToCsv', () => {
		it('CSV形式に変換される', () => {
			const bs = generateBalanceSheet(mockJournals, mockAccounts, 2025);
			const csv = balanceSheetToCsv(bs);

			expect(csv).toContain('貸借対照表,2025年度');
			expect(csv).toContain('【資産の部】');
			expect(csv).toContain('＜流動資産＞');
			expect(csv).toContain('＜固定資産＞');
			expect(csv).toContain('【負債の部】');
			expect(csv).toContain('＜流動負債＞');
			expect(csv).toContain('＜固定負債＞');
			expect(csv).toContain('【純資産の部】');
		});

		it('金額が正しく含まれる', () => {
			const bs = generateBalanceSheet(mockJournals, mockAccounts, 2025);
			const csv = balanceSheetToCsv(bs);

			expect(csv).toContain('1001,現金,50000');
			expect(csv).toContain('1003,普通預金,50000');
			expect(csv).toContain('1018,工具器具備品,200000');
			expect(csv).toContain('2003,長期借入金,200000');
			expect(csv).toContain('3001,元入金,100000');
		});

		it('合計行が含まれる', () => {
			const bs = generateBalanceSheet(mockJournals, mockAccounts, 2025);
			const csv = balanceSheetToCsv(bs);

			expect(csv).toContain(',流動資産 合計,100000');
			expect(csv).toContain(',固定資産 合計,200000');
			expect(csv).toContain(',資産合計,300000');
			expect(csv).toContain(',負債合計,200000');
			expect(csv).toContain(',純資産合計,100000');
			expect(csv).toContain(',負債・純資産合計,300000');
		});

		it('繰越利益がある場合に含まれる', () => {
			const bs = generateBalanceSheet(mockJournals, mockAccounts, 2025, 75000);
			const csv = balanceSheetToCsv(bs);

			expect(csv).toContain(',繰越利益（当期純利益）,75000');
		});

		it('繰越利益が0の場合は含まれない', () => {
			const bs = generateBalanceSheet(mockJournals, mockAccounts, 2025, 0);
			const csv = balanceSheetToCsv(bs);

			expect(csv).not.toContain('繰越利益');
		});
	});
});
