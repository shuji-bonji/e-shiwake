import Dexie, { type EntityTable } from 'dexie';
import type {
	Account,
	Vendor,
	JournalEntry,
	Attachment,
	DocumentType,
	StorageType,
	ExportData,
	SettingsKey,
	SettingsValueMap
} from '$lib/types';
import { defaultAccounts, getDefaultTaxCategory } from './seed';

/**
 * 設定レコード（キーバリュー形式）
 */
type SettingsRecord = {
	[K in SettingsKey]: {
		key: K;
		value: SettingsValueMap[K];
		updatedAt: string;
	};
}[SettingsKey];

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

		// Version 3: 消費税区分対応
		this.version(3)
			.stores({
				accounts: 'code, name, type, isSystem',
				vendors: 'id, name',
				journals: 'id, date, vendor, evidenceStatus',
				attachments: 'id, journalEntryId',
				settings: 'key'
			})
			.upgrade(async (tx) => {
				// 既存の勘定科目にデフォルト消費税区分を設定
				await tx
					.table('accounts')
					.toCollection()
					.modify((account: Account) => {
						if (!account.defaultTaxCategory) {
							account.defaultTaxCategory = getDefaultTaxCategory(account.type, account.code);
						}
					});
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
	// createdAtが欠けている場合に備えて防御的に比較
	return journals.sort((a, b) => {
		const dateCompare = (b.date || '').localeCompare(a.date || '');
		if (dateCompare !== 0) return dateCompare;
		const aCreatedAt = a.createdAt || a.updatedAt || '';
		const bCreatedAt = b.createdAt || b.updatedAt || '';
		return bCreatedAt.localeCompare(aCreatedAt);
	});
}

/**
 * 全年度の仕訳を取得（日付降順）
 * 検索時の全年度横断検索用
 */
export async function getAllJournals(): Promise<JournalEntry[]> {
	const journals = await db.journals.toArray();

	// 日付降順（新しい順）でソート、同日内は作成日時降順
	return journals.sort((a, b) => {
		const dateCompare = (b.date || '').localeCompare(a.date || '');
		if (dateCompare !== 0) return dateCompare;
		const aCreatedAt = a.createdAt || a.updatedAt || '';
		const bCreatedAt = b.createdAt || b.updatedAt || '';
		return bCreatedAt.localeCompare(aCreatedAt);
	});
}

/**
 * 利用可能な年度の取得（仕訳データから抽出）
 * 現在年度は常に含める（新規仕訳追加のため）
 */
export async function getAvailableYears(): Promise<number[]> {
	const currentYear = new Date().getFullYear();
	const journals = await db.journals.toArray();

	// 現在年度は常に含める
	const years = new Set<number>([currentYear]);

	// 仕訳の日付から年度を抽出
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
		await saveVendor(journal.vendor);
	}

	return id;
}

/**
 * 仕訳の更新
 * 注意: 取引先の自動登録は行わない（blurタイミングで別途saveVendorを呼ぶ）
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
}

/**
 * 仕訳の削除（添付ファイルも削除）
 */
export async function deleteJournal(
	id: string,
	directoryHandle?: FileSystemDirectoryHandle | null
): Promise<void> {
	// 仕訳を取得
	const journal = await db.journals.get(id);
	if (!journal) {
		return; // 既に削除済み
	}

	// 添付ファイルをファイルシステムから削除
	if (directoryHandle && journal.attachments.length > 0) {
		const { deleteFileFromDirectory } = await import('$lib/utils/filesystem');
		for (const attachment of journal.attachments) {
			if (attachment.storageType === 'filesystem' && attachment.filePath) {
				try {
					await deleteFileFromDirectory(directoryHandle, attachment.filePath);
				} catch (error) {
					console.warn(`添付ファイルの削除に失敗: ${attachment.filePath}`, error);
				}
			}
		}
	}

	// 仕訳を削除
	await db.journals.delete(id);
}

/**
 * 年度の全データを削除
 * 仕訳とそれに紐づく添付ファイルを削除
 */
