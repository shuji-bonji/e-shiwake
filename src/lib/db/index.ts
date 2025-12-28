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

	const accounts = await db.accounts
		.where('type')
		.equals(type)
		.toArray();

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

// ==================== 仕訳関連 ====================

/**
 * 仕訳の取得（年度別、日付降順）
 */
export async function getJournalsByYear(year: number): Promise<JournalEntry[]> {
	const startDate = `${year}-01-01`;
	const endDate = `${year}-12-31`;

	return db.journals
		.where('date')
		.between(startDate, endDate, true, true)
		.reverse()
		.sortBy('date');
}

/**
 * 仕訳の取得（ID指定）
 */
export async function getJournalById(id: string): Promise<JournalEntry | undefined> {
	return db.journals.get(id);
}

/**
 * 仕訳の追加
 */
export async function addJournal(
	journal: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
	const now = new Date().toISOString();
	const id = crypto.randomUUID();

	await db.journals.add({
		...journal,
		id,
		createdAt: now,
		updatedAt: now
	});

	// 取引先を自動登録
	if (journal.vendor) {
		await ensureVendorExists(journal.vendor);
	}

	return id;
}

/**
 * 仕訳の更新
 */
export async function updateJournal(
	id: string,
	updates: Partial<Omit<JournalEntry, 'id' | 'createdAt'>>
): Promise<void> {
	const now = new Date().toISOString();

	await db.journals.update(id, {
		...updates,
		updatedAt: now
	});

	// 取引先を自動登録
	if (updates.vendor) {
		await ensureVendorExists(updates.vendor);
	}
}

/**
 * 仕訳の削除
 */
export async function deleteJournal(id: string): Promise<void> {
	await db.journals.delete(id);
}

/**
 * 空の仕訳を作成
 */
export function createEmptyJournal(): Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'> {
	return {
		date: new Date().toISOString().slice(0, 10),
		lines: [
			{ id: crypto.randomUUID(), type: 'debit', accountCode: '', amount: 0 },
			{ id: crypto.randomUUID(), type: 'credit', accountCode: '', amount: 0 }
		],
		vendor: '',
		description: '',
		evidenceStatus: 'none',
		attachments: []
	};
}

/**
 * 仕訳のバリデーション（借方合計 === 貸方合計）
 */
export function validateJournal(journal: Pick<JournalEntry, 'lines'>): {
	isValid: boolean;
	debitTotal: number;
	creditTotal: number;
} {
	const debitTotal = journal.lines
		.filter((line) => line.type === 'debit')
		.reduce((sum, line) => sum + line.amount, 0);

	const creditTotal = journal.lines
		.filter((line) => line.type === 'credit')
		.reduce((sum, line) => sum + line.amount, 0);

	return {
		isValid: debitTotal === creditTotal && debitTotal > 0,
		debitTotal,
		creditTotal
	};
}

// ==================== 取引先関連 ====================

/**
 * 取引先の存在確認と自動登録
 */
async function ensureVendorExists(name: string): Promise<void> {
	const existing = await db.vendors.where('name').equals(name).first();
	if (!existing) {
		await db.vendors.add({
			id: crypto.randomUUID(),
			name,
			createdAt: new Date().toISOString()
		});
	}
}

/**
 * 全取引先の取得
 */
export async function getAllVendors(): Promise<Vendor[]> {
	return db.vendors.orderBy('name').toArray();
}

/**
 * 取引先の検索（部分一致）
 */
export async function searchVendors(query: string): Promise<Vendor[]> {
	if (!query) return getAllVendors();

	const lowerQuery = query.toLowerCase();
	return db.vendors.filter((v) => v.name.toLowerCase().includes(lowerQuery)).toArray();
}
