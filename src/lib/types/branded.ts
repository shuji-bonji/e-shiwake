/**
 * Branded Types（公称型）定義
 *
 * TypeScript の構造的型付けでは string 同士の混同を防げないため、
 * Branded Type パターンで型安全性を向上させる。
 *
 * 例: AccountCode と UUID は両方 string だが、
 *     Branded Type により誤った代入をコンパイル時に検出できる。
 *
 * @example
 * const code: AccountCode = '1001' as AccountCode;
 * const id: UUID = crypto.randomUUID() as UUID;
 * // code = id; // コンパイルエラー！
 */

// ============================================================
// ブランドシンボル
// ============================================================

declare const __brand: unique symbol;

/**
 * Branded Type のベース型
 *
 * 既存の型に一意なブランドタグを付与して公称型として扱えるようにする。
 * ランタイムにはオーバーヘッドなし（型レベルのみの制約）。
 */
type Brand<T, B extends string> = T & { readonly [__brand]: B };

// ============================================================
// 基本 Branded Types
// ============================================================

/**
 * UUID（Universally Unique Identifier）
 *
 * crypto.randomUUID() の戻り値やデータベースのID値に使用。
 * 仕訳ID、明細行ID、証憑ID、取引先IDなどに適用。
 */
export type UUID = Brand<string, 'UUID'>;

/**
 * 勘定科目コード（4桁の数字文字列）
 *
 * コード体系:
 * - 1桁目: カテゴリ（1:資産, 2:負債, 3:純資産, 4:収益, 5:費用）
 * - 2桁目: 区分（0:システム, 1:ユーザー追加）
 * - 3-4桁目: 連番（01-99）
 *
 * @example "1001"（現金）, "5005"（旅費交通費）, "5101"（ユーザー追加費用）
 */
export type AccountCode = Brand<string, 'AccountCode'>;

/**
 * 日付文字列（YYYY-MM-DD 形式）
 *
 * 仕訳日付、証憑の書類日付、請求書の発行日・支払期限などに使用。
 * 電帳法の「取引年月日」にも対応。
 */
export type DateString = Brand<string, 'DateString'>;

/**
 * ISO8601 日時文字列
 *
 * createdAt、updatedAt などのタイムスタンプに使用。
 */
export type ISODateTimeString = Brand<string, 'ISODateTimeString'>;

// ============================================================
// 型ガード・ヘルパー関数
// ============================================================

/**
 * 文字列が有効な勘定科目コード形式かを検証する。
 *
 * @param value - 検証対象の文字列
 * @returns 4桁の数字文字列であれば true
 */
export function isAccountCode(value: string): value is AccountCode {
	return /^\d{4}$/.test(value);
}

/**
 * 文字列が有効な日付形式（YYYY-MM-DD）かを検証する。
 *
 * @param value - 検証対象の文字列
 * @returns YYYY-MM-DD 形式であれば true
 */
export function isDateString(value: string): value is DateString {
	return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * 文字列が有効な UUID 形式かを検証する。
 *
 * @param value - 検証対象の文字列
 * @returns UUID v4 形式であれば true
 */
export function isUUID(value: string): value is UUID {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

// ============================================================
// キャスト用ヘルパー
// ============================================================

/**
 * 文字列を AccountCode にキャストする（バリデーションなし）。
 *
 * 既にバリデーション済みの値やDB/マスタから取得した値に使用。
 * 信頼できないユーザー入力には isAccountCode() で先に検証すること。
 */
export function asAccountCode(value: string): AccountCode {
	return value as AccountCode;
}

/**
 * 文字列を DateString にキャストする（バリデーションなし）。
 */
export function asDateString(value: string): DateString {
	return value as DateString;
}

/**
 * 文字列を UUID にキャストする（バリデーションなし）。
 */
export function asUUID(value: string): UUID {
	return value as UUID;
}

/**
 * 文字列を ISODateTimeString にキャストする（バリデーションなし）。
 */
export function asISODateTime(value: string): ISODateTimeString {
	return value as ISODateTimeString;
}
