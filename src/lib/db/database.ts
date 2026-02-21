import Dexie, { type EntityTable } from 'dexie';
import type {
	Account,
	Vendor,
	JournalEntry,
	Attachment,
	SettingsKey,
	SettingsValueMap
} from '$lib/types';
import type { FixedAsset } from '$lib/types/blue-return-types';
import type { Invoice } from '$lib/types/invoice';
import { defaultAccounts, getDefaultTaxCategory } from './seed';

/**
 * 設定レコード（キーバリュー形式）
 */
export type SettingsRecord = {
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
	fixedAssets!: EntityTable<FixedAsset, 'id'>;
	invoices!: EntityTable<Invoice, 'id'>;

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

		// Version 4: 家事按分設定
		this.version(4)
			.stores({
				accounts: 'code, name, type, isSystem',
				vendors: 'id, name',
				journals: 'id, date, vendor, evidenceStatus',
				attachments: 'id, journalEntryId',
				settings: 'key'
			})
			.upgrade(async (tx) => {
				// 家事按分対象の勘定科目コードと按分率
				const businessRatioSettings: Record<string, number> = {
					'5004': 20, // 水道光熱費
					'5006': 50, // 通信費
					'5012': 30, // 減価償却費
					'5017': 30 // 地代家賃
				};

				// 既存の勘定科目に家事按分設定を追加
				await tx
					.table('accounts')
					.toCollection()
					.modify((account: Account) => {
						if (account.code in businessRatioSettings) {
							account.businessRatioEnabled = true;
							account.defaultBusinessRatio = businessRatioSettings[account.code];
						}
					});
			});

		// Version 5: 家事按分のデフォルト値を削除（ユーザー自身が設定する方式に変更）
		this.version(5)
			.stores({
				accounts: 'code, name, type, isSystem',
				vendors: 'id, name',
				journals: 'id, date, vendor, evidenceStatus',
				attachments: 'id, journalEntryId',
				settings: 'key'
			})
			.upgrade(async (tx) => {
				// Version 4で設定されたデフォルト値をリセット
				const accountsToReset = ['5004', '5006', '5012', '5017'];

				await tx
					.table('accounts')
					.toCollection()
					.modify((account: Account) => {
						if (accountsToReset.includes(account.code)) {
							account.businessRatioEnabled = undefined;
							account.defaultBusinessRatio = undefined;
						}
					});
			});

		// Version 6: 固定資産台帳テーブルを追加
		this.version(6).stores({
			accounts: 'code, name, type, isSystem',
			vendors: 'id, name',
			journals: 'id, date, vendor, evidenceStatus',
			attachments: 'id, journalEntryId',
			settings: 'key',
			fixedAssets: '&id, name, category, acquisitionDate, status'
		});

		// Version 7: 請求書テーブルを追加、取引先にタイムスタンプ追加
		this.version(7)
			.stores({
				accounts: 'code, name, type, isSystem',
				vendors: 'id, name',
				journals: 'id, date, vendor, evidenceStatus',
				attachments: 'id, journalEntryId',
				settings: 'key',
				fixedAssets: '&id, name, category, acquisitionDate, status',
				invoices: '&id, invoiceNumber, issueDate, vendorId, status'
			})
			.upgrade(async (tx) => {
				const now = new Date().toISOString();
				// 既存の取引先に updatedAt を追加
				await tx
					.table('vendors')
					.toCollection()
					.modify((vendor: Vendor) => {
						if (!vendor.updatedAt) {
							vendor.updatedAt = vendor.createdAt || now;
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
