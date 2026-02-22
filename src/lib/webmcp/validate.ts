/**
 * WebMCP 入力バリデーションヘルパー
 *
 * Zodを使わず、軽量な関数で入力を検証する。
 * 不正値の場合は明確なエラーメッセージを返す。
 */

type Input = Record<string, unknown>;

/**
 * バリデーションエラー
 */
export class ValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ValidationError';
	}
}

/**
 * 必須の文字列フィールドを取得
 * @throws ValidationError 値がない or 文字列でない場合
 */
export function requireString(input: Input, key: string): string {
	const value = input[key];
	if (value === undefined || value === null) {
		throw new ValidationError(`${key} は必須です`);
	}
	if (typeof value !== 'string') {
		throw new ValidationError(`${key} は文字列である必要があります（受信: ${typeof value}）`);
	}
	return value;
}

/**
 * オプションの文字列フィールドを取得
 */
export function optionalString(input: Input, key: string): string | undefined {
	const value = input[key];
	if (value === undefined || value === null) return undefined;
	if (typeof value !== 'string') {
		throw new ValidationError(`${key} は文字列である必要があります（受信: ${typeof value}）`);
	}
	return value;
}

/**
 * 必須の数値フィールドを取得
 * @throws ValidationError 値がない or 数値でない場合
 */
export function requireNumber(input: Input, key: string): number {
	const value = input[key];
	if (value === undefined || value === null) {
		throw new ValidationError(`${key} は必須です`);
	}
	if (typeof value !== 'number' || Number.isNaN(value)) {
		throw new ValidationError(`${key} は数値である必要があります（受信: ${typeof value}）`);
	}
	return value;
}

/**
 * オプションの数値フィールドを取得
 */
export function optionalNumber(input: Input, key: string): number | undefined {
	const value = input[key];
	if (value === undefined || value === null) return undefined;
	if (typeof value !== 'number' || Number.isNaN(value)) {
		throw new ValidationError(`${key} は数値である必要があります（受信: ${typeof value}）`);
	}
	return value;
}

/**
 * 必須の配列フィールドを取得
 * @throws ValidationError 値がない or 配列でない場合
 */
export function requireArray<T = unknown>(input: Input, key: string): T[] {
	const value = input[key];
	if (value === undefined || value === null) {
		throw new ValidationError(`${key} は必須です`);
	}
	if (!Array.isArray(value)) {
		throw new ValidationError(`${key} は配列である必要があります（受信: ${typeof value}）`);
	}
	return value as T[];
}
