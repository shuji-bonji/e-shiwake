import { describe, it, expect } from 'vitest';
import { parseSearchQuery, filterJournals, isEmptyQuery } from './journal-search';
import type { JournalEntry, Account } from '$lib/types';

const mockAccounts: Account[] = [
	{ code: '5001', name: '消耗品費', type: 'expense', isSystem: true, createdAt: '' },
	{ code: '5002', name: '通信費', type: 'expense', isSystem: true, createdAt: '' },
	{ code: '4001', name: '売上高', type: 'revenue', isSystem: true, createdAt: '' }
];

describe('parseSearchQuery', () => {
	it('テキストを摘要・取引先として解析する', () => {
		const result = parseSearchQuery('Amazon', mockAccounts);
		expect(result.text).toEqual(['amazon']);
	});

	it('勘定科目名を認識する', () => {
		const result = parseSearchQuery('消耗品費', mockAccounts);
		expect(result.accounts).toEqual(['5001']);
	});

	it('勘定科目名の前方一致で認識する', () => {
		const result = parseSearchQuery('消耗品', mockAccounts);
		expect(result.accounts).toEqual(['5001']);
	});

	it('数字を金額として認識する', () => {
		const result = parseSearchQuery('10000', mockAccounts);
		expect(result.amounts).toEqual([10000]);
	});

	it('カンマ付き金額を認識する', () => {
		const result = parseSearchQuery('10,000', mockAccounts);
		expect(result.amounts).toEqual([10000]);
	});

	it('YYYY-MM を年月として認識する', () => {
		const result = parseSearchQuery('2025-01', mockAccounts);
		expect(result.yearMonth).toBe('2025-01');
	});

	it('○月 を月として認識する', () => {
		const result = parseSearchQuery('12月', mockAccounts);
		expect(result.month).toBe(12);
	});

	it('1月 を月として認識する', () => {
		const result = parseSearchQuery('1月', mockAccounts);
		expect(result.month).toBe(1);
	});

	it('YYYY-MM-DD を日付として認識する', () => {
		const result = parseSearchQuery('2025-01-15', mockAccounts);
		expect(result.date).toBe('2025-01-15');
	});

	it('YYYY/MM/DD を日付として認識する', () => {
		const result = parseSearchQuery('2025/1/15', mockAccounts);
		expect(result.date).toBe('2025-01-15');
	});

	it('MM/DD を月日として認識する', () => {
		const result = parseSearchQuery('1/15', mockAccounts);
		expect(result.monthDay).toBe('01-15');
	});

	it('複数条件を正しく解析する', () => {
		const result = parseSearchQuery('Amazon 12月 消耗品費 10000', mockAccounts);
		expect(result.text).toEqual(['amazon']);
		expect(result.month).toBe(12);
		expect(result.accounts).toEqual(['5001']);
		expect(result.amounts).toEqual([10000]);
	});

	it('空のクエリは空の条件を返す', () => {
		const result = parseSearchQuery('', mockAccounts);
		expect(result.text).toEqual([]);
		expect(result.accounts).toEqual([]);
		expect(result.amounts).toEqual([]);
	});

	it('スペースのみのクエリは空の条件を返す', () => {
		const result = parseSearchQuery('   ', mockAccounts);
		expect(result.text).toEqual([]);
		expect(result.accounts).toEqual([]);
		expect(result.amounts).toEqual([]);
	});
});

