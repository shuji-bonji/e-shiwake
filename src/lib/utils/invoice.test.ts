import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	calculateItemAmount,
	calculateInvoiceAmounts,
	createEmptyInvoice,
	createEmptyInvoiceItem,
	getMonthEndDate,
	getNextMonthEndDate,
	formatDateJapanese,
	formatCurrency,
	validateInvoiceNumber
} from './invoice';
import type { InvoiceItem } from '$lib/types/invoice';

describe('calculateItemAmount', () => {
	it('数量と単価から金額を計算する', () => {
		expect(calculateItemAmount(1, 1000)).toBe(1000);
		expect(calculateItemAmount(3, 500)).toBe(1500);
		expect(calculateItemAmount(10, 100)).toBe(1000);
	});

	it('小数の数量も扱える', () => {
		expect(calculateItemAmount(1.5, 1000)).toBe(1500);
		expect(calculateItemAmount(0.5, 2000)).toBe(1000);
	});

	it('0の場合は0を返す', () => {
		expect(calculateItemAmount(0, 1000)).toBe(0);
		expect(calculateItemAmount(10, 0)).toBe(0);
	});
});

describe('calculateInvoiceAmounts', () => {
	it('10%税率の明細行を集計する', () => {
		const items: InvoiceItem[] = [
			{
				id: '1',
				date: '',
				description: 'Item 1',
				quantity: 1,
				unitPrice: 10000,
				amount: 10000,
				taxRate: 10
			},
			{
				id: '2',
				date: '',
				description: 'Item 2',
				quantity: 1,
				unitPrice: 5000,
				amount: 5000,
				taxRate: 10
			}
		];

		const result = calculateInvoiceAmounts(items);

		expect(result.subtotal).toBe(15000);
		expect(result.taxBreakdown.taxable10).toBe(15000);
		expect(result.taxBreakdown.tax10).toBe(1500);
		expect(result.taxBreakdown.taxable8).toBe(0);
		expect(result.taxBreakdown.tax8).toBe(0);
		expect(result.taxAmount).toBe(1500);
		expect(result.total).toBe(16500);
	});

	it('8%税率の明細行を集計する', () => {
		const items: InvoiceItem[] = [
			{
				id: '1',
				date: '',
				description: 'Item 1',
				quantity: 1,
				unitPrice: 10000,
				amount: 10000,
				taxRate: 8
			},
			{
				id: '2',
				date: '',
				description: 'Item 2',
				quantity: 1,
				unitPrice: 5000,
				amount: 5000,
				taxRate: 8
			}
		];

		const result = calculateInvoiceAmounts(items);

		expect(result.subtotal).toBe(15000);
		expect(result.taxBreakdown.taxable10).toBe(0);
		expect(result.taxBreakdown.tax10).toBe(0);
		expect(result.taxBreakdown.taxable8).toBe(15000);
		expect(result.taxBreakdown.tax8).toBe(1200);
		expect(result.taxAmount).toBe(1200);
		expect(result.total).toBe(16200);
	});

	it('10%と8%の混合明細行を集計する', () => {
		const items: InvoiceItem[] = [
			{
				id: '1',
				date: '',
				description: 'Item 1',
				quantity: 1,
				unitPrice: 10000,
				amount: 10000,
				taxRate: 10
			},
			{
				id: '2',
				date: '',
				description: 'Item 2',
				quantity: 1,
				unitPrice: 5000,
				amount: 5000,
				taxRate: 8
			}
		];

		const result = calculateInvoiceAmounts(items);

		expect(result.subtotal).toBe(15000);
		expect(result.taxBreakdown.taxable10).toBe(10000);
		expect(result.taxBreakdown.tax10).toBe(1000);
		expect(result.taxBreakdown.taxable8).toBe(5000);
		expect(result.taxBreakdown.tax8).toBe(400);
		expect(result.taxAmount).toBe(1400);
		expect(result.total).toBe(16400);
	});

	it('消費税は端数切り捨てする', () => {
		const items: InvoiceItem[] = [
			{
				id: '1',
				date: '',
				description: 'Item 1',
				quantity: 1,
				unitPrice: 999,
				amount: 999,
				taxRate: 10
			},
			{
				id: '2',
				date: '',
				description: 'Item 2',
				quantity: 1,
				unitPrice: 123,
				amount: 123,
				taxRate: 8
			}
		];

		const result = calculateInvoiceAmounts(items);

		// 999 * 0.1 = 99.9 → 99（切り捨て）
		expect(result.taxBreakdown.tax10).toBe(99);
		// 123 * 0.08 = 9.84 → 9（切り捨て）
		expect(result.taxBreakdown.tax8).toBe(9);
		expect(result.taxAmount).toBe(108);
	});

	it('空の明細行配列を処理する', () => {
		const result = calculateInvoiceAmounts([]);

		expect(result.subtotal).toBe(0);
		expect(result.taxAmount).toBe(0);
		expect(result.total).toBe(0);
	});
});

