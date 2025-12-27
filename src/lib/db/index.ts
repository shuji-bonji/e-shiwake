import Dexie, { type EntityTable } from 'dexie';
import type { Account, Vendor, JournalEntry, Attachment } from '$lib/types';
import { defaultAccounts } from './seed';

/**
 * e-shiwake データベース
 */
class EShiwakeDatabase extends Dexie {
	accounts!: EntityTable<Account, 'code'>;
	vendors!: EntityTable<Vendor, 'id'>;
	journals!: EntityTable<JournalEntry, 'id'>;
	attachments!: EntityTable<Attachment, 'id'>;

	constructor() {
		super('e-shiwake');

		this.version(1).stores({
			accounts: 'code, name, type, isSystem',
			vendors: 'id, name',
			journals: 'id, date, vendor, evidenceStatus',
			attachments: 'id, journalEntryId'
		});
	}
}

export const db = new EShiwakeDatabase();

/**
 * データベースの初期化
 * 初回起動時にデフォルトの勘定科目を挿入
 */
export async function initializeDatabase(): Promise<void> {
	const count = await db.accounts.count();
	if (count === 0) {
		await db.accounts.bulkAdd(defaultAccounts);
		console.log('Default accounts initialized');
	}
}

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
