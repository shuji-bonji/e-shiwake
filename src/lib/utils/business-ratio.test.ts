import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	applyBusinessRatio,
	removeBusinessRatio,
	hasBusinessRatioApplied,
	getAppliedBusinessRatio,
	calculateBusinessRatioPreview,
	getBusinessRatioTargetLine,
	recalculateBusinessRatio,
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

		it('0円でも按分適用できる（後から金額入力で自動計算）', () => {
			const lines: JournalLine[] = [
				{ id: '1', type: 'debit', accountCode: '5017', amount: 0 },
				{ id: '2', type: 'credit', accountCode: '1003', amount: 0 }
			];

			const result = applyBusinessRatio({
				lines,
				targetLineIndex: 0,
				businessRatio: 33
			});

			// 0円でも両方の行が生成される
			expect(result.lines).toHaveLength(3);
			expect(result.businessAmount).toBe(0);
			expect(result.personalAmount).toBe(0);
			expect(result.lines[0]._businessRatioApplied).toBe(true);
			expect(result.lines[0]._businessRatio).toBe(33);
			expect(result.lines[0]._originalAmount).toBe(0);
			expect(result.lines[1]._businessRatioGenerated).toBe(true);
			expect(result.lines[1].amount).toBe(0);
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

		it('既に按分適用済みの行はスキップする', () => {
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

			const result = getBusinessRatioTargetLine(lines, mockAccounts);

			// 按分適用済みの行はスキップされるのでnullを返す
			expect(result).toBeNull();
		});

		it('複数の按分対象がある場合、未適用の最初の行を返す', () => {
			const accountsWithMultiple: Account[] = [
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
					code: '5004',
					name: '通信費',
					type: 'expense',
					isSystem: true,
					createdAt: '',
					businessRatioEnabled: true,
					defaultBusinessRatio: 50
				}
			];

			const lines: JournalLine[] = [
				{
					id: '1',
					type: 'debit',
					accountCode: '5017',
					amount: 30000,
					_businessRatioApplied: true
				},
				{ id: '2', type: 'debit', accountCode: '5004', amount: 10000 },
				{ id: '3', type: 'credit', accountCode: '1003', amount: 40000 }
			];

			const result = getBusinessRatioTargetLine(lines, accountsWithMultiple);

			// 最初の行は適用済みなので、2番目の通信費が返される
			expect(result).not.toBeNull();
			expect(result?.line.id).toBe('2');
			expect(result?.account.code).toBe('5004');
		});
	});

	describe('recalculateBusinessRatio', () => {
		it('Issue #33: 貸方金額変更時に按分済み借方を再計算する', () => {
			// 33%按分適用済み: 地代家賃33,000 + 事業主貸67,000 = 100,000
			const lines: JournalLine[] = [
				{
					id: '1',
					type: 'debit',
					accountCode: '5017',
					amount: 33000,
					_businessRatioApplied: true,
					_originalAmount: 100000,
					_businessRatio: 33
				},
				{
					id: '2',
					type: 'debit',
					accountCode: '3002',
					amount: 67000,
					_businessRatioGenerated: true
				},
				{ id: '3', type: 'credit', accountCode: '1003', amount: 100000 }
			];

			// 貸方を120,000に変更
			const result = recalculateBusinessRatio(lines, 120000);

			// 事業分: floor(120000 * 33 / 100) = 39600
			expect(result[0].amount).toBe(39600);
			expect(result[0]._originalAmount).toBe(120000);
			expect(result[0]._businessRatio).toBe(33);
			expect(result[0]._businessRatioApplied).toBe(true);

			// 個人分: 120000 - 39600 = 80400
			expect(result[1].amount).toBe(80400);
			expect(result[1]._businessRatioGenerated).toBe(true);

			// 貸方は変更なし（呼び出し側で更新済み）
			expect(result[2].amount).toBe(100000);
		});

		it('按分未適用の場合はそのまま返す', () => {
			const lines: JournalLine[] = [
				{ id: '1', type: 'debit', accountCode: '5017', amount: 100000 },
				{ id: '2', type: 'credit', accountCode: '1003', amount: 100000 }
			];

			const result = recalculateBusinessRatio(lines, 120000);

			// 変更なし
			expect(result).toBe(lines);
		});

		it('0円への変更でも再計算できる', () => {
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

			const result = recalculateBusinessRatio(lines, 0);

			expect(result[0].amount).toBe(0);
			expect(result[0]._originalAmount).toBe(0);
			expect(result[1].amount).toBe(0);
		});

		it('端数は切り捨て、残りが個人分になる', () => {
			const lines: JournalLine[] = [
				{
					id: '1',
					type: 'debit',
					accountCode: '5017',
					amount: 33000,
					_businessRatioApplied: true,
					_originalAmount: 100000,
					_businessRatio: 33
				},
				{
					id: '2',
					type: 'debit',
					accountCode: '3002',
					amount: 67000,
					_businessRatioGenerated: true
				},
				{ id: '3', type: 'credit', accountCode: '1003', amount: 100000 }
			];

			// 99,999円に変更 → floor(99999 * 33 / 100) = 32999
			const result = recalculateBusinessRatio(lines, 99999);

			expect(result[0].amount).toBe(32999);
			expect(result[1].amount).toBe(99999 - 32999); // 67000
			expect(result[0].amount + result[1].amount).toBe(99999);
		});

		it('Issue #33: コピーした仕訳の貸方金額変更シナリオ', () => {
			// ユースケース: 33%按分の仕訳をコピー → 貸方金額を80,000に変更
			const lines: JournalLine[] = [
				{
					id: '1',
					type: 'debit',
					accountCode: '5017',
					amount: 33000,
					_businessRatioApplied: true,
					_originalAmount: 100000,
					_businessRatio: 33
				},
				{
					id: '2',
					type: 'debit',
					accountCode: '3002',
					amount: 67000,
					_businessRatioGenerated: true
				},
				{ id: '3', type: 'credit', accountCode: '1003', amount: 80000 }
			];

			const newCreditTotal = 80000;
			const result = recalculateBusinessRatio(lines, newCreditTotal);

			// floor(80000 * 33 / 100) = 26400
			expect(result[0].amount).toBe(26400);
			expect(result[0]._originalAmount).toBe(80000);
			// 80000 - 26400 = 53600
			expect(result[1].amount).toBe(53600);
			// 合計が貸方と一致
			expect(result[0].amount + result[1].amount).toBe(80000);
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
