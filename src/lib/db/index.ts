import Dexie, { type EntityTable } from 'dexie';
import type { Account, Vendor, JournalEntry, Attachment, DocumentType, StorageType } from '$lib/types';
import { defaultAccounts } from './seed';

/**
 * 設定レコード（キーバリュー形式）
 */
interface SettingsRecord {
	key: string;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	value: any;
	updatedAt: string;
}

/**
 * e-shiwake データベース
 */
class EShiwakeDatabase extends Dexie {
	accounts!: EntityTable<Account, 'code'>;
	vendors!: EntityTable<Vendor, 'id'>;
	journals!: EntityTable<JournalEntry, 'id'>;
	attachments!: EntityTable<Attachment, 'id'>;
	settings!: EntityTable<SettingsRecord, 'key'>;

	constructor() {
		super('e-shiwake');

		this.version(1).stores({
			accounts: 'code, name, type, isSystem',
			vendors: 'id, name',
			journals: 'id, date, vendor, evidenceStatus',
			attachments: 'id, journalEntryId'
		});

		// Version 2: 設定テーブルを追加
		this.version(2).stores({
			accounts: 'code, name, type, isSystem',
			vendors: 'id, name',
			journals: 'id, date, vendor, evidenceStatus',
			attachments: 'id, journalEntryId',
			settings: 'key'
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
		// bulkPutを使用して、既存のキーがあっても上書き（競合回避）
		await db.accounts.bulkPut(defaultAccounts);
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

	const journals = await db.journals
		.where('date')
		.between(startDate, endDate, true, true)
		.toArray();

	// 日付降順（新しい順）でソート、同日内は作成日時降順
	return journals.sort((a, b) => {
		const dateCompare = b.date.localeCompare(a.date);
		if (dateCompare !== 0) return dateCompare;
		return b.createdAt.localeCompare(a.createdAt);
	});
}

/**
 * 利用可能な年度の取得（仕訳データから抽出）
 * 仕訳がない場合は現在年度のみ返す
 */
export async function getAvailableYears(): Promise<number[]> {
	const journals = await db.journals.toArray();

	if (journals.length === 0) {
		return [new Date().getFullYear()];
	}

	// 仕訳の日付から年度を抽出してユニークにする
	const years = new Set<number>();
	for (const journal of journals) {
		const year = parseInt(journal.date.substring(0, 4), 10);
		if (!isNaN(year)) {
			years.add(year);
		}
	}

	// 降順（新しい年度が先）でソート
	return Array.from(years).sort((a, b) => b - a);
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

// ==================== 添付ファイル関連 ====================

/**
 * 書類の種類の短縮ラベル（ファイル名用）
 */
const DocumentTypeShortLabels: Record<DocumentType, string> = {
	invoice: '請求書発行',
	bill: '請求書',
	receipt: '領収書',
	contract: '契約書',
	estimate: '見積書',
	other: 'その他'
};

/**
 * 添付ファイル名を自動生成
 * 形式: {書類の日付}_{種類}_{勘定科目名}_{金額}円_{取引先名}.pdf
 */
export function generateAttachmentName(
	documentDate: string,
	documentType: DocumentType,
	accountName: string,
	amount: number,
	vendor: string
): string {
	// ファイル名に使えない文字を置換
	const sanitize = (str: string) => str.replace(/[\\/:*?"<>|]/g, '_').trim();

	const parts = [
		documentDate,
		DocumentTypeShortLabels[documentType],
		sanitize(accountName) || '未分類',
		`${amount.toLocaleString()}円`,
		sanitize(vendor) || '不明'
	];

	return `${parts.join('_')}.pdf`;
}

/**
 * 勘定科目タイプから書類の種類を推測
 */
export function suggestDocumentType(accountType: Account['type'] | null): DocumentType {
	if (!accountType) return 'other';

	switch (accountType) {
		case 'expense':
			return 'receipt'; // 費用系 → 領収書
		case 'revenue':
			return 'invoice'; // 収益系 → 請求書（発行）
		default:
			return 'other';
	}
}

/**
 * 添付ファイルのパラメータ
 */
export interface AttachmentParams {
	file: File;
	documentDate: string;
	documentType: DocumentType;
	generatedName: string;
	year: number; // 保存先の年度ディレクトリ
}

// ==================== 設定関連 ====================

/**
 * 設定値を取得
 */
export async function getSetting<T>(key: string): Promise<T | undefined> {
	const record = await db.settings.get(key);
	return record?.value as T | undefined;
}

/**
 * 設定値を保存
 */
export async function setSetting<T>(key: string, value: T): Promise<void> {
	await db.settings.put({
		key,
		value,
		updatedAt: new Date().toISOString()
	});
}

/**
 * 現在の保存モードを取得
 */
export async function getStorageMode(): Promise<StorageType> {
	const mode = await getSetting<StorageType>('storageMode');
	return mode ?? 'indexeddb';
}

/**
 * 保存モードを設定
 */
export async function setStorageMode(mode: StorageType): Promise<void> {
	await setSetting('storageMode', mode);
}

/**
 * ディレクトリハンドルを取得
 */
export async function getDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
	const record = await db.settings.get('directoryHandle');
	return (record?.value as FileSystemDirectoryHandle) ?? null;
}

/**
 * ディレクトリハンドルを保存
 */
export async function saveDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
	await db.settings.put({
		key: 'directoryHandle',
		value: handle,
		updatedAt: new Date().toISOString()
	});
}

/**
 * 最終エクスポート日時を取得
 */
export async function getLastExportedAt(): Promise<string | null> {
	const value = await getSetting<string>('lastExportedAt');
	return value ?? null;
}

/**
 * 最終エクスポート日時を更新
 */
export async function setLastExportedAt(date: string): Promise<void> {
	await setSetting('lastExportedAt', date);
}

/**
 * 未エクスポートの添付ファイル数を取得
 */
export async function getUnexportedAttachmentCount(): Promise<number> {
	const journals = await db.journals.toArray();
	let count = 0;
	for (const journal of journals) {
		for (const attachment of journal.attachments) {
			if (attachment.storageType === 'indexeddb' && !attachment.exportedAt) {
				count++;
			}
		}
	}
	return count;
}

// ==================== 容量管理関連 ====================

/**
 * 自動Blob削除設定を取得
 */
export async function getAutoPurgeBlobSetting(): Promise<boolean> {
	const value = await getSetting<boolean>('autoPurgeBlobAfterExport');
	return value ?? true; // デフォルト: true
}

/**
 * 自動Blob削除設定を保存
 */
export async function setAutoPurgeBlobSetting(enabled: boolean): Promise<void> {
	await setSetting('autoPurgeBlobAfterExport', enabled);
}

/**
 * Blob保持日数を取得
 */
export async function getBlobRetentionDays(): Promise<number> {
	const value = await getSetting<number>('blobRetentionDays');
	return value ?? 30; // デフォルト: 30日
}

/**
 * Blob保持日数を保存
 */
export async function setBlobRetentionDays(days: number): Promise<void> {
	await setSetting('blobRetentionDays', days);
}

/**
 * 削除可能なBlob（エクスポート済みで保持期間を過ぎたもの）の数を取得
 */
export async function getPurgeableBlobCount(): Promise<number> {
	const retentionDays = await getBlobRetentionDays();
	const now = new Date();
	const retentionMs = retentionDays * 24 * 60 * 60 * 1000;

	const journals = await db.journals.toArray();
	let count = 0;

	for (const journal of journals) {
		for (const attachment of journal.attachments) {
			if (
				attachment.storageType === 'indexeddb' &&
				attachment.exportedAt &&
				attachment.blob &&
				!attachment.blobPurgedAt
			) {
				const exportedAt = new Date(attachment.exportedAt);
				if (now.getTime() - exportedAt.getTime() >= retentionMs) {
					count++;
				}
			}
		}
	}

	return count;
}

/**
 * エクスポート済みのBlobを削除（容量節約）
 * @returns 削除した件数
 */
export async function purgeExportedBlobs(): Promise<number> {
	const retentionDays = await getBlobRetentionDays();
	const now = new Date();
	const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
	const purgedAt = now.toISOString();

	const journals = await db.journals.toArray();
	let purgedCount = 0;

	for (const journal of journals) {
		let modified = false;
		const updatedAttachments = journal.attachments.map((attachment) => {
			if (
				attachment.storageType === 'indexeddb' &&
				attachment.exportedAt &&
				attachment.blob &&
				!attachment.blobPurgedAt
			) {
				const exportedAt = new Date(attachment.exportedAt);
				if (now.getTime() - exportedAt.getTime() >= retentionMs) {
					modified = true;
					purgedCount++;
					// Blobを削除し、削除日時を記録
					// eslint-disable-next-line @typescript-eslint/no-unused-vars
					const { blob, ...rest } = attachment;
					return { ...rest, blobPurgedAt: purgedAt };
				}
			}
			return attachment;
		});

		if (modified) {
			await db.journals.update(journal.id, {
				attachments: updatedAttachments,
				updatedAt: purgedAt
			});
		}
	}

	return purgedCount;
}

/**
 * すべてのエクスポート済みBlobを即座に削除（容量節約）
 * 保持期間を無視して即座に削除
 * @returns 削除した件数
 */
export async function purgeAllExportedBlobs(): Promise<number> {
	const now = new Date().toISOString();

	const journals = await db.journals.toArray();
	let purgedCount = 0;

	for (const journal of journals) {
		let modified = false;
		const updatedAttachments = journal.attachments.map((attachment) => {
			if (
				attachment.storageType === 'indexeddb' &&
				attachment.exportedAt &&
				attachment.blob &&
				!attachment.blobPurgedAt
			) {
				modified = true;
				purgedCount++;
				// Blobを削除し、削除日時を記録
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				const { blob, ...rest } = attachment;
				return { ...rest, blobPurgedAt: now };
			}
			return attachment;
		});

		if (modified) {
			await db.journals.update(journal.id, {
				attachments: updatedAttachments,
				updatedAt: now
			});
		}
	}

	return purgedCount;
}

/**
 * 添付ファイルのBlobが削除済みかチェック
 */
export function isAttachmentBlobPurged(attachment: Attachment): boolean {
	return attachment.storageType === 'indexeddb' && !!attachment.blobPurgedAt;
}

/**
 * 仕訳に添付ファイルを追加（ハイブリッド保存）
 */
export async function addAttachmentToJournal(
	journalId: string,
	params: AttachmentParams,
	directoryHandle?: FileSystemDirectoryHandle | null
): Promise<Attachment> {
	const journal = await db.journals.get(journalId);
	if (!journal) {
		throw new Error('仕訳が見つかりません');
	}

	const { file, documentDate, documentType, generatedName, year } = params;

	let attachment: Attachment;

	if (directoryHandle) {
		// ファイルシステムに保存
		const { saveFileToDirectory } = await import('$lib/utils/filesystem');
		const filePath = await saveFileToDirectory(directoryHandle, year, generatedName, file);

		attachment = {
			id: crypto.randomUUID(),
			journalEntryId: journalId,
			documentDate,
			documentType,
			originalName: file.name,
			generatedName,
			mimeType: file.type,
			size: file.size,
			storageType: 'filesystem',
			filePath,
			createdAt: new Date().toISOString()
		};
	} else {
		// IndexedDBにBlob保存
		const arrayBuffer = await file.arrayBuffer();
		const blob = new Blob([arrayBuffer], { type: file.type });

		attachment = {
			id: crypto.randomUUID(),
			journalEntryId: journalId,
			documentDate,
			documentType,
			originalName: file.name,
			generatedName,
			mimeType: file.type,
			size: file.size,
			storageType: 'indexeddb',
			blob,
			createdAt: new Date().toISOString()
		};
	}

	// 仕訳を更新
	const updatedAttachments = [...journal.attachments, attachment];
	await db.journals.update(journalId, {
		attachments: updatedAttachments,
		evidenceStatus: 'digital',
		updatedAt: new Date().toISOString()
	});

	return attachment;
}

/**
 * 仕訳から添付ファイルを削除（ハイブリッド対応）
 */
export async function removeAttachmentFromJournal(
	journalId: string,
	attachmentId: string,
	directoryHandle?: FileSystemDirectoryHandle | null
): Promise<void> {
	const journal = await db.journals.get(journalId);
	if (!journal) {
		throw new Error('仕訳が見つかりません');
	}

	// 削除対象の添付ファイルを取得
	const attachmentToRemove = journal.attachments.find((a) => a.id === attachmentId);

	// ファイルシステムから削除（filesystem保存の場合）
	if (attachmentToRemove?.storageType === 'filesystem' && attachmentToRemove.filePath && directoryHandle) {
		const { deleteFileFromDirectory } = await import('$lib/utils/filesystem');
		await deleteFileFromDirectory(directoryHandle, attachmentToRemove.filePath);
	}

	const updatedAttachments = journal.attachments.filter((a) => a.id !== attachmentId);
	const newEvidenceStatus = updatedAttachments.length > 0 ? 'digital' : 'none';

	await db.journals.update(journalId, {
		attachments: updatedAttachments,
		evidenceStatus: newEvidenceStatus,
		updatedAt: new Date().toISOString()
	});
}

/**
 * 添付ファイルのBlobを取得（ハイブリッド対応）
 */
export async function getAttachmentBlob(
	journalId: string,
	attachmentId: string,
	directoryHandle?: FileSystemDirectoryHandle | null
): Promise<Blob | null> {
	const journal = await db.journals.get(journalId);
	if (!journal) return null;

	const attachment = journal.attachments.find((a) => a.id === attachmentId);
	if (!attachment) return null;

	// ファイルシステムから読み込み
	if (attachment.storageType === 'filesystem' && attachment.filePath && directoryHandle) {
		const { readFileFromDirectory } = await import('$lib/utils/filesystem');
		return await readFileFromDirectory(directoryHandle, attachment.filePath);
	}

	// IndexedDBから取得
	return attachment.blob ?? null;
}

// ==================== テストデータ ====================

/**
 * 2024年のダミーデータを生成
 */
export async function seedTestData2024(): Promise<number> {
	const testJournals = [
		{
			date: '2024-01-15',
			vendor: 'Amazon',
			description: 'USBケーブル購入',
			debitCode: '5006', // 消耗品費
			creditCode: '1002', // 普通預金
			amount: 1980
		},
		{
			date: '2024-02-03',
			vendor: 'スターバックス',
			description: '打ち合わせ コーヒー代',
			debitCode: '5008', // 会議費
			creditCode: '1001', // 現金
			amount: 1200
		},
		{
			date: '2024-03-10',
			vendor: 'JR東日本',
			description: '客先訪問 交通費',
			debitCode: '5005', // 旅費交通費
			creditCode: '1001', // 現金
			amount: 580
		},
		{
			date: '2024-04-20',
			vendor: 'ヨドバシカメラ',
			description: 'マウス購入',
			debitCode: '5006', // 消耗品費
			creditCode: '1002', // 普通預金
			amount: 3980
		},
		{
			date: '2024-05-15',
			vendor: '株式会社クライアントA',
			description: 'ウェブサイト制作',
			debitCode: '1003', // 売掛金
			creditCode: '4001', // 売上高
			amount: 330000
		},
		{
			date: '2024-06-01',
			vendor: 'NTTドコモ',
			description: '携帯電話代 5月分',
			debitCode: '5004', // 通信費
			creditCode: '1002', // 普通預金
			amount: 8800
		},
		{
			date: '2024-06-30',
			vendor: '株式会社クライアントA',
			description: 'ウェブサイト制作 入金',
			debitCode: '1002', // 普通預金
			creditCode: '1003', // 売掛金
			amount: 330000
		},
		{
			date: '2024-07-10',
			vendor: 'モノタロウ',
			description: '事務用品購入',
			debitCode: '5006', // 消耗品費
			creditCode: '1002', // 普通預金
			amount: 2450
		},
		{
			date: '2024-08-25',
			vendor: 'さくらインターネット',
			description: 'サーバー代 年間',
			debitCode: '5004', // 通信費
			creditCode: '1002', // 普通預金
			amount: 13200
		},
		{
			date: '2024-09-15',
			vendor: '株式会社クライアントB',
			description: 'システム開発',
			debitCode: '1003', // 売掛金
			creditCode: '4001', // 売上高
			amount: 550000
		},
		{
			date: '2024-10-20',
			vendor: 'Apple',
			description: 'MacBook Air購入',
			debitCode: '1004', // 工具器具備品
			creditCode: '1002', // 普通預金
			amount: 164800
		},
		{
			date: '2024-11-05',
			vendor: '楽天',
			description: '書籍購入',
			debitCode: '5007', // 新聞図書費
			creditCode: '1002', // 普通預金
			amount: 3520
		},
		{
			date: '2024-12-10',
			vendor: '株式会社クライアントB',
			description: 'システム開発 入金',
			debitCode: '1002', // 普通預金
			creditCode: '1003', // 売掛金
			amount: 550000
		},
		{
			date: '2024-12-25',
			vendor: '国税庁',
			description: '予定納税 第2期',
			debitCode: '5010', // 租税公課
			creditCode: '1002', // 普通預金
			amount: 50000
		}
	];

	let count = 0;
	const now = new Date().toISOString();

	for (const data of testJournals) {
		// 取引先を登録
		await ensureVendorExists(data.vendor);

		// 仕訳を登録
		await db.journals.add({
			id: crypto.randomUUID(),
			date: data.date,
			lines: [
				{
					id: crypto.randomUUID(),
					type: 'debit',
					accountCode: data.debitCode,
					amount: data.amount
				},
				{
					id: crypto.randomUUID(),
					type: 'credit',
					accountCode: data.creditCode,
					amount: data.amount
				}
			],
			vendor: data.vendor,
			description: data.description,
			evidenceStatus: Math.random() > 0.5 ? 'digital' : 'none',
			attachments: [],
			createdAt: now,
			updatedAt: now
		});
		count++;
	}

	return count;
}
