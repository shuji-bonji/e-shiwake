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

			// 個人分（事業主貸を追加）- 0円でも追加して後から金額入力で自動計算
			result.push({
				id: crypto.randomUUID(),
				type: 'debit',
				accountCode: OWNER_WITHDRAWAL_CODE,
				amount: personalAmount,
				taxCategory: 'na',
				_businessRatioGenerated: true
			});
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
 * 既に按分適用済みの行はスキップする
 */
export function getBusinessRatioTargetLine(
	lines: JournalLine[],
	accounts: Account[]
): { line: JournalLine; index: number; account: Account } | null {
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line.type !== 'debit') continue;
		// 既に按分適用済みの行はスキップ
		if (line._businessRatioApplied) continue;

		const account = accounts.find((a) => a.code === line.accountCode);
		if (account?.businessRatioEnabled) {
			return { line, index: i, account };
		}
	}
	return null;
}

/**
 * 按分適用済みの仕訳行を新しい合計金額で再計算する
 *
 * 貸方金額を変更した際に、借方の按分済み行（事業分）と
 * 自動生成された事業主貸行（個人分）の金額を再計算する。
 *
 * @param lines 仕訳行配列
 * @param newTotal 新しい合計金額（＝貸方合計）
 * @returns 再計算後の仕訳行配列（按分未適用の場合はそのまま返す）
 */
export function recalculateBusinessRatio(lines: JournalLine[], newTotal: number): JournalLine[] {
	const appliedLine = lines.find((l) => l._businessRatioApplied);
	if (!appliedLine || appliedLine._businessRatio === undefined) return lines;

	const ratio = appliedLine._businessRatio;
	const businessAmount = Math.floor((newTotal * ratio) / 100);
	const personalAmount = newTotal - businessAmount;

	return lines.map((line) => {
		if (line._businessRatioApplied) {
			return { ...line, amount: businessAmount, _originalAmount: newTotal };
		}
		if (line._businessRatioGenerated) {
			return { ...line, amount: personalAmount };
		}
		return line;
	});
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
