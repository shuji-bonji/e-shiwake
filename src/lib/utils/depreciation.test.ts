import { describe, it, expect } from 'vitest';
import {
	getDepreciationRate,
	calculateDepreciationMonths,
	calculateYearlyDepreciation,
	generateDepreciationRow,
	generatePage3Depreciation,
	depreciationToCsv,
	validateFixedAsset,
	isSmallScaleAsset,
	isBulkDepreciationAsset,
	isDepreciableAsset,
	STRAIGHT_LINE_RATES,
	DECLINING_BALANCE_RATES
} from './depreciation';
import type { FixedAsset } from '$lib/types/blue-return-types';

const mockAssets: FixedAsset[] = [
	{
		id: '1',
		name: 'MacBook Pro',
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
	},
	{
		id: '2',
		name: '業務用車両',
		category: 'vehicle',
		acquisitionDate: '2023-01-15',
		acquisitionCost: 2000000,
		usefulLife: 6,
		depreciationMethod: 'declining-balance',
		depreciationRate: 0.333,
		businessRatio: 80,
		status: 'active',
		memo: '',
		createdAt: '',
		updatedAt: ''
	},
	{
		id: '3',
		name: '会計ソフト',
		category: 'other', // ソフトウェアはotherカテゴリ
		acquisitionDate: '2025-07-01',
		acquisitionCost: 50000,
		usefulLife: 5,
		depreciationMethod: 'straight-line',
		depreciationRate: 0.2,
		businessRatio: 100,
		status: 'active',
		memo: '',
		createdAt: '',
		updatedAt: ''
	}
];

