/**
 * 家事按分ユーティリティ
 *
 * 個人事業主が事業用と私的用途で共有する経費（通信費、地代家賃、水道光熱費など）を
 * 事業割合（%）で按分するための関数群。
 *
 * 按分適用時の動作:
 * - 元の費用行の金額を「事業分」に縮小し、メタデータ（_businessRatioApplied等）を付与
 * - 差額を「事業主貸」（OWNER_WITHDRAWAL_CODE）行として自動生成
 * - 借方合計 = 貸方合計 が維持される
 *
 * メタデータフィールド（エクスポート時は cleanJournalLineForExport() で除去）:
 * - _businessRatioApplied: 按分適用済みフラグ
 * - _originalAmount: 按分前の元金額
 * - _businessRatio: 適用した按分率（%）
 * - _businessRatioGenerated: 按分で自動生成された行フラグ（事業主貸）
 */

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
 * 按分を解除して元の金額に復元する。
 *
 * 自動生成された事業主貸行を削除し、按分適用行の金額を
 * _originalAmount に復元する。メタデータも全て除去される。
 *
 * @param lines - 仕訳明細行の配列
 * @returns 按分解除後の行配列（按分未適用の場合はそのまま返す）
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
 * 仕訳行に按分が適用されているかを確認する。
 *
 * @param lines - 仕訳明細行の配列
 * @returns いずれかの行に按分が適用されていれば true
 */
export function hasBusinessRatioApplied(lines: JournalLine[]): boolean {
	return lines.some((line) => line._businessRatioApplied);
}

/**
 * 適用されている按分率（%）を取得する。
 *
 * @param lines - 仕訳明細行の配列
 * @returns 按分率（0〜100）、按分未適用の場合は null
 */
export function getAppliedBusinessRatio(lines: JournalLine[]): number | null {
	const appliedLine = lines.find((line) => line._businessRatioApplied);
	return appliedLine?._businessRatio ?? null;
}

/**
 * 按分適用前のプレビュー計算を行う。
 *
 * UI上で按分率を変更した際にリアルタイムで事業分・個人分を表示するために使用。
 * 端数は事業分を切り捨て、個人分を残額とする。
 *
 * @param amount - 元金額
 * @param ratio - 按分率（0〜100）
 * @returns 事業分・個人分の金額
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
 * 按分対象となる借方行を検索する。
 *
 * 勘定科目マスタの businessRatioEnabled フラグが true の科目を対象に、
 * 未適用の借方行を先頭から検索して返す。
 * 既に按分適用済みの行はスキップされる。
 *
 * @param lines - 仕訳明細行の配列
 * @param accounts - 勘定科目マスタ（按分設定の参照に使用）
 * @returns 対象の行情報（行データ・インデックス・科目情報）、見つからなければ null
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
 * 按分適用済みの仕訳行を新しい合計金額で再計算する。
 *
 * 貸方金額を変更した際に、借方の事業分と個人分（事業主貸）の
 * 金額を現在の按分率で自動再計算する。
 * 端数は事業分を切り捨て、残額を個人分とする。
 *
 * @param lines - 仕訳明細行の配列
 * @param newTotal - 新しい合計金額（＝変更後の貸方合計）
 * @returns 再計算後の行配列（按分未適用の場合は元の配列をそのまま返す）
 *
 * @example
 * // 33%按分で貸方を100,000→80,000に変更
 * recalculateBusinessRatio(lines, 80000)
 * // → 事業分: 26,400円、個人分: 53,600円
 *
 * @see Issue #33 - 按分再計算のロジック導入
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
 * JournalLine から按分関連の内部メタデータを除去してエクスポート用にする。
 *
 * _businessRatioApplied, _originalAmount, _businessRatio, _businessRatioGenerated を
 * 除去した新しいオブジェクトを返す。JSONエクスポート時に使用。
 *
 * @param line - クリーンアップ対象の仕訳明細行
 * @returns 内部フラグを除去した仕訳明細行
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
