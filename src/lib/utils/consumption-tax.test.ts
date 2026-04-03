import { describe, it, expect } from 'vitest';
import {
	generateConsumptionTax,
	formatTaxAmount,
	consumptionTaxToCsv,
	isExemptBusiness,
	canUseSimplifiedTax
} from './consumption-tax';
import type { JournalEntry } from '$lib/types';

const mockJournals: JournalEntry[] = [
	{
		id: '1',
		date: '2025-01-10',
		lines: [
			{ id: 'l1', type: 'debit', accountCode: '1003', amount: 110000, taxCategory: 'na' },
			{ id: 'l2', type: 'credit', accountCode: '4001', amount: 110000, taxCategory: 'sales_10' }
		],
		description: '売上（税込110,000円）',
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
			{
				id: 'l3',
				type: 'debit',
				accountCode: '5001',
				amount: 10800,
				taxCategory: 'purchase_8'
			},
			{ id: 'l4', type: 'credit', accountCode: '1003', amount: 10800, taxCategory: 'na' }
		],
		description: '食品仕入（軽減税率8%）',
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
			{
				id: 'l5',
				type: 'debit',
				accountCode: '5002',
				amount: 33000,
				taxCategory: 'purchase_10'
			},
			{ id: 'l6', type: 'credit', accountCode: '1003', amount: 33000, taxCategory: 'na' }
		],
		description: '消耗品費（税込33,000円）',
		vendor: 'Amazon',
		evidenceStatus: 'none',
		attachments: [],
		createdAt: '',
		updatedAt: ''
	}
];