describe('createEmptyInvoice', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('今日の日付を発行日に設定する', () => {
		const invoice = createEmptyInvoice();
		expect(invoice.issueDate).toBe('2026-01-15');
	});

	it('月末を支払期限に設定する', () => {
		const invoice = createEmptyInvoice();
		expect(invoice.dueDate).toBe('2026-01-31');
	});

	it('初期状態はdraftである', () => {
		const invoice = createEmptyInvoice();
		expect(invoice.status).toBe('draft');
	});

	it('金額は全て0で初期化される', () => {
		const invoice = createEmptyInvoice();
		expect(invoice.subtotal).toBe(0);
		expect(invoice.taxAmount).toBe(0);
		expect(invoice.total).toBe(0);
	});

	it('明細行は空配列で初期化される', () => {
		const invoice = createEmptyInvoice();
		expect(invoice.items).toEqual([]);
	});
});

describe('createEmptyInvoiceItem', () => {
	beforeEach(() => {
		vi.stubGlobal('crypto', {
			randomUUID: vi.fn().mockReturnValue('test-uuid')
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('ユニークなIDを生成する', () => {
		const item = createEmptyInvoiceItem();
		expect(item.id).toBe('test-uuid');
	});

	it('デフォルトで数量1、単価0、金額0を設定する', () => {
		const item = createEmptyInvoiceItem();
		expect(item.quantity).toBe(1);
		expect(item.unitPrice).toBe(0);
		expect(item.amount).toBe(0);
	});

	it('デフォルトで税率10%を設定する', () => {
		const item = createEmptyInvoiceItem();
		expect(item.taxRate).toBe(10);
	});

	it('日付と説明は空文字で初期化される', () => {
		const item = createEmptyInvoiceItem();
		expect(item.date).toBe('');
		expect(item.description).toBe('');
	});
});

describe('getMonthEndDate', () => {
	it('1月の月末を返す', () => {
		expect(getMonthEndDate('2026-01-15')).toBe('2026-01-31');
	});

	it('2月の月末を返す（平年）', () => {
		expect(getMonthEndDate('2025-02-10')).toBe('2025-02-28');
	});

	it('2月の月末を返す（閏年）', () => {
		expect(getMonthEndDate('2024-02-10')).toBe('2024-02-29');
	});

	it('4月の月末を返す（30日の月）', () => {
		expect(getMonthEndDate('2026-04-01')).toBe('2026-04-30');
	});

	it('12月の月末を返す', () => {
		expect(getMonthEndDate('2026-12-25')).toBe('2026-12-31');
	});

	it('月末の日付を入力しても正しく処理する', () => {
		expect(getMonthEndDate('2026-01-31')).toBe('2026-01-31');
	});
});

describe('getNextMonthEndDate', () => {
	it('1月から翌月末（2月末）を返す', () => {
		expect(getNextMonthEndDate('2026-01-15')).toBe('2026-02-28');
	});

	it('12月から翌月末（1月末）を返す', () => {
		expect(getNextMonthEndDate('2025-12-15')).toBe('2026-01-31');
	});

	it('1月から翌月末を返す（閏年の2月）', () => {
		expect(getNextMonthEndDate('2024-01-10')).toBe('2024-02-29');
	});

	it('3月から翌月末（4月末）を返す', () => {
		expect(getNextMonthEndDate('2026-03-01')).toBe('2026-04-30');
	});
});

describe('formatDateJapanese', () => {
	it('日付を日本語形式に変換する', () => {
		expect(formatDateJapanese('2026-01-15')).toBe('2026年1月15日');
	});

	it('1桁の月日も正しく変換する', () => {
		expect(formatDateJapanese('2026-01-01')).toBe('2026年1月1日');
		expect(formatDateJapanese('2026-09-05')).toBe('2026年9月5日');
	});

	it('12月31日を変換する', () => {
		expect(formatDateJapanese('2026-12-31')).toBe('2026年12月31日');
	});
});

describe('formatCurrency', () => {
	it('金額をカンマ区切りに変換する', () => {
		expect(formatCurrency(1000)).toBe('1,000');
		expect(formatCurrency(1000000)).toBe('1,000,000');
		expect(formatCurrency(123456789)).toBe('123,456,789');
	});

	it('3桁未満の金額はそのまま返す', () => {
		expect(formatCurrency(0)).toBe('0');
		expect(formatCurrency(100)).toBe('100');
		expect(formatCurrency(999)).toBe('999');
	});

	it('nullの場合は0を返す', () => {
		expect(formatCurrency(null)).toBe('0');
	});

	it('undefinedの場合は0を返す', () => {
		expect(formatCurrency(undefined)).toBe('0');
	});
});

describe('validateInvoiceNumber', () => {
	it('空でない文字列はtrueを返す', () => {
		expect(validateInvoiceNumber('INV-001')).toBe(true);
		expect(validateInvoiceNumber('2026-0001')).toBe(true);
		expect(validateInvoiceNumber('A')).toBe(true);
	});

	it('空文字列はfalseを返す', () => {
		expect(validateInvoiceNumber('')).toBe(false);
	});

	it('空白のみの文字列はfalseを返す', () => {
		expect(validateInvoiceNumber('   ')).toBe(false);
		expect(validateInvoiceNumber('\t')).toBe(false);
		expect(validateInvoiceNumber('\n')).toBe(false);
	});

	it('前後の空白を除いて判定する', () => {
		expect(validateInvoiceNumber('  INV-001  ')).toBe(true);
	});
});
