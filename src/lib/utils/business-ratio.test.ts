import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	applyBusinessRatio,
	removeBusinessRatio,
	hasBusinessRatioApplied,
	getAppliedBusinessRatio,
	calculateBusinessRatioPreview,
	getBusinessRatioTargetLine,
	cleanJournalLineForExport
} from './business-ratio';
import type { JournalLine, Account } from '$lib/types';

describe('business-ratio', () => {
	beforeEach(() => {
		vi.stubGlobal('crypto', {
			randomUUID: vi.fn().mockReturnValue('generated-uuid')
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe('applyBusinessRatio', () => {
		it('按分を正しく適用する', () => {
			const lines: JournalLine[] = [
				{ id: '1', type: 'debit', accountCode: '5017', amount: 100000 },
				{ id: '2', type: 'credit', accountCode: '1003', amount: 100000 }
			];

			const result = applyBusinessRatio({
				lines,
				targetLineIndex: 0,
				businessRatio: 30
			});

			expect(result.lines).toHaveLength(3);
			expect(result.businessAmount).toBe(30000);
			expect(result.personalAmount).toBe(70000);

			// 事業分
			expect(result.lines[0].amount).toBe(30000);
			expect(result.lines[0]._businessRatioApplied).toBe(true);
			expect(result.lines[0]._originalAmount).toBe(100000);
			expect(result.lines[0]._businessRatio).toBe(30);

			// 個人分（事業主貸）
			expect(result.lines[1].accountCode).toBe('3002');
			expect(result.lines[1].amount).toBe(70000);
			expect(result.lines[1]._businessRatioGenerated).toBe(true);
			expect(result.lines[1].taxCategory).toBe('na');

			// 貸方（変更なし）
			expect(result.lines[2].amount).toBe(100000);
		});

		it('100%按分でも事業主貸が0円で生成される（自動再計算用）', () => {
			const lines: JournalLine[] = [
				{ id: '1', type: 'debit', accountCode: '5017', amount: 100000 },
				{ id: '2', type: 'credit', accountCode: '1003', amount: 100000 }
			];

			const result = applyBusinessRatio({
				lines,
				targetLineIndex: 0,
				businessRatio: 100
			});

			// 事業主貸は0円でも生成される（後から金額変更で自動計算するため）
			expect(result.lines).toHaveLength(3);
			expect(result.businessAmount).toBe(100000);
			expect(result.personalAmount).toBe(0);
			expect(result.lines[1].amount).toBe(0);
			expect(result.lines[1]._businessRatioGenerated).toBe(true);
		});

		it('0%按分で全額事業主貸になる', () => {
			const lines: JournalLine[] = [
				{ id: '1', type: 'debit', accountCode: '5017', amount: 100000 },
				{ id: '2', type: 'credit', accountCode: '1003', amount: 100000 }
			];

			const result = applyBusinessRatio({
				lines,
				targetLineIndex: 0,
				businessRatio: 0
			});

			expect(result.lines).toHaveLength(3);
			expect(result.businessAmount).toBe(0);
			expect(result.personalAmount).toBe(100000);
			expect(result.lines[0].amount).toBe(0);
			expect(result.lines[1].amount).toBe(100000);
		});

		it('貸方行は按分されない', () => {
			const lines: JournalLine[] = [
				{ id: '1', type: 'debit', accountCode: '5017', amount: 100000 },
				{ id: '2', type: 'credit', accountCode: '1003', amount: 100000 }
			];

			const result = applyBusinessRatio({
				lines,
				targetLineIndex: 1,
				businessRatio: 30
			});

			// 変更なし
			expect(result.lines).toHaveLength(2);
			expect(result.businessAmount).toBe(0);
			expect(result.personalAmount).toBe(0);
		});

		it('端数を切り捨てる', () => {
			const lines: JournalLine[] = [
				{ id: '1', type: 'debit', accountCode: '5017', amount: 10000 },
				{ id: '2', type: 'credit', accountCode: '1003', amount: 10000 }
			];

			const result = applyBusinessRatio({
				lines,
				targetLineIndex: 0,
				businessRatio: 33
			});

			expect(result.businessAmount).toBe(3300);
			expect(result.personalAmount).toBe(6700);
		});
	});

	describe('removeBusinessRatio', () => {
		it('按分を解除して元に戻す', () => {
			const lines: JournalLine[] = [
				{
					id: '1',
					type: 'debit',
					accountCode: '5017',
					amount: 30000,
					_businessRatioApplied: true,
					_originalAmount: 100000,
					_businessRatio: 30
				},
				{
					id: '2',
					type: 'debit',
					accountCode: '3002',
					amount: 70000,
					_businessRatioGenerated: true
				},
				{ id: '3', type: 'credit', accountCode: '1003', amount: 100000 }
			];

			const result = removeBusinessRatio(lines);

			expect(result).toHaveLength(2);
			expect(result[0].amount).toBe(100000);
			expect(result[0]._businessRatioApplied).toBeUndefined();
			expect(result[0]._originalAmount).toBeUndefined();
			expect(result[0]._businessRatio).toBeUndefined();
			expect(result[1].id).toBe('3');
		});

		it('按分されていない行はそのまま', () => {
			const lines: JournalLine[] = [
				{ id: '1', type: 'debit', accountCode: '5017', amount: 100000 },
				{ id: '2', type: 'credit', accountCode: '1003', amount: 100000 }
			];

			const result = removeBusinessRatio(lines);

			expect(result).toHaveLength(2);
			expect(result[0].amount).toBe(100000);
		});
	});

	describe('hasBusinessRatioApplied', () => {
		it('按分適用済みを検出する', () => {
			const lines: JournalLine[] = [
				{ id: '1', type: 'debit', accountCode: '5017', amount: 30000, _businessRatioApplied: true }
			];
			expect(hasBusinessRatioApplied(lines)).toBe(true);
		});

		it('按分未適用を検出する', () => {
			const lines: JournalLine[] = [
				{ id: '1', type: 'debit', accountCode: '5017', amount: 100000 }
			];
			expect(hasBusinessRatioApplied(lines)).toBe(false);
		});
	});

	describe('getAppliedBusinessRatio', () => {
		it('適用済みの按分率を取得する', () => {
			const lines: JournalLine[] = [
				{
					id: '1',
					type: 'debit',
					accountCode: '5017',
					amount: 30000,
					_businessRatioApplied: true,
					_businessRatio: 30
				}
			];
			expect(getAppliedBusinessRatio(lines)).toBe(30);
		});

		it('按分未適用の場合はnullを返す', () => {
			const lines: JournalLine[] = [
				{ id: '1', type: 'debit', accountCode: '5017', amount: 100000 }
			];
			expect(getAppliedBusinessRatio(lines)).toBe(null);
		});
	});

	describe('calculateBusinessRatioPreview', () => {
		it('プレビューを正しく計算する', () => {
			const result = calculateBusinessRatioPreview(100000, 30);
			expect(result.businessAmount).toBe(30000);
			expect(result.personalAmount).toBe(70000);
		});

		it('端数を切り捨てる', () => {
			const result = calculateBusinessRatioPreview(10000, 33);
			expect(result.businessAmount).toBe(3300);
			expect(result.personalAmount).toBe(6700);
		});

		it('100%で全額事業分', () => {
			const result = calculateBusinessRatioPreview(10000, 100);
			expect(result.businessAmount).toBe(10000);
			expect(result.personalAmount).toBe(0);
		});

		it('0%で全額個人分', () => {
			const result = calculateBusinessRatioPreview(10000, 0);
			expect(result.businessAmount).toBe(0);
			expect(result.personalAmount).toBe(10000);
		});
	});

	describe('getBusinessRatioTargetLine', () => {
		const mockAccounts: Account[] = [
			{
				code: '5017',
				name: '地代家賃',
				type: 'expense',
				isSystem: true,
				createdAt: '',
				businessRatioEnabled: true,
				defaultBusinessRatio: 30
			},
			{
				code: '5011',
				name: '消耗品費',
				type: 'expense',
				isSystem: true,
				createdAt: ''
			},
			{
				code: '1003',
				name: '普通預金',
				type: 'asset',
				isSystem: true,
				createdAt: ''
			}
		];

		it('按分対象の借方行を見つける', () => {
			const lines: JournalLine[] = [
				{ id: '1', type: 'debit', accountCode: '5017', amount: 100000 },
				{ id: '2', type: 'credit', accountCode: '1003', amount: 100000 }
			];

			const result = getBusinessRatioTargetLine(lines, mockAccounts);

			expect(result).not.toBeNull();
			expect(result?.line.id).toBe('1');
			expect(result?.index).toBe(0);
			expect(result?.account.code).toBe('5017');
		});

		it('按分対象がない場合はnullを返す', () => {
			const lines: JournalLine[] = [
				{ id: '1', type: 'debit', accountCode: '5011', amount: 10000 },
				{ id: '2', type: 'credit', accountCode: '1003', amount: 10000 }
			];

			const result = getBusinessRatioTargetLine(lines, mockAccounts);

			expect(result).toBeNull();
		});

		it('貸方のみの場合はnullを返す', () => {
			const lines: JournalLine[] = [
				{ id: '1', type: 'credit', accountCode: '5017', amount: 100000 }
			];

			const result = getBusinessRatioTargetLine(lines, mockAccounts);

			expect(result).toBeNull();
		});
	});

	describe('cleanJournalLineForExport', () => {
		it('内部フラグを除外する', () => {
			const line: JournalLine = {
				id: '1',
				type: 'debit',
				accountCode: '5017',
				amount: 30000,
				taxCategory: 'purchase_10',
				_businessRatioApplied: true,
				_originalAmount: 100000,
				_businessRatio: 30,
				_businessRatioGenerated: false
			};

			const result = cleanJournalLineForExport(line);

			expect(result).toEqual({
				id: '1',
				type: 'debit',
				accountCode: '5017',
				amount: 30000,
				taxCategory: 'purchase_10'
			});
			expect('_businessRatioApplied' in result).toBe(false);
			expect('_originalAmount' in result).toBe(false);
			expect('_businessRatio' in result).toBe(false);
			expect('_businessRatioGenerated' in result).toBe(false);
		});

		it('内部フラグがなくてもエラーにならない', () => {
			const line: JournalLine = {
				id: '1',
				type: 'debit',
				accountCode: '5017',
				amount: 100000
			};

			const result = cleanJournalLineForExport(line);

			expect(result).toEqual({
				id: '1',
				type: 'debit',
				accountCode: '5017',
				amount: 100000
			});
		});
	});
});
