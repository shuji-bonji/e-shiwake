import { describe, it, expect } from 'vitest';
import { generateTrialBalance, groupTrialBalance, formatAmount } from './trial-balance';
import type { JournalEntry, Account } from '$lib/types';

const mockAccounts: Account[] = [
	{ code: '1003', name: '普通預金', type: 'asset', isSystem: true, createdAt: '' },
	{ code: '4001', name: '売上高', type: 'revenue', isSystem: true, createdAt: '' },
	{ code: '5017', name: '地代家賃', type: 'expense', isSystem: true, createdAt: '' }
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
			{ id: 'l3', type: 'debit', accountCode: '5017', amount: 30000 },
			{ id: 'l4', type: 'credit', accountCode: '1003', amount: 30000 }
		],
		description: '家賃支払',
		vendor: '○○不動産',
		evidenceStatus: 'none',
		attachments: [],
		createdAt: '',
		updatedAt: ''
	}
];

describe('trial-balance', () => {
	describe('generateTrialBalance', () => {
		it('試算表を正しく生成する', () => {
			const tb = generateTrialBalance(mockJournals, mockAccounts);

			expect(tb.rows).toHaveLength(3);
			expect(tb.totalDebit).toBe(130000);
			expect(tb.totalCredit).toBe(130000);
			expect(tb.isBalanced).toBe(true);

			// 普通預金: 借方100,000 - 貸方30,000 = 借方残高70,000
			const deposit = tb.rows.find((r) => r.accountCode === '1003');
			expect(deposit?.debitTotal).toBe(100000);
			expect(deposit?.creditTotal).toBe(30000);
			expect(deposit?.debitBalance).toBe(70000);
			expect(deposit?.creditBalance).toBe(0);

			// 売上高: 貸方100,000 = 貸方残高100,000
			const sales = tb.rows.find((r) => r.accountCode === '4001');
			expect(sales?.debitTotal).toBe(0);
			expect(sales?.creditTotal).toBe(100000);
			expect(sales?.debitBalance).toBe(0);
			expect(sales?.creditBalance).toBe(100000);

			// 地代家賃: 借方30,000 = 借方残高30,000
			const rent = tb.rows.find((r) => r.accountCode === '5017');
			expect(rent?.debitTotal).toBe(30000);
			expect(rent?.creditTotal).toBe(0);
			expect(rent?.debitBalance).toBe(30000);
			expect(rent?.creditBalance).toBe(0);
		});

		it('貸借不一致を検出する', () => {
			// 貸借が一致しない不正な仕訳
			const unbalancedJournals: JournalEntry[] = [
				{
					id: '1',
					date: '2025-01-10',
					lines: [
						{ id: 'l1', type: 'debit', accountCode: '1003', amount: 100000 },
						{ id: 'l2', type: 'credit', accountCode: '4001', amount: 90000 }
					],
					description: '不正な仕訳',
					vendor: '',
					evidenceStatus: 'none',
					attachments: [],
					createdAt: '',
					updatedAt: ''
				}
			];

			const tb = generateTrialBalance(unbalancedJournals, mockAccounts);
			expect(tb.isBalanced).toBe(false);
			expect(tb.totalDebit).toBe(100000);
			expect(tb.totalCredit).toBe(90000);
		});

		it('仕訳がない場合は空の試算表を返す', () => {
			const tb = generateTrialBalance([], mockAccounts);
			expect(tb.rows).toHaveLength(0);
			expect(tb.totalDebit).toBe(0);
			expect(tb.totalCredit).toBe(0);
			expect(tb.isBalanced).toBe(true);
		});

		it('科目コード順にソートされる', () => {
			const tb = generateTrialBalance(mockJournals, mockAccounts);
			expect(tb.rows[0].accountCode).toBe('1003');
			expect(tb.rows[1].accountCode).toBe('4001');
			expect(tb.rows[2].accountCode).toBe('5017');
		});

		it('資産が貸方超過の場合は貸方残高になる', () => {
			// 普通預金から出金だけの仕訳
			const creditOnlyJournals: JournalEntry[] = [
				{
					id: '1',
					date: '2025-01-10',
					lines: [
						{ id: 'l1', type: 'debit', accountCode: '5017', amount: 100000 },
						{ id: 'l2', type: 'credit', accountCode: '1003', amount: 100000 }
					],
					description: '家賃支払',
					vendor: '',
					evidenceStatus: 'none',
					attachments: [],
					createdAt: '',
					updatedAt: ''
				}
			];

			const tb = generateTrialBalance(creditOnlyJournals, mockAccounts);
			const deposit = tb.rows.find((r) => r.accountCode === '1003');
			// 資産が貸方超過 → 貸方残高
			expect(deposit?.debitBalance).toBe(0);
			expect(deposit?.creditBalance).toBe(100000);
		});
	});

	describe('groupTrialBalance', () => {
		it('科目タイプ別にグループ化する', () => {
			const tb = generateTrialBalance(mockJournals, mockAccounts);
			const grouped = groupTrialBalance(tb);

			expect(grouped.groups).toHaveLength(3); // 資産、収益、費用
			expect(grouped.groups[0].type).toBe('asset');
			expect(grouped.groups[0].label).toBe('資産');
			expect(grouped.groups[1].type).toBe('revenue');
			expect(grouped.groups[1].label).toBe('収益');
			expect(grouped.groups[2].type).toBe('expense');
			expect(grouped.groups[2].label).toBe('費用');
		});

		it('グループの小計が正しく計算される', () => {
			const tb = generateTrialBalance(mockJournals, mockAccounts);
			const grouped = groupTrialBalance(tb);

			// 資産グループ
			const assetGroup = grouped.groups.find((g) => g.type === 'asset');
			expect(assetGroup?.subtotalDebit).toBe(100000);
			expect(assetGroup?.subtotalCredit).toBe(30000);
			expect(assetGroup?.subtotalDebitBalance).toBe(70000);

			// 収益グループ
			const revenueGroup = grouped.groups.find((g) => g.type === 'revenue');
			expect(revenueGroup?.subtotalCredit).toBe(100000);
			expect(revenueGroup?.subtotalCreditBalance).toBe(100000);

			// 費用グループ
			const expenseGroup = grouped.groups.find((g) => g.type === 'expense');
			expect(expenseGroup?.subtotalDebit).toBe(30000);
			expect(expenseGroup?.subtotalDebitBalance).toBe(30000);
		});

		it('合計が正しく引き継がれる', () => {
			const tb = generateTrialBalance(mockJournals, mockAccounts);
			const grouped = groupTrialBalance(tb);

			expect(grouped.totalDebit).toBe(130000);
			expect(grouped.totalCredit).toBe(130000);
			expect(grouped.isBalanced).toBe(true);
		});

		it('空のグループは含まれない', () => {
			const tb = generateTrialBalance(mockJournals, mockAccounts);
			const grouped = groupTrialBalance(tb);

			// liability と equity は使われていないので含まれない
			expect(grouped.groups.find((g) => g.type === 'liability')).toBeUndefined();
			expect(grouped.groups.find((g) => g.type === 'equity')).toBeUndefined();
		});
	});

	describe('formatAmount', () => {
		it('金額をカンマ区切りでフォーマットする', () => {
			expect(formatAmount(1000000)).toBe('1,000,000');
			expect(formatAmount(12345)).toBe('12,345');
		});

		it('0は空文字を返す', () => {
			expect(formatAmount(0)).toBe('');
		});

		it('nullは空文字を返す', () => {
			expect(formatAmount(null)).toBe('');
		});
	});
});
