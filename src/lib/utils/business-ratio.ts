import type { JournalLine, Account } from '$lib/types';
import { OWNER_WITHDRAWAL_CODE } from '$lib/constants/accounts';

/**
 * 按分適用のパラメータ
 */
export interface ApplyBusinessRatioParams {
	lines: JournalLine[];
	targetLineIndex: number;
	businessRatio: number;
}

/**
 * 按分適用結果
 */
export interface ApplyBusinessRatioResult {
	lines: JournalLine[];
	businessAmount: number;
	personalAmount: number;
}

/**
 * 仕訳行に家事按分を適用
 *
 * @example
 * // 100,000円の地代家賃を30%按分
 * applyBusinessRatio({
 *   lines: [...],
 *   targetLineIndex: 0,
 *   businessRatio: 30
 * })
 * // → 地代家賃 30,000円 + 事業主貸 70,000円
 */
export function applyBusinessRatio(params: ApplyBusinessRatioParams): ApplyBusinessRatioResult {
	const { lines, targetLineIndex, businessRatio } = params;
	const targetLine = lines[targetLineIndex];

	if (!targetLine || targetLine.type !== 'debit') {
		return { lines, businessAmount: 0, personalAmount: 0 };
	}

	const totalAmount = targetLine.amount;
	const businessAmount = Math.floor((totalAmount * businessRatio) / 100);
	const personalAmount = totalAmount - businessAmount;

	const result: JournalLine[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (i === targetLineIndex) {
			// 事業分（元の科目、金額を按分後に変更）
			result.push({
				...line,
				amount: businessAmount,
				_businessRatioApplied: true,
				_originalAmount: totalAmount,
				_businessRatio: businessRatio
			});

			// 個人分（事業主貸を追加）
			if (personalAmount > 0) {
				result.push({
					id: crypto.randomUUID(),
					type: 'debit',
					accountCode: OWNER_WITHDRAWAL_CODE,
					amount: personalAmount,
					taxCategory: 'na',
					_businessRatioGenerated: true
				});
			}
		} else {
			result.push(line);
		}
	}

	return { lines: result, businessAmount, personalAmount };
}

/**
 * 按分を解除して元の金額に戻す
 */
export function removeBusinessRatio(lines: JournalLine[]): JournalLine[] {
	const result: JournalLine[] = [];

	for (const line of lines) {
		// 自動生成された事業主貸行をスキップ
		if (line._businessRatioGenerated) {
			continue;
		}

		// 按分適用された行を元に戻す
		if (line._businessRatioApplied && line._originalAmount !== undefined) {
			/* eslint-disable @typescript-eslint/no-unused-vars */
			const {
				_businessRatioApplied,
				_originalAmount,
				_businessRatio,
				_businessRatioGenerated,
				...rest
			} = line;
			/* eslint-enable @typescript-eslint/no-unused-vars */
			result.push({
				...rest,
				amount: _originalAmount
			});
		} else {
			result.push(line);
		}
	}

	return result;
}

/**
 * 按分が適用されているか確認
 */
export function hasBusinessRatioApplied(lines: JournalLine[]): boolean {
	return lines.some((line) => line._businessRatioApplied);
}

/**
 * 適用されている按分率を取得
 */
export function getAppliedBusinessRatio(lines: JournalLine[]): number | null {
	const appliedLine = lines.find((line) => line._businessRatioApplied);
	return appliedLine?._businessRatio ?? null;
}

/**
 * 按分のプレビュー計算
 */
export function calculateBusinessRatioPreview(
	amount: number,
	ratio: number
): { businessAmount: number; personalAmount: number } {
	const businessAmount = Math.floor((amount * ratio) / 100);
	const personalAmount = amount - businessAmount;
	return { businessAmount, personalAmount };
}

/**
 * 按分対象の借方行を取得
 */
export function getBusinessRatioTargetLine(
	lines: JournalLine[],
	accounts: Account[]
): { line: JournalLine; index: number; account: Account } | null {
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line.type !== 'debit') continue;

		const account = accounts.find((a) => a.code === line.accountCode);
		if (account?.businessRatioEnabled) {
			return { line, index: i, account };
		}
	}
	return null;
}

/**
 * JournalLine から内部フラグを除外してエクスポート用にクリーンアップ
 */
export function cleanJournalLineForExport(line: JournalLine): JournalLine {
	/* eslint-disable @typescript-eslint/no-unused-vars */
	const {
		_businessRatioApplied,
		_originalAmount,
		_businessRatio,
		_businessRatioGenerated,
		...clean
	} = line;
	/* eslint-enable @typescript-eslint/no-unused-vars */
	return clean;
}