describe('filterJournals', () => {
	const mockJournals: JournalEntry[] = [
		{
			id: '1',
			date: '2025-01-15',
			lines: [
				{ id: 'l1', type: 'debit', accountCode: '5001', amount: 10000 },
				{ id: 'l2', type: 'credit', accountCode: '1001', amount: 10000 }
			],
			description: 'USBケーブル購入',
			vendor: 'Amazon',
			evidenceStatus: 'digital',
			attachments: [],
			createdAt: '',
			updatedAt: ''
		},
		{
			id: '2',
			date: '2025-01-20',
			lines: [
				{ id: 'l3', type: 'debit', accountCode: '5002', amount: 5000 },
				{ id: 'l4', type: 'credit', accountCode: '1001', amount: 5000 }
			],
			description: '携帯代',
			vendor: 'NTT',
			evidenceStatus: 'digital',
			attachments: [],
			createdAt: '',
			updatedAt: ''
		},
		{
			id: '3',
			date: '2025-02-10',
			lines: [
				{ id: 'l5', type: 'debit', accountCode: '5001', amount: 3000 },
				{ id: 'l6', type: 'credit', accountCode: '1001', amount: 3000 }
			],
			description: 'マウス購入',
			vendor: 'Amazon',
			evidenceStatus: 'none',
			attachments: [],
			createdAt: '',
			updatedAt: ''
		}
	];

	it('取引先で絞り込める', () => {
		const criteria = { text: ['amazon'], accounts: [], amounts: [] };
		const result = filterJournals(mockJournals, criteria);
		expect(result).toHaveLength(2);
		expect(result.map((j) => j.id)).toEqual(['1', '3']);
	});

	it('摘要で絞り込める', () => {
		const criteria = { text: ['購入'], accounts: [], amounts: [] };
		const result = filterJournals(mockJournals, criteria);
		expect(result).toHaveLength(2);
		expect(result.map((j) => j.id)).toEqual(['1', '3']);
	});

	it('勘定科目で絞り込める', () => {
		const criteria = { text: [], accounts: ['5002'], amounts: [] };
		const result = filterJournals(mockJournals, criteria);
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('2');
	});

	it('金額で絞り込める', () => {
		const criteria = { text: [], accounts: [], amounts: [10000] };
		const result = filterJournals(mockJournals, criteria);
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('1');
	});

	it('年月で絞り込める', () => {
		const criteria = { text: [], accounts: [], amounts: [], yearMonth: '2025-01' };
		const result = filterJournals(mockJournals, criteria);
		expect(result).toHaveLength(2);
		expect(result.map((j) => j.id)).toEqual(['1', '2']);
	});

	it('月のみで絞り込める', () => {
		const criteria = { text: [], accounts: [], amounts: [], month: 2 };
		const result = filterJournals(mockJournals, criteria);
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('3');
	});

	it('日付で絞り込める', () => {
		const criteria = { text: [], accounts: [], amounts: [], date: '2025-01-15' };
		const result = filterJournals(mockJournals, criteria);
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('1');
	});

	it('月日で絞り込める', () => {
		const criteria = { text: [], accounts: [], amounts: [], monthDay: '01-15' };
		const result = filterJournals(mockJournals, criteria);
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('1');
	});

	it('複数条件で AND 検索できる', () => {
		const criteria = { text: ['amazon'], accounts: ['5001'], amounts: [] };
		const result = filterJournals(mockJournals, criteria);
		expect(result).toHaveLength(2);
		expect(result.map((j) => j.id)).toEqual(['1', '3']);
	});

	it('複数テキスト条件はすべて一致が必要', () => {
		const criteria = { text: ['amazon', 'マウス'], accounts: [], amounts: [] };
		const result = filterJournals(mockJournals, criteria);
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('3');
	});

	it('空の条件では全件を返す', () => {
		const criteria = { text: [], accounts: [], amounts: [] };
		const result = filterJournals(mockJournals, criteria);
		expect(result).toHaveLength(3);
	});
});

describe('isEmptyQuery', () => {
	it('空文字はtrueを返す', () => {
		expect(isEmptyQuery('')).toBe(true);
	});

	it('スペースのみはtrueを返す', () => {
		expect(isEmptyQuery('   ')).toBe(true);
	});

	it('テキストがあるとfalseを返す', () => {
		expect(isEmptyQuery('amazon')).toBe(false);
	});
});
