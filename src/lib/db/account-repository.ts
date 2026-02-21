import type { Account } from '$lib/types';
import { db } from './database';

/**
 * 勘定科目の取得（カテゴリ別）
 */
export async function getAccountsByType(type: Account['type']): Promise<Account[]> {
	return db.accounts.where('type').equals(type).sortBy('code');
}

/**
 * 全勘定科目の取得
 */
export async function getAllAccounts(): Promise<Account[]> {
	return db.accounts.orderBy('code').toArray();
}

/**
 * 勘定科目の追加
 */
export async function addAccount(
	account: Omit<Account, 'isSystem' | 'createdAt'>
): Promise<string> {
	const now = new Date().toISOString();
	await db.accounts.add({
		...account,
		isSystem: false,
		createdAt: now
	});
	return account.code;
}

/**
 * 勘定科目の更新
 */
export async function updateAccount(
	code: string,
	updates: Partial<Omit<Account, 'code' | 'isSystem' | 'createdAt'>>
): Promise<void> {
	await db.accounts.update(code, updates);
}

/**
 * 勘定科目の削除
 */
export async function deleteAccount(code: string): Promise<void> {
	const account = await db.accounts.get(code);
	if (account?.isSystem) {
		throw new Error('システム勘定科目は削除できません');
	}
	await db.accounts.delete(code);
}

/**
 * 勘定科目が使用中かチェック
 */
export async function isAccountInUse(code: string): Promise<boolean> {
	const journal = await db.journals
		.filter((j) => j.lines.some((line) => line.accountCode === code))
		.first();
	return !!journal;
}

/**
 * 勘定科目コード体系（4桁）
 *
 * 1桁目: カテゴリ
 *   1: 資産, 2: 負債, 3: 純資産, 4: 収益, 5: 費用
 *
 * 2桁目: 区分
 *   0: システム, 1: ユーザー追加
 *
 * 3-4桁目: 連番（01-99）
 */
const CATEGORY_PREFIX: Record<Account['type'], number> = {
	asset: 1,
	liability: 2,
	equity: 3,
	revenue: 4,
	expense: 5
};

/**
 * コードからシステム科目かどうかを判定
 */
export function isSystemAccount(code: string): boolean {
	return code.length === 4 && code[1] === '0';
}

/**
 * 次の勘定科目コードを生成（ユーザー追加用）
 */
export async function generateNextCode(type: Account['type']): Promise<string> {
	const prefix = CATEGORY_PREFIX[type];
	// ユーザー追加は2桁目が1: X1XX
	const minCode = prefix * 1000 + 100; // 例: 1100, 2100, ...
	const maxCode = prefix * 1000 + 199; // 例: 1199, 2199, ...

	const accounts = await db.accounts.where('type').equals(type).toArray();

	// ユーザー追加科目のコードのみ抽出してソート
	const codes = accounts
		.map((a) => parseInt(a.code, 10))
		.filter((n) => !isNaN(n) && n >= minCode && n <= maxCode)
		.sort((a, b) => a - b);

	if (codes.length === 0) {
		return String(minCode);
	}

	// 最大値 + 1
	const nextCode = codes[codes.length - 1] + 1;

	if (nextCode > maxCode) {
		throw new Error(`${type} のユーザー追加科目の上限（99件）に達しました`);
	}

	return String(nextCode);
}