describe('consumption-tax', () => {
	describe('generateConsumptionTax', () => {
		it('消費税集計データを正しく生成する', () => {
			const data = generateConsumptionTax(mockJournals, 2025);

			expect(data.fiscalYear).toBe(2025);
			expect(data.salesRows.length).toBeGreaterThan(0);
			expect(data.purchaseRows.length).toBeGreaterThan(0);
		});

		it('課税売上10%を正しく集計する', () => {
			const data = generateConsumptionTax(mockJournals, 2025);

			const sales10 = data.salesRows.find((r) => r.taxCategory === 'sales_10');
			expect(sales10).toBeDefined();
			// 110,000 税込 → 110000 * 100 / 110 = 100,000 税抜、10,000 税額
			expect(sales10?.taxableAmount).toBe(100000);
			expect(sales10?.taxAmount).toBe(10000);
		});

		it('課税仕入8%（軽減税率）を正しく集計する', () => {
			const data = generateConsumptionTax(mockJournals, 2025);

			const purchase8 = data.purchaseRows.find((r) => r.taxCategory === 'purchase_8');
			expect(purchase8).toBeDefined();
			// 10,800 税込 → 10,000 税抜、800 税額
			expect(purchase8?.taxableAmount).toBe(10000);
			expect(purchase8?.taxAmount).toBe(800);
		});

		it('課税仕入10%を正しく集計する', () => {
			const data = generateConsumptionTax(mockJournals, 2025);

			const purchase10 = data.purchaseRows.find((r) => r.taxCategory === 'purchase_10');
			expect(purchase10).toBeDefined();
			// 33,000 税込 → 33000 * 100 / 110 = 30,000 税抜、3,000 税額
			expect(purchase10?.taxableAmount).toBe(30000);
			expect(purchase10?.taxAmount).toBe(3000);
		});

		it('課税売上合計を正しく計算する', () => {
			const data = generateConsumptionTax(mockJournals, 2025);

			expect(data.totalTaxableSales).toBe(100000);
			expect(data.totalSalesTax).toBe(10000);
		});

		it('課税仕入合計を正しく計算する', () => {
			const data = generateConsumptionTax(mockJournals, 2025);

			// 10,000 (8%) + 30,000 (10%) = 40,000
			expect(data.totalTaxablePurchases).toBe(40000);
			// 800 + 3,000 = 3,800
			expect(data.totalPurchaseTax).toBe(3800);
		});

		it('納付税額を正しく計算する', () => {
			const data = generateConsumptionTax(mockJournals, 2025);

			// 売上税額 10,000 - 仕入税額 3,800 = 6,200
			expect(data.netTaxPayable).toBe(6200);
		});

		it('仕訳がない場合は0を返す', () => {
			const data = generateConsumptionTax([], 2025);

			expect(data.salesRows).toHaveLength(0);
			expect(data.purchaseRows).toHaveLength(0);
			expect(data.totalTaxableSales).toBe(0);
			expect(data.totalSalesTax).toBe(0);
			expect(data.totalTaxablePurchases).toBe(0);
			expect(data.totalPurchaseTax).toBe(0);
			expect(data.netTaxPayable).toBe(0);
		});

		it('非課税・不課税を正しく集計する', () => {
			const journals: JournalEntry[] = [
				{
					id: '1',
					date: '2025-01-10',
					lines: [
						{ id: 'l1', type: 'debit', accountCode: '1003', amount: 50000, taxCategory: 'na' },
						{
							id: 'l2',
							type: 'credit',
							accountCode: '4001',
							amount: 50000,
							taxCategory: 'exempt'
						}
					],
					description: '非課税売上',
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
						{
							id: 'l3',
							type: 'debit',
							accountCode: '5001',
							amount: 20000,
							taxCategory: 'out_of_scope'
						},
						{ id: 'l4', type: 'credit', accountCode: '1003', amount: 20000, taxCategory: 'na' }
					],
					description: '不課税仕入',
					vendor: '',
					evidenceStatus: 'none',
					attachments: [],
					createdAt: '',
					updatedAt: ''
				}
			];

			const data = generateConsumptionTax(journals, 2025);

			expect(data.exemptSales).toBe(50000);
			expect(data.outOfScopePurchases).toBe(20000);
		});
	});

	describe('formatTaxAmount', () => {
		it('金額をカンマ区切りでフォーマットする', () => {
			expect(formatTaxAmount(1000000)).toBe('1,000,000');
			expect(formatTaxAmount(12345)).toBe('12,345');
		});

		it('0は"0"を返す', () => {
			expect(formatTaxAmount(0)).toBe('0');
		});

		it('負の値は△表示する', () => {
			expect(formatTaxAmount(-50000)).toBe('△50,000');
			expect(formatTaxAmount(-1234567)).toBe('△1,234,567');
		});
	});

	describe('consumptionTaxToCsv', () => {
		it('CSV形式に変換される', () => {
			const data = generateConsumptionTax(mockJournals, 2025);
			const csv = consumptionTaxToCsv(data);

			expect(csv).toContain('消費税集計表,2025年度');
			expect(csv).toContain('【課税売上】');
			expect(csv).toContain('【課税仕入】');
			expect(csv).toContain('【納付税額】');
			expect(csv).toContain('【参考：非課税・不課税】');
		});

		it('ヘッダー行が含まれる', () => {
			const data = generateConsumptionTax(mockJournals, 2025);
			const csv = consumptionTaxToCsv(data);

			expect(csv).toContain('区分,税抜金額,消費税額');
		});

		it('合計行が含まれる', () => {
			const data = generateConsumptionTax(mockJournals, 2025);
			const csv = consumptionTaxToCsv(data);

			expect(csv).toContain('課税売上 合計,100000,10000');
			expect(csv).toContain('課税仕入 合計,40000,3800');
		});

		it('納付税額が含まれる', () => {
			const data = generateConsumptionTax(mockJournals, 2025);
			const csv = consumptionTaxToCsv(data);

			expect(csv).toContain('売上に係る消費税額,,10000');
			expect(csv).toContain('仕入に係る消費税額,,3800');
			expect(csv).toContain('納付すべき消費税額,,6200');
		});
	});

	describe('isExemptBusiness', () => {
		it('課税売上が1000万円以下なら免税事業者', () => {
			expect(isExemptBusiness(10000000)).toBe(true);
			expect(isExemptBusiness(5000000)).toBe(true);
			expect(isExemptBusiness(0)).toBe(true);
		});

		it('課税売上が1000万円超なら課税事業者', () => {
			expect(isExemptBusiness(10000001)).toBe(false);
			expect(isExemptBusiness(50000000)).toBe(false);
		});
	});

	describe('canUseSimplifiedTax', () => {
		it('課税売上が5000万円以下なら簡易課税適用可能', () => {
			expect(canUseSimplifiedTax(50000000)).toBe(true);
			expect(canUseSimplifiedTax(30000000)).toBe(true);
			expect(canUseSimplifiedTax(10000000)).toBe(true);
		});

		it('課税売上が5000万円超なら簡易課税適用不可', () => {
			expect(canUseSimplifiedTax(50000001)).toBe(false);
			expect(canUseSimplifiedTax(100000000)).toBe(false);
		});
	});
});
