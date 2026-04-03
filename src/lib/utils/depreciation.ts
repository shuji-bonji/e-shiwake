/**
 * 減価償却計算ユーティリティ
 *
 * 固定資産台帳のデータから減価償却費を計算し、
 * 青色申告決算書3ページ目（減価償却費の計算）のデータを生成する。
 *
 * 対応する償却方法:
 * - 定額法（straight_line）: 取得価額 × 償却率（一定額を毎年償却）
 * - 定率法（declining_balance）: 未償却残高 × 償却率（初期に多く償却）
 *
 * 備忘価額（1円）まで償却し、残存簿価は必ず1円以上となる。
 * 定率法では償却保証額を下回った時点で改定償却率に切り替わる。
 *
 * @see 国税庁「減価償却のあらまし」
 */

import type {
	FixedAsset,
	DepreciationAssetRow,
	DepreciationMethod,
	Page3Depreciation
} from '$lib/types/blue-return-types';

// ============================================================
// 定数定義
// ============================================================

/**
 * 定額法の償却率テーブル（耐用年数 → 償却率）
 * 平成19年4月1日以後取得の資産用
 */
export const STRAIGHT_LINE_RATES: Record<number, number> = {
	2: 0.5,
	3: 0.334,
	4: 0.25,
	5: 0.2,
	6: 0.167,
	7: 0.143,
	8: 0.125,
	9: 0.112,
	10: 0.1,
	11: 0.091,
	12: 0.084,
	13: 0.077,
	14: 0.072,
	15: 0.067,
	20: 0.05
};

/**
 * 定率法の償却率テーブル（耐用年数 → 償却率）
 * 平成24年4月1日以後取得の資産用（200%定率法）
 */
export const DECLINING_BALANCE_RATES: Record<number, number> = {
	2: 1.0,
	3: 0.667,
	4: 0.5,
	5: 0.4,
	6: 0.333,
	7: 0.286,
	8: 0.25,
	9: 0.222,
	10: 0.2,
	11: 0.182,
	12: 0.167,
	13: 0.154,
	14: 0.143,
	15: 0.133,
	20: 0.1
};

/**
 * 保証率テーブル（定率法用）
 */
export const GUARANTEE_RATES: Record<number, number> = {
	2: 0.0,
	3: 0.11089,
	4: 0.12499,
	5: 0.108,
	6: 0.09911,
	7: 0.0868,
	8: 0.07909,
	9: 0.07126,
	10: 0.06552,
	11: 0.05992,
	12: 0.05566,
	13: 0.0518,
	14: 0.04854,
	15: 0.04565,
	20: 0.03486
};

/**
 * 改定償却率テーブル（定率法用）
 */
export const REVISED_RATES: Record<number, number> = {
	2: 1.0,
	3: 1.0,
	4: 0.5,
	5: 0.5,
	6: 0.334,
	7: 0.334,
	8: 0.334,
	9: 0.25,
	10: 0.25,
	11: 0.2,
	12: 0.2,
	13: 0.167,
	14: 0.167,
	15: 0.143,
	20: 0.112
};

// ============================================================
// 償却率取得関数
// ============================================================

/**
 * 償却方法と耐用年数から償却率を取得する。
 *
 * @param method - 償却方法（'straight_line' / 'declining_balance'）
 * @param usefulLife - 耐用年数（年）
 * @returns 償却率（例: 0.2 = 20%）、テーブルにない場合は 1/耐用年数 で概算
 */
export function getDepreciationRate(method: DepreciationMethod, usefulLife: number): number {
	const rates = method === 'straight-line' ? STRAIGHT_LINE_RATES : DECLINING_BALANCE_RATES;

	// テーブルにある場合はそれを使用
	if (rates[usefulLife]) {
		return rates[usefulLife];
	}

	// テーブルにない場合は計算（定額法: 1/耐用年数）
	if (method === 'straight-line') {
		return Math.round((1 / usefulLife) * 1000) / 1000;
	}

	// 定率法は200%定率法（2/耐用年数）
	return Math.round((2 / usefulLife) * 1000) / 1000;
}