export async function deleteYearData(
	year: number
): Promise<{ journalCount: number; attachmentCount: number }> {
	// 対象年度の仕訳を取得
	const startDate = `${year}-01-01`;
	const endDate = `${year}-12-31`;

	const journals = await db.journals
		.where('date')
		.between(startDate, endDate, true, true)
		.toArray();

	let attachmentCount = 0;

	// 仕訳ごとに添付ファイルを削除
	for (const journal of journals) {
		for (const attachment of journal.attachments) {
			await db.attachments.delete(attachment.id);
			attachmentCount++;
		}
	}

	// 仕訳を削除
	const journalIds = journals.map((j) => j.id);
	await db.journals.bulkDelete(journalIds);

	return { journalCount: journals.length, attachmentCount };
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
 * 空文字や空白のみの場合は何もしない
 */
export async function saveVendor(name: string): Promise<void> {
	const trimmed = name.trim();
	if (!trimmed) return;

	const existing = await db.vendors.where('name').equals(trimmed).first();
	if (!existing) {
		await db.vendors.add({
			id: crypto.randomUUID(),
			name: trimmed,
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
 * 形式: {書類の日付}_{種類}_{摘要}_{金額}円_{取引先名}.pdf
 */
export function generateAttachmentName(
	documentDate: string,
	documentType: DocumentType,
	description: string,
	amount: number,
	vendor: string
): string {
	// ファイル名に使えない文字を置換
	const sanitize = (str: string) => str.replace(/[\\/:*?"<>|]/g, '_').trim();

	const parts = [
		documentDate,
		DocumentTypeShortLabels[documentType],
		sanitize(description) || '未分類',
		`${amount.toLocaleString('ja-JP')}円`,
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
	// ファイル名生成用メタデータ
	description: string;
	amount: number;
	vendor: string;
}

// ==================== 設定関連 ====================

/**
 * 設定値を取得
 */
export async function getSetting<K extends SettingsKey>(
	key: K
): Promise<SettingsValueMap[K] | undefined> {
	const record = await db.settings.get(key);
	return record ? (record.value as SettingsValueMap[K]) : undefined;
}

/**
 * 設定値を保存
 */
export async function setSetting<K extends SettingsKey>(
	key: K,
	value: SettingsValueMap[K]
): Promise<void> {
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
	const mode = await getSetting('storageMode');
	return mode ?? 'indexeddb';
}

/**
 * 保存モードを設定
 */
export async function setStorageMode(mode: StorageType): Promise<void> {
	await setSetting('storageMode', mode);
}

// ディレクトリハンドルの操作は $lib/utils/filesystem.ts を使用すること
// キー: 'outputDirectoryHandle', 構造: { key, handle, updatedAt }

/**
 * 最終エクスポート日時を取得
 */
export async function getLastExportedAt(): Promise<string | null> {
	const value = await getSetting('lastExportedAt');
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

/**
 * 添付ファイルをエクスポート済みとしてマーク
 */
export async function markAttachmentAsExported(
	journalId: string,
	attachmentId: string
): Promise<void> {
	const journal = await db.journals.get(journalId);
	if (!journal) return;

	const now = new Date().toISOString();
	const updatedAttachments = journal.attachments.map((att) =>
		att.id === attachmentId ? { ...att, exportedAt: now } : att
	);

	await db.journals.update(journalId, {
		attachments: updatedAttachments,
		updatedAt: now
	});
}

// ==================== 容量管理関連 ====================

/**
 * 自動Blob削除設定を取得
 */
export async function getAutoPurgeBlobSetting(): Promise<boolean> {
	const value = await getSetting('autoPurgeBlobAfterExport');
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
	const value = await getSetting('blobRetentionDays');
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

	const { file, documentDate, documentType, generatedName, year, description, amount, vendor } =
		params;

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
			description,
			amount,
			vendor,
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
			description,
			amount,
			vendor,
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
	if (
		attachmentToRemove?.storageType === 'filesystem' &&
		attachmentToRemove.filePath &&
		directoryHandle
	) {
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

/**
 * 証憑のメタデータを更新してリネーム
 */
export interface AttachmentUpdateParams {
	documentDate?: string;
	documentType?: DocumentType;
	description?: string;
	amount?: number;
	vendor?: string;
}

export async function updateAttachment(
	journalId: string,
	attachmentId: string,
	updates: AttachmentUpdateParams,
	directoryHandle?: FileSystemDirectoryHandle | null
): Promise<Attachment> {
	const journal = await db.journals.get(journalId);
	if (!journal) {
		throw new Error('仕訳が見つかりません');
	}

	const attachmentIndex = journal.attachments.findIndex((a) => a.id === attachmentId);
	if (attachmentIndex === -1) {
		throw new Error('添付ファイルが見つかりません');
	}

	const attachment = journal.attachments[attachmentIndex];

	// 更新後の値をマージ
	const newDocumentDate = updates.documentDate ?? attachment.documentDate;
	const newDocumentType = updates.documentType ?? attachment.documentType;
	const newDescription = updates.description ?? attachment.description;
	const newAmount = updates.amount ?? attachment.amount;
	const newVendor = updates.vendor ?? attachment.vendor;

	// 新しいファイル名を生成
	const newGeneratedName = generateAttachmentName(
		newDocumentDate,
		newDocumentType,
		newDescription,
		newAmount,
		newVendor
	);

	// ファイルシステム保存の場合、実ファイルをリネーム
	let newFilePath = attachment.filePath;
	if (attachment.storageType === 'filesystem' && attachment.filePath && directoryHandle) {
		// ファイル名が変わる場合のみリネーム
		if (newGeneratedName !== attachment.generatedName) {
			const { renameFileInDirectory } = await import('$lib/utils/filesystem');
			newFilePath = await renameFileInDirectory(
				directoryHandle,
				attachment.filePath,
				newGeneratedName
			);
		}
	}

	// 更新された添付ファイル
	const updatedAttachment: Attachment = {
		...attachment,
		documentDate: newDocumentDate,
		documentType: newDocumentType,
		description: newDescription,
		amount: newAmount,
		vendor: newVendor,
		generatedName: newGeneratedName,
		filePath: newFilePath
	};

	// 仕訳の添付ファイルリストを更新
	const updatedAttachments = [...journal.attachments];
	updatedAttachments[attachmentIndex] = updatedAttachment;

	await db.journals.update(journalId, {
		attachments: updatedAttachments,
		updatedAt: new Date().toISOString()
	});

	return updatedAttachment;
}

/**
 * 仕訳のメタデータ変更に連動して証憑を更新
 * 仕訳の日付・摘要・金額・取引先が変わった場合にファイル名も更新
 * 注意: DB保存は行わない（呼び出し元で onupdate を通じて保存）
 */
export async function syncAttachmentsWithJournal(
	currentAttachments: Attachment[],
	updates: {
		date?: string;
		description?: string;
		amount?: number;
		vendor?: string;
	},
	directoryHandle?: FileSystemDirectoryHandle | null
): Promise<Attachment[]> {
	if (currentAttachments.length === 0) {
		return [];
	}

	const updatedAttachments: Attachment[] = [];

	for (const attachment of currentAttachments) {
		// 更新する値をマージ
		const newDocumentDate = updates.date ?? attachment.documentDate;
		const newDescription = updates.description ?? attachment.description;
		const newAmount = updates.amount ?? attachment.amount;
		const newVendor = updates.vendor ?? attachment.vendor;

		// 値が変わっていなければスキップ
		if (
			newDocumentDate === attachment.documentDate &&
			newDescription === attachment.description &&
			newAmount === attachment.amount &&
			newVendor === attachment.vendor
		) {
			updatedAttachments.push(attachment);
			continue;
		}

		// 新しいファイル名を生成
		const newGeneratedName = generateAttachmentName(
			newDocumentDate,
			attachment.documentType,
			newDescription,
			newAmount,
			newVendor
		);

		// ファイルシステム保存の場合、実ファイルをリネーム
		let newFilePath = attachment.filePath;
		if (attachment.storageType === 'filesystem' && attachment.filePath && directoryHandle) {
			if (newGeneratedName !== attachment.generatedName) {
				const { renameFileInDirectory } = await import('$lib/utils/filesystem');
				try {
					newFilePath = await renameFileInDirectory(
						directoryHandle,
						attachment.filePath,
						newGeneratedName
					);
				} catch (error) {
					console.error('ファイルリネームに失敗:', error);
					// リネーム失敗してもメタデータは更新続行
				}
			}
		}

		// 更新された添付ファイル
		const updatedAttachment: Attachment = {
			...attachment,
			documentDate: newDocumentDate,
			description: newDescription,
			amount: newAmount,
			vendor: newVendor,
			generatedName: newGeneratedName,
			filePath: newFilePath
		};

		updatedAttachments.push(updatedAttachment);
	}

	return updatedAttachments;
}

// ==================== インポート関連 ====================

/**
 * インポートモード
 */
export type ImportMode = 'merge' | 'overwrite';

/**
 * インポート結果
 */
export interface ImportResult {
	success: boolean;
	journalsImported: number;
	accountsImported: number;
	vendorsImported: number;
	errors: string[];
}

/**
 * ExportDataの検証
 */
export function validateExportData(data: unknown): data is ExportData {
	if (!data || typeof data !== 'object') {
		return false;
	}

	const d = data as Record<string, unknown>;

	// 必須フィールドのチェック
	if (typeof d.version !== 'string') return false;
	if (typeof d.exportedAt !== 'string') return false;
	if (typeof d.fiscalYear !== 'number') return false;
	if (!Array.isArray(d.journals)) return false;
	if (!Array.isArray(d.accounts)) return false;
	if (!Array.isArray(d.vendors)) return false;

	// 仕訳の必須フィールドをチェック
	for (const journal of d.journals as Record<string, unknown>[]) {
		if (typeof journal.id !== 'string') return false;
		if (typeof journal.date !== 'string') return false;
		if (typeof journal.createdAt !== 'string') return false;
		if (typeof journal.updatedAt !== 'string') return false;
		if (!Array.isArray(journal.lines)) return false;
	}

	return true;
}

/**
 * JSONファイルからデータをインポート
 */
export async function importData(
	data: ExportData,
	mode: ImportMode = 'merge'
): Promise<ImportResult> {
	const result: ImportResult = {
		success: false,
		journalsImported: 0,
		accountsImported: 0,
		vendorsImported: 0,
		errors: []
	};

	try {
		// 上書きモードの場合、既存データを削除
		if (mode === 'overwrite') {
			// 対象年度の仕訳のみ削除
			const startDate = `${data.fiscalYear}-01-01`;
			const endDate = `${data.fiscalYear}-12-31`;
			const existingJournals = await db.journals
				.where('date')
				.between(startDate, endDate, true, true)
				.toArray();

			for (const journal of existingJournals) {
				await db.journals.delete(journal.id);
			}
		}

		// 勘定科目のインポート（ユーザー追加のみ）
		for (const account of data.accounts) {
			// システム科目はスキップ
			if (account.isSystem) continue;

			const existing = await db.accounts.get(account.code);
			if (!existing) {
				// DataCloneError回避のため、明示的にプロパティを指定
				await db.accounts.add({
					code: account.code,
					name: account.name,
					type: account.type,
					isSystem: false,
					createdAt: account.createdAt
				});
				result.accountsImported++;
			} else if (mode === 'overwrite') {
				// 上書きモードでも既存のユーザー科目は更新
				await db.accounts.update(account.code, {
					name: account.name,
					type: account.type
				});
				result.accountsImported++;
			}
		}

		// 取引先のインポート
		for (const vendor of data.vendors) {
			const existing = await db.vendors.where('name').equals(vendor.name).first();
			if (!existing) {
				// 新規追加（IDは新規生成）
				await db.vendors.add({
					id: crypto.randomUUID(),
					name: vendor.name,
					createdAt: vendor.createdAt
				});
				result.vendorsImported++;
			}
		}

		// 仕訳のインポート
		for (const journal of data.journals) {
			const existing = await db.journals.get(journal.id);

			if (!existing) {
				// 新規追加
				// DataCloneError回避のため、明示的にプロパティを指定（スプレッド演算子を避ける）
				const cleanJournal: JournalEntry = {
					id: journal.id,
					date: journal.date,
					lines: (journal.lines || []).map((line) => ({
						id: line.id,
						type: line.type,
						accountCode: line.accountCode,
						amount: line.amount,
						memo: line.memo
					})),
					vendor: journal.vendor,
					description: journal.description,
					evidenceStatus: journal.evidenceStatus,
					attachments: (journal.attachments || []).map((att) => ({
						id: att.id,
						journalEntryId: att.journalEntryId,
						documentDate: att.documentDate,
						documentType: att.documentType,
						originalName: att.originalName,
						generatedName: att.generatedName,
						mimeType: att.mimeType,
						size: att.size,
						description: att.description,
						amount: att.amount,
						vendor: att.vendor,
						storageType: att.storageType,
						filePath: att.filePath,
						exportedAt: att.exportedAt,
						blobPurgedAt: att.blobPurgedAt,
						createdAt: att.createdAt
						// blob は除外（JSONにはないはず）
					})),
					createdAt: journal.createdAt,
					updatedAt: journal.updatedAt
				};
				await db.journals.add(cleanJournal);
				result.journalsImported++;
			} else if (mode === 'overwrite') {
				// 上書きモード: 既存を更新
				const cleanJournal: Partial<JournalEntry> = {
					date: journal.date,
					lines: (journal.lines || []).map((line) => ({
						id: line.id,
						type: line.type,
						accountCode: line.accountCode,
						amount: line.amount,
						memo: line.memo
					})),
					vendor: journal.vendor,
					description: journal.description,
					evidenceStatus: journal.evidenceStatus,
					attachments: (journal.attachments || []).map((att) => ({
						id: att.id,
						journalEntryId: att.journalEntryId,
						documentDate: att.documentDate,
						documentType: att.documentType,
						originalName: att.originalName,
						generatedName: att.generatedName,
						mimeType: att.mimeType,
						size: att.size,
						description: att.description,
						amount: att.amount,
						vendor: att.vendor,
						storageType: att.storageType,
						filePath: att.filePath,
						exportedAt: att.exportedAt,
						blobPurgedAt: att.blobPurgedAt,
						createdAt: att.createdAt
					})),
					updatedAt: journal.updatedAt
				};
				await db.journals.update(journal.id, cleanJournal);
				result.journalsImported++;
			}
			// mergeモードで既存がある場合はスキップ
		}

		result.success = true;
	} catch (error) {
		result.errors.push(error instanceof Error ? error.message : '不明なエラー');
	}

	return result;
}

/**
 * インポート後に証憑のBlobデータを復元
 * ZIPインポート時に使用
 */
export async function restoreAttachmentBlobs(
	attachmentBlobs: Map<string, Blob>,
	storageMode: StorageType,
	directoryHandle?: FileSystemDirectoryHandle | null,
	onProgress?: (current: number, total: number) => void
): Promise<{ restored: number; failed: number; errors: string[] }> {
	const result = { restored: 0, failed: 0, errors: [] as string[] };
	const total = attachmentBlobs.size;
	let current = 0;

	// 全仕訳を取得して証憑を探す
	const journals = await db.journals.toArray();

	for (const [attachmentId, blob] of attachmentBlobs) {
		current++;
		onProgress?.(current, total);

		// この証憑が属する仕訳を検索
		let targetJournal: JournalEntry | undefined;
		let targetAttachment: Attachment | undefined;

		for (const journal of journals) {
			const attachment = journal.attachments.find((a) => a.id === attachmentId);
			if (attachment) {
				targetJournal = journal;
				targetAttachment = attachment;
				break;
			}
		}

		if (!targetJournal || !targetAttachment) {
			result.failed++;
			result.errors.push(`証憑ID ${attachmentId} に対応する仕訳が見つかりません`);
			continue;
		}

		try {
			if (storageMode === 'filesystem' && directoryHandle) {
				// ファイルシステムに保存
				const { saveFileToDirectory } = await import('$lib/utils/filesystem');
				const year = parseInt(targetAttachment.documentDate.substring(0, 4), 10);
				const file = new File([blob], targetAttachment.generatedName, {
					type: targetAttachment.mimeType
				});
				const filePath = await saveFileToDirectory(
					directoryHandle,
					year,
					targetAttachment.generatedName,
					file
				);

				// 添付ファイル情報を更新
				const updatedAttachments = targetJournal.attachments.map((a) =>
					a.id === attachmentId
						? { ...a, storageType: 'filesystem' as StorageType, filePath, blob: undefined }
						: a
				);
				await db.journals.update(targetJournal.id, { attachments: updatedAttachments });
			} else {
				// IndexedDB に Blob 保存
				const updatedAttachments = targetJournal.attachments.map((a) =>
					a.id === attachmentId
						? {
								...a,
								storageType: 'indexeddb' as StorageType,
								blob,
								filePath: undefined,
								blobPurgedAt: undefined
							}
						: a
				);
				await db.journals.update(targetJournal.id, { attachments: updatedAttachments });
			}
			result.restored++;
		} catch (error) {
			result.failed++;
			result.errors.push(
				`${targetAttachment.generatedName}: ${error instanceof Error ? error.message : '不明なエラー'}`
			);
		}
	}

	return result;
}

/**
 * インポート前のプレビュー情報を取得
 */
export async function getImportPreview(data: ExportData): Promise<{
	fiscalYear: number;
	journalCount: number;
	newJournalCount: number;
	accountCount: number;
	newAccountCount: number;
	vendorCount: number;
	newVendorCount: number;
}> {
	// 既存の仕訳ID一覧
	const existingJournalIds = new Set((await db.journals.toArray()).map((j) => j.id));

	// 既存の勘定科目コード一覧
	const existingAccountCodes = new Set((await db.accounts.toArray()).map((a) => a.code));

	// 既存の取引先名一覧
	const existingVendorNames = new Set((await db.vendors.toArray()).map((v) => v.name));

	// 新規追加される件数をカウント
	const newJournals = data.journals.filter((j) => !existingJournalIds.has(j.id));
	const newAccounts = data.accounts.filter((a) => !a.isSystem && !existingAccountCodes.has(a.code));
	const newVendors = data.vendors.filter((v) => !existingVendorNames.has(v.name));

	return {
		fiscalYear: data.fiscalYear,
		journalCount: data.journals.length,
		newJournalCount: newJournals.length,
		accountCount: data.accounts.filter((a) => !a.isSystem).length,
		newAccountCount: newAccounts.length,
		vendorCount: data.vendors.length,
		newVendorCount: newVendors.length
	};
}

// ==================== ストレージマイグレーション ====================

/**
 * マイグレーション対象の添付ファイル情報
 */
export interface MigrationAttachment {
	journalId: string;
	attachmentId: string;
	attachment: Attachment;
	year: number;
}

/**
 * マイグレーション対象の添付ファイルを取得
 * @param targetStorageType 移行先のストレージタイプ
 */
export async function getAttachmentsForMigration(
	targetStorageType: StorageType
): Promise<MigrationAttachment[]> {
	const journals = await db.journals.toArray();
	const result: MigrationAttachment[] = [];

	for (const journal of journals) {
		const year = parseInt(journal.date.substring(0, 4), 10);

		for (const attachment of journal.attachments) {
			// 移行先と異なるストレージタイプのものを収集
			if (targetStorageType === 'filesystem') {
				// IndexedDB → Filesystem: Blobがあるもの
				if (attachment.storageType === 'indexeddb' && attachment.blob) {
					result.push({
						journalId: journal.id,
						attachmentId: attachment.id,
						attachment,
						year
					});
				}
			} else {
				// Filesystem → IndexedDB: filePathがあるもの
				if (attachment.storageType === 'filesystem' && attachment.filePath) {
					result.push({
						journalId: journal.id,
						attachmentId: attachment.id,
						attachment,
						year
					});
				}
			}
		}
	}

	return result;
}

/**
 * 単一の添付ファイルをFilesystemに移行
 */
export async function migrateAttachmentToFilesystem(
	item: MigrationAttachment,
	directoryHandle: FileSystemDirectoryHandle
): Promise<void> {
	const { saveFileToDirectory } = await import('$lib/utils/filesystem');

	const journal = await db.journals.get(item.journalId);
	if (!journal) return;

	const attachment = journal.attachments.find((a) => a.id === item.attachmentId);
	if (!attachment || !attachment.blob) return;

	// Blobをファイルとして保存
	const filePath = await saveFileToDirectory(
		directoryHandle,
		item.year,
		attachment.generatedName,
		attachment.blob
	);

	// 添付ファイルを更新（Blobを削除し、filePathを設定）
	const updatedAttachments = journal.attachments.map((a) => {
		if (a.id === item.attachmentId) {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { blob, exportedAt, blobPurgedAt, ...rest } = a;
			return {
				...rest,
				storageType: 'filesystem' as StorageType,
				filePath
			};
		}
		return a;
	});

	await db.journals.update(item.journalId, {
		attachments: updatedAttachments,
		updatedAt: new Date().toISOString()
	});
}

/**
 * 単一の添付ファイルをIndexedDBに移行
 */
export async function migrateAttachmentToIndexedDB(
	item: MigrationAttachment,
	directoryHandle: FileSystemDirectoryHandle
): Promise<void> {
	const { readFileFromDirectory, deleteFileFromDirectory } = await import('$lib/utils/filesystem');

	const journal = await db.journals.get(item.journalId);
	if (!journal) return;

	const attachment = journal.attachments.find((a) => a.id === item.attachmentId);
	if (!attachment || !attachment.filePath) return;

	// ファイルを読み込んでBlobに変換
	const blob = await readFileFromDirectory(directoryHandle, attachment.filePath);
	if (!blob) {
		throw new Error(`ファイルが見つかりません: ${attachment.filePath}`);
	}

	// 添付ファイルを更新（filePathを削除し、Blobを設定）
	const updatedAttachments = journal.attachments.map((a) => {
		if (a.id === item.attachmentId) {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { filePath, ...rest } = a;
			return {
				...rest,
				storageType: 'indexeddb' as StorageType,
				blob
			};
		}
		return a;
	});

	await db.journals.update(item.journalId, {
		attachments: updatedAttachments,
		updatedAt: new Date().toISOString()
	});

	// 元のファイルを削除
	await deleteFileFromDirectory(directoryHandle, attachment.filePath);
}

/**
 * ファイルシステムに保存されている添付ファイルの数を取得
 */
export async function getFilesystemAttachmentCount(): Promise<number> {
	const journals = await db.journals.toArray();
	let count = 0;

	for (const journal of journals) {
		for (const attachment of journal.attachments) {
			if (attachment.storageType === 'filesystem' && attachment.filePath) {
				count++;
			}
		}
	}

	return count;
}

/**
 * フォルダ間で添付ファイルを移行する情報を取得
 */
export interface FolderMigrationItem {
	journalId: string;
	attachmentId: string;
	filePath: string;
	generatedName: string;
	year: number;
}

/**
 * フォルダ間移行対象の添付ファイルを取得
 */
export async function getAttachmentsForFolderMigration(): Promise<FolderMigrationItem[]> {
	const journals = await db.journals.toArray();
	const result: FolderMigrationItem[] = [];

	for (const journal of journals) {
		const year = parseInt(journal.date.substring(0, 4), 10);

		for (const attachment of journal.attachments) {
			if (attachment.storageType === 'filesystem' && attachment.filePath) {
				result.push({
					journalId: journal.id,
					attachmentId: attachment.id,
					filePath: attachment.filePath,
					generatedName: attachment.generatedName,
					year
				});
			}
		}
	}

	return result;
}

/**
 * 単一の添付ファイルを新しいフォルダに移行
 */
export async function migrateAttachmentToNewFolder(
	item: FolderMigrationItem,
	oldDirectoryHandle: FileSystemDirectoryHandle,
	newDirectoryHandle: FileSystemDirectoryHandle
): Promise<void> {
	const { readFileFromDirectory, saveFileToDirectory, deleteFileFromDirectory } =
		await import('$lib/utils/filesystem');

	// 旧フォルダからファイルを読み込む
	const blob = await readFileFromDirectory(oldDirectoryHandle, item.filePath);
	if (!blob) {
		throw new Error(`ファイルが見つかりません: ${item.filePath}`);
	}

	// 新フォルダにファイルを保存
	const newFilePath = await saveFileToDirectory(
		newDirectoryHandle,
		item.year,
		item.generatedName,
		blob
	);

	// DBの添付ファイルパスを更新
	const journal = await db.journals.get(item.journalId);
	if (!journal) return;

	const updatedAttachments = journal.attachments.map((a) => {
		if (a.id === item.attachmentId) {
			return { ...a, filePath: newFilePath };
		}
		return a;
	});

	await db.journals.update(item.journalId, {
		attachments: updatedAttachments,
		updatedAt: new Date().toISOString()
	});

	// 旧フォルダからファイルを削除
	try {
		await deleteFileFromDirectory(oldDirectoryHandle, item.filePath);
	} catch {
		// 削除に失敗しても続行（手動で削除してもらう）
		console.warn(`旧ファイルの削除に失敗: ${item.filePath}`);
	}
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
		await saveVendor(data.vendor);

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