describe('depreciation', () => {
	describe('getDepreciationRate', () => {
		it('定額法の償却率を正しく返す', () => {
			expect(getDepreciationRate('straight-line', 4)).toBe(0.25);
			expect(getDepreciationRate('straight-line', 5)).toBe(0.2);
			expect(getDepreciationRate('straight-line', 6)).toBe(0.167);
		});

		it('定率法の償却率を正しく返す', () => {
			expect(getDepreciationRate('declining-balance', 4)).toBe(0.5);
			expect(getDepreciationRate('declining-balance', 5)).toBe(0.4);
			expect(getDepreciationRate('declining-balance', 6)).toBe(0.333);
		});

		it('未定義の耐用年数の場合は計算値を返す', () => {
			// 定額法: 1/耐用年数
			const rate = getDepreciationRate('straight-line', 100);
			expect(rate).toBe(0.01); // 1/100 = 0.01
		});

		it('テーブルにある値をそのまま返す', () => {
			expect(STRAIGHT_LINE_RATES[4]).toBe(0.25);
			expect(DECLINING_BALANCE_RATES[4]).toBe(0.5);
		});
	});

	describe('calculateDepreciationMonths', () => {
		it('取得年より前の年度は12ヶ月を返す', () => {
			const months = calculateDepreciationMonths('2023-04-01', 2024, 'active');
			expect(months).toBe(12);
		});

		it('取得年と同じ年度は取得月からの月数を返す', () => {
			// 4月取得 → 4〜12月の9ヶ月
			const months = calculateDepreciationMonths('2024-04-01', 2024, 'active');
			expect(months).toBe(9);
		});

		it('取得年より後の年度は0を返す', () => {
			const months = calculateDepreciationMonths('2025-07-01', 2024, 'active');
			expect(months).toBe(0);
		});

		it('1月取得は12ヶ月を返す', () => {
			const months = calculateDepreciationMonths('2024-01-01', 2024, 'active');
			expect(months).toBe(12);
		});
	});

	describe('calculateYearlyDepreciation', () => {
		it('定額法の年間償却費を正しく計算する', () => {
			// 取得価額200,000 × 償却率0.25 × 12/12 = 50,000
			const result = calculateYearlyDepreciation(200000, 200000, 'straight-line', 0.25, 12, 4);
			expect(result).toBe(50000);
		});

		it('定額法の月割償却費を正しく計算する', () => {
			// 取得価額200,000 × 償却率0.25 × 9/12 = 37,500
			const result = calculateYearlyDepreciation(200000, 200000, 'straight-line', 0.25, 9, 4);
			expect(result).toBe(37500);
		});

		it('定率法の年間償却費を正しく計算する', () => {
			// 期首帳簿価額2,000,000 × 償却率0.333 × 12/12 = 666,000
			const result = calculateYearlyDepreciation(
				2000000,
				2000000,
				'declining-balance',
				0.333,
				12,
				6
			);
			expect(result).toBe(666000);
		});
	});

	describe('generateDepreciationRow', () => {
		it('減価償却明細行を正しく生成する', () => {
			const asset = mockAssets[0]; // MacBook Pro
			const row = generateDepreciationRow(asset, 2024);

			expect(row.assetName).toBe('MacBook Pro');
			expect(row.acquisitionDate).toBe('2024-04');
			expect(row.acquisitionCost).toBe(200000);
			expect(row.usefulLife).toBe(4);
			expect(row.depreciationMethod).toBe('straight-line');
		});

		it('定率法の資産を正しく処理する', () => {
			const asset = mockAssets[1]; // 業務用車両
			const row = generateDepreciationRow(asset, 2023);

			expect(row.depreciationMethod).toBe('declining-balance');
		});

		it('事業専用割合を正しく反映する', () => {
			const asset = mockAssets[1]; // 80%
			const row = generateDepreciationRow(asset, 2023);

			expect(row.businessRatio).toBe(80);
			// 必要経費算入額 = 償却費 × 80%
			expect(row.businessDepreciation).toBe(Math.floor(row.currentYearDepreciation * 0.8));
		});
	});

	describe('generatePage3Depreciation', () => {
		it('3ページ目のデータを正しく生成する', () => {
			// 2024年時点でアクティブな資産: mockAssets[0]と[1]
			const result = generatePage3Depreciation([mockAssets[0], mockAssets[1]], 2024);

			expect(result.assets.length).toBe(2);
		});

		it('合計額を正しく計算する', () => {
			const result = generatePage3Depreciation([mockAssets[0]], 2024);

			// 200,000 × 0.25 × 9/12 = 37,500
			expect(result.totalDepreciation).toBe(37500);
			expect(result.totalBusinessDepreciation).toBe(37500); // 100%
		});

		it('空配列の場合は0を返す', () => {
			const result = generatePage3Depreciation([], 2024);

			expect(result.assets).toHaveLength(0);
			expect(result.totalDepreciation).toBe(0);
			expect(result.totalBusinessDepreciation).toBe(0);
		});

		it('取得前の資産は償却費0で含まれる', () => {
			const result = generatePage3Depreciation([mockAssets[2]], 2024); // 2025年7月取得

			// アクティブな資産は含まれるが、償却費は0
			expect(result.assets).toHaveLength(1);
			expect(result.assets[0].currentYearDepreciation).toBe(0);
			expect(result.totalDepreciation).toBe(0);
		});
	});

	describe('depreciationToCsv', () => {
		it('CSV形式に変換する', () => {
			const page3 = generatePage3Depreciation([mockAssets[0]], 2024);
			const csv = depreciationToCsv(page3, 2024);

			expect(csv).toContain('減価償却費の計算,2024年分');
			expect(csv).toContain('MacBook Pro');
			expect(csv).toContain('資産の名称');
		});

		it('ヘッダー行を含む', () => {
			const page3 = generatePage3Depreciation([mockAssets[0]], 2024);
			const csv = depreciationToCsv(page3, 2024);

			expect(csv).toContain('取得年月');
			expect(csv).toContain('取得価額');
			expect(csv).toContain('償却方法');
			expect(csv).toContain('耐用年数');
		});
	});

	describe('validateFixedAsset', () => {
		it('正常な資産はエラーを返さない', () => {
			const errors = validateFixedAsset(mockAssets[0]);
			expect(errors).toHaveLength(0);
		});

		it('資産名が空の場合はエラー', () => {
			const errors = validateFixedAsset({ ...mockAssets[0], name: '' });
			expect(errors).toContain('資産名は必須です');
		});

		it('取得価額が0以下の場合はエラー', () => {
			const errors = validateFixedAsset({ ...mockAssets[0], acquisitionCost: 0 });
			expect(errors.some((e) => e.includes('取得価額'))).toBe(true);
		});

		it('耐用年数が0以下の場合はエラー', () => {
			const errors = validateFixedAsset({ ...mockAssets[0], usefulLife: 0 });
			expect(errors.some((e) => e.includes('耐用年数'))).toBe(true);
		});

		it('事業専用割合が範囲外の場合はエラー', () => {
			const errors = validateFixedAsset({ ...mockAssets[0], businessRatio: 150 });
			expect(errors.some((e) => e.includes('事業専用割合'))).toBe(true);
		});
	});

	describe('少額資産判定', () => {
		it('isSmallScaleAsset: 30万円未満かどうか', () => {
			expect(isSmallScaleAsset(299999)).toBe(true);
			expect(isSmallScaleAsset(300000)).toBe(false);
		});

		it('isBulkDepreciationAsset: 10万円以上20万円未満かどうか', () => {
			expect(isBulkDepreciationAsset(100000)).toBe(true);
			expect(isBulkDepreciationAsset(199999)).toBe(true);
			expect(isBulkDepreciationAsset(200000)).toBe(false);
			expect(isBulkDepreciationAsset(99999)).toBe(false);
		});

		it('isDepreciableAsset: 10万円以上かどうか', () => {
			expect(isDepreciableAsset(100000)).toBe(true);
			expect(isDepreciableAsset(99999)).toBe(false);
		});
	});
});