// ============================================================
// 減価償却計算関数
// ============================================================

/**
 * 経過月数を計算
 */
export function calculateElapsedMonths(acquisitionDate: string, fiscalYearEnd: string): number {
	const start = new Date(acquisitionDate);
	const end = new Date(fiscalYearEnd);

	// 取得日から年度末までの月数
	const months =
		(end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;

	return Math.max(0, months);
}

/**
 * 当年度の償却月数を計算
 */
export function calculateDepreciationMonths(
	acquisitionDate: string,
	fiscalYear: number,
	status: 'active' | 'sold' | 'disposed',
	disposalDate?: string
): number {
	const acqDate = new Date(acquisitionDate);

	// 取得年より前の年度の場合は12ヶ月
	if (acqDate.getFullYear() < fiscalYear) {
		// 売却・除却された場合
		if ((status === 'sold' || status === 'disposed') && disposalDate) {
			const dispDate = new Date(disposalDate);
			if (dispDate.getFullYear() === fiscalYear) {
				return dispDate.getMonth() + 1; // 1月から処分月まで
			}
			if (dispDate.getFullYear() < fiscalYear) {
				return 0; // 前年以前に処分済み
			}
		}
		return 12;
	}

	// 取得年と同じ年度の場合
	if (acqDate.getFullYear() === fiscalYear) {
		const startMonth = acqDate.getMonth() + 1; // 1-12
		let endMonth = 12;

		// 売却・除却された場合
		if ((status === 'sold' || status === 'disposed') && disposalDate) {
			const dispDate = new Date(disposalDate);
			if (dispDate.getFullYear() === fiscalYear) {
				endMonth = dispDate.getMonth() + 1;
			}
		}

		return endMonth - startMonth + 1;
	}

	// 取得年より後の年度の場合（通常はない）
	return 0;
}

/**
 * 指定年度末時点での累計償却額を計算する。
 *
 * 取得年度から指定年度まで各年の償却額を積み上げて算出。
 * 売却・除却済みの場合は処分年度以降の償却は行わない。
 *
 * @param asset - 固定資産データ
 * @param fiscalYear - 計算対象の年度
 * @returns 累計償却額
 */
export function calculateAccumulatedDepreciation(asset: FixedAsset, fiscalYear: number): number {
	const acqDate = new Date(asset.acquisitionDate);
	const acqYear = acqDate.getFullYear();

	if (acqYear > fiscalYear) {
		return 0;
	}

	let accumulated = 0;
	let bookValue = asset.acquisitionCost;

	// 取得年から対象年度まで年度ごとに計算
	for (let year = acqYear; year <= fiscalYear; year++) {
		const months = calculateDepreciationMonths(
			asset.acquisitionDate,
			year,
			year === fiscalYear ? asset.status : 'active',
			asset.disposalDate
		);

		if (months === 0) continue;

		const yearlyDepreciation = calculateYearlyDepreciation(
			asset.acquisitionCost,
			bookValue,
			asset.depreciationMethod,
			asset.depreciationRate,
			months,
			asset.usefulLife
		);

		accumulated += yearlyDepreciation;
		bookValue -= yearlyDepreciation;

		// 備忘価額（1円）を下回らないようにする
		if (bookValue <= 1) {
			accumulated = asset.acquisitionCost - 1;
			break;
		}
	}

	return Math.round(accumulated);
}

/**
 * 年間の減価償却額を計算する。
 *
 * 定額法: 取得価額 × 償却率 × (月数/12)
 * 定率法: 未償却残高 × 償却率 × (月数/12)
 *         ※ 保証額を下回ったら改定償却率に切替
 * いずれの場合も備忘価額（1円）を下回らないよう調整。
 *
 * @param acquisitionCost - 取得価額
 * @param bookValue - 期首簿価（未償却残高）
 * @param method - 償却方法
 * @param rate - 償却率
 * @param months - 当年の償却月数（1〜12）
 * @param usefulLife - 耐用年数（保証率・改定償却率の参照に使用）
 * @returns 年間償却額（円、端数切り捨て）
 */
export function calculateYearlyDepreciation(
	acquisitionCost: number,
	bookValue: number,
	method: DepreciationMethod,
	rate: number,
	months: number,
	usefulLife: number
): number {
	if (method === 'straight-line') {
		// 定額法: 取得価額 × 償却率 × 月数/12
		const yearlyAmount = acquisitionCost * rate;
		return Math.round((yearlyAmount * months) / 12);
	} else {
		// 定率法: 期首帳簿価額 × 償却率 × 月数/12
		// （保証額を下回る場合は改定償却率を使用）
		const guaranteeRate = GUARANTEE_RATES[usefulLife] || 0;
		const guaranteeAmount = acquisitionCost * guaranteeRate;
		const revisedRate = REVISED_RATES[usefulLife] || rate;

		let depreciation: number;
		if (bookValue * rate >= guaranteeAmount) {
			depreciation = bookValue * rate;
		} else {
			// 改定償却率を使用
			depreciation = bookValue * revisedRate;
		}

		return Math.round((depreciation * months) / 12);
	}
}

// ============================================================
// 減価償却データ生成
// ============================================================

/**
 * 固定資産データから青色申告決算書用の減価償却資産行を生成する。
 *
 * 取得価額・累計償却額・当年償却額・期末簿価を算出し、
 * 3ページ目のテーブル1行分のデータとして返す。
 *
 * @param asset - 固定資産データ
 * @param fiscalYear - 対象年度
 * @returns 減価償却資産行データ
 */
export function generateDepreciationRow(
	asset: FixedAsset,
	fiscalYear: number
): DepreciationAssetRow {
	const months = calculateDepreciationMonths(
		asset.acquisitionDate,
		fiscalYear,
		asset.status,
		asset.disposalDate
	);

	// 期首の累計償却額（前年度末まで）
	const prevAccumulated = calculateAccumulatedDepreciation(asset, fiscalYear - 1);
	const bookValueStart = asset.acquisitionCost - prevAccumulated;

	// 当年度の償却費
	const currentYearDepreciation = calculateYearlyDepreciation(
		asset.acquisitionCost,
		bookValueStart,
		asset.depreciationMethod,
		asset.depreciationRate,
		months,
		asset.usefulLife
	);

	// 必要経費算入額（事業専用割合を適用）
	const businessDepreciation = Math.round(currentYearDepreciation * (asset.businessRatio / 100));

	// 期末の累計償却額
	const accumulatedDepreciation = prevAccumulated + currentYearDepreciation;

	// 期末帳簿価額
	const bookValue = Math.max(1, asset.acquisitionCost - accumulatedDepreciation);

	return {
		assetName: asset.name,
		acquisitionDate: asset.acquisitionDate.substring(0, 7), // YYYY-MM
		acquisitionCost: asset.acquisitionCost,
		depreciationMethod: asset.depreciationMethod,
		usefulLife: asset.usefulLife,
		depreciationRate: asset.depreciationRate,
		depreciationMonths: months,
		depreciationBase: asset.acquisitionCost, // 定額法の場合
		currentYearDepreciation,
		businessRatio: asset.businessRatio,
		businessDepreciation,
		accumulatedDepreciation,
		bookValue
	};
}

/**
 * 青色申告決算書3ページ目（減価償却費の計算）の全データを生成する。
 *
 * 全固定資産について減価償却資産行を生成し、
 * 当年度の減価償却費合計を算出する。
 *
 * @param assets - 固定資産台帳の全データ
 * @param fiscalYear - 対象年度
 * @returns 3ページ目データ（資産行一覧・減価償却費合計）
 */
export function generatePage3Depreciation(
	assets: FixedAsset[],
	fiscalYear: number
): Page3Depreciation {
	// アクティブな資産、または当年度に処分した資産を処理
	const activeAssets = assets.filter(
		(a) =>
			a.status === 'active' ||
			(a.disposalDate && new Date(a.disposalDate).getFullYear() === fiscalYear)
	);

	const rows = activeAssets.map((asset) => generateDepreciationRow(asset, fiscalYear));

	const totalDepreciation = rows.reduce((sum, r) => sum + r.currentYearDepreciation, 0);
	const totalBusinessDepreciation = rows.reduce((sum, r) => sum + r.businessDepreciation, 0);

	return {
		assets: rows,
		totalDepreciation,
		totalBusinessDepreciation,
		interestDetails: [],
		interestTotal: 0
	};
}

// ============================================================
// CSV出力
// ============================================================

/**
 * 減価償却費の計算をCSV形式に変換
 */
export function depreciationToCsv(data: Page3Depreciation, fiscalYear: number): string {
	const lines: string[] = [];

	lines.push(`減価償却費の計算,${fiscalYear}年分`);
	lines.push('');
	lines.push(
		[
			'資産の名称',
			'取得年月',
			'取得価額',
			'償却方法',
			'耐用年数',
			'償却率',
			'本年中の償却期間',
			'償却の基礎となる金額',
			'本年分の償却費',
			'事業専用割合',
			'本年分の必要経費算入額',
			'期末償却累計額',
			'期末未償却残高'
		].join(',')
	);

	for (const row of data.assets) {
		lines.push(
			[
				row.assetName,
				row.acquisitionDate,
				row.acquisitionCost,
				row.depreciationMethod === 'straight-line' ? '定額' : '定率',
				row.usefulLife,
				row.depreciationRate,
				`${row.depreciationMonths}ヶ月`,
				row.depreciationBase,
				row.currentYearDepreciation,
				`${row.businessRatio}%`,
				row.businessDepreciation,
				row.accumulatedDepreciation,
				row.bookValue
			].join(',')
		);
	}

	lines.push('');
	lines.push(
		`本年分の償却費合計,,,,,,,,${data.totalDepreciation},,${data.totalBusinessDepreciation},,`
	);

	return lines.join('\n');
}

// ============================================================
// 固定資産の検証
// ============================================================

/**
 * 固定資産データのバリデーション
 */
export function validateFixedAsset(asset: Partial<FixedAsset>): string[] {
	const errors: string[] = [];

	if (!asset.name || asset.name.trim() === '') {
		errors.push('資産名は必須です');
	}

	if (!asset.acquisitionDate) {
		errors.push('取得日は必須です');
	} else if (!/^\d{4}-\d{2}-\d{2}$/.test(asset.acquisitionDate)) {
		errors.push('取得日の形式が不正です（YYYY-MM-DD）');
	}

	if (!asset.acquisitionCost || asset.acquisitionCost <= 0) {
		errors.push('取得価額は0より大きい値を入力してください');
	}

	if (!asset.usefulLife || asset.usefulLife <= 0) {
		errors.push('耐用年数は1以上を入力してください');
	}

	if (asset.businessRatio === undefined || asset.businessRatio < 0 || asset.businessRatio > 100) {
		errors.push('事業専用割合は0〜100の範囲で入力してください');
	}

	return errors;
}

/**
 * 少額減価償却資産の特例が適用可能か判定
 * （青色申告者のみ、30万円未満の資産）
 */
export function isSmallScaleAsset(acquisitionCost: number): boolean {
	return acquisitionCost < 300000;
}

/**
 * 一括償却資産か判定
 * （10万円以上20万円未満の資産、3年均等償却）
 */
export function isBulkDepreciationAsset(acquisitionCost: number): boolean {
	return acquisitionCost >= 100000 && acquisitionCost < 200000;
}

/**
 * 減価償却資産か判定（10万円以上）
 */
export function isDepreciableAsset(acquisitionCost: number): boolean {
	return acquisitionCost >= 100000;
}
