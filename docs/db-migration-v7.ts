/**
 * e-shiwake データベース Version 7 マイグレーション
 *
 * 追加内容:
 * - invoices テーブル（請求書）
 * - vendors テーブルの拡張（address, paymentTerms, note, createdAt, updatedAt）
 *
 * 既存の db/index.ts に追加するコード
 */

// ============================================================
// 1. import に追加
// ============================================================

// src/lib/types/index.ts からエクスポートする想定
// import type { Invoice, Vendor } from '$lib/types';

// ============================================================
// 2. EShiwakeDatabase クラスに追加
// ============================================================

/*
class EShiwakeDatabase extends Dexie {
  // 既存のテーブル...
  accounts!: EntityTable<Account, 'code'>;
  vendors!: EntityTable<Vendor, 'id'>;
  journals!: EntityTable<JournalEntry, 'id'>;
  attachments!: EntityTable<Attachment, 'id'>;
  settings!: EntityTable<SettingsRecord, 'key'>;
  fixedAssets!: EntityTable<FixedAsset, 'id'>;
  
  // 追加
  invoices!: EntityTable<Invoice, 'id'>;
  
  // ...
}
*/

// ============================================================
// 3. Version 7 マイグレーション
// ============================================================

/*
// Version 7: 請求書テーブル追加 + 取引先テーブル拡張
this.version(7)
  .stores({
    accounts: 'code, name, type, isSystem',
    vendors: 'id, name',
    journals: 'id, date, vendor, evidenceStatus',
    attachments: 'id, journalEntryId',
    settings: 'key',
    fixedAssets: '&id, name, category, acquisitionDate, status',
    invoices: '&id, invoiceNumber, issueDate, vendorId, status'  // 追加
  })
  .upgrade(async (tx) => {
    const now = new Date().toISOString();
    
    // 既存の取引先に createdAt, updatedAt を追加
    await tx
      .table('vendors')
      .toCollection()
      .modify((vendor: any) => {
        if (!vendor.createdAt) {
          vendor.createdAt = now;
        }
        if (!vendor.updatedAt) {
          vendor.updatedAt = now;
        }
      });
  });
*/

// ============================================================
// 4. 請求書 CRUD 関数
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import type { Invoice, InvoiceInput, InvoiceUpdate, InvoiceItem } from './invoice-types';

// 仮の db オブジェクト（実際は既存の db を使用）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const db: any;

/**
 * 請求書の金額を計算
 */
export function calculateInvoiceAmounts(items: InvoiceItem[]): {
	subtotal: number;
	taxAmount: number;
	total: number;
	taxBreakdown: Invoice['taxBreakdown'];
} {
	let taxable10 = 0;
	let taxable8 = 0;

	for (const item of items) {
		const amount = item.quantity * item.unitPrice;
		if (item.taxRate === 10) {
			taxable10 += amount;
		} else {
			taxable8 += amount;
		}
	}

	const tax10 = Math.floor(taxable10 * 0.1);
	const tax8 = Math.floor(taxable8 * 0.08);

	const subtotal = taxable10 + taxable8;
	const taxAmount = tax10 + tax8;
	const total = subtotal + taxAmount;

	return {
		subtotal,
		taxAmount,
		total,
		taxBreakdown: {
			taxable10,
			tax10,
			taxable8,
			tax8
		}
	};
}

/**
 * 請求書の明細金額を計算（quantity × unitPrice）
 */
export function calculateItemAmount(item: Omit<InvoiceItem, 'amount'>): number {
	return item.quantity * item.unitPrice;
}

/**
 * 全請求書の取得
 */
export async function getAllInvoices(): Promise<Invoice[]> {
	return db.invoices.orderBy('issueDate').reverse().toArray();
}

/**
 * 請求書の取得（ID指定）
 */
export async function getInvoiceById(id: string): Promise<Invoice | undefined> {
	return db.invoices.get(id);
}

/**
 * 請求書の取得（年度別）
 */
export async function getInvoicesByYear(year: number): Promise<Invoice[]> {
	const startDate = `${year}-01-01`;
	const endDate = `${year}-12-31`;

	const invoices = await db.invoices
		.where('issueDate')
		.between(startDate, endDate, true, true)
		.toArray();

	// 発行日降順でソート
	return invoices.sort((a: Invoice, b: Invoice) => b.issueDate.localeCompare(a.issueDate));
}

/**
 * 請求書の取得（取引先別）
 */
export async function getInvoicesByVendor(vendorId: string): Promise<Invoice[]> {
	return db.invoices.where('vendorId').equals(vendorId).reverse().sortBy('issueDate');
}

/**
 * 請求書の取得（ステータス別）
 */
export async function getInvoicesByStatus(status: Invoice['status']): Promise<Invoice[]> {
	return db.invoices.where('status').equals(status).reverse().sortBy('issueDate');
}

/**
 * 請求書の追加
 */
export async function addInvoice(input: InvoiceInput): Promise<string> {
	const now = new Date().toISOString();
	const id = uuidv4();

	// 明細の金額を計算
	const itemsWithAmount = input.items.map((item) => ({
		...item,
		amount: item.quantity * item.unitPrice
	}));

	// 合計金額を計算
	const amounts = calculateInvoiceAmounts(itemsWithAmount);

	const invoice: Invoice = {
		...input,
		id,
		items: itemsWithAmount,
		...amounts,
		createdAt: now,
		updatedAt: now
	};

	await db.invoices.add(invoice);
	return id;
}

/**
 * 請求書の更新
 */
export async function updateInvoice(id: string, updates: InvoiceUpdate): Promise<void> {
	const now = new Date().toISOString();

	// items が更新される場合は金額を再計算
	let calculatedUpdates = { ...updates };

	if (updates.items) {
		const itemsWithAmount = updates.items.map((item) => ({
			...item,
			amount: item.quantity * item.unitPrice
		}));
		const amounts = calculateInvoiceAmounts(itemsWithAmount);
		calculatedUpdates = {
			...updates,
			items: itemsWithAmount,
			...amounts
		};
	}

	await db.invoices.update(id, {
		...calculatedUpdates,
		updatedAt: now
	});
}

/**
 * 請求書の削除
 */
export async function deleteInvoice(id: string): Promise<void> {
	await db.invoices.delete(id);
}

/**
 * 次の請求書番号を生成
 * 形式: YYMM + 連番2桁（例: 26020 1 → 260201）
 */
export async function generateNextInvoiceNumber(): Promise<string> {
	const now = new Date();
	const prefix = now.toISOString().slice(2, 4) + now.toISOString().slice(5, 7);

	// 同じ月の請求書を取得
	const yearMonth = now.toISOString().slice(0, 7); // "2026-01"
	const invoices = await db.invoices.where('issueDate').startsWith(yearMonth).toArray();

	// 同じプレフィックスの請求書番号から最大値を取得
	const numbers = invoices
		.map((inv: Invoice) => inv.invoiceNumber)
		.filter((num: string) => num.startsWith(prefix))
		.map((num: string) => parseInt(num.slice(4), 10))
		.filter((n: number) => !isNaN(n));

	const nextSeq = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;

	return `${prefix}${String(nextSeq).padStart(2, '0')}`;
}

// ============================================================
// 5. 取引先 CRUD 関数（拡張版）
// ============================================================

import type { Vendor, VendorInput, VendorUpdate } from './invoice-types';

/**
 * 全取引先の取得
 */
export async function getAllVendorsExtended(): Promise<Vendor[]> {
	return db.vendors.orderBy('name').toArray();
}

/**
 * 取引先の取得（ID指定）
 */
export async function getVendorById(id: string): Promise<Vendor | undefined> {
	return db.vendors.get(id);
}

/**
 * 取引先の追加
 */
export async function addVendor(input: VendorInput): Promise<string> {
	const now = new Date().toISOString();
	const id = uuidv4();

	const vendor: Vendor = {
		...input,
		id,
		createdAt: now,
		updatedAt: now
	};

	await db.vendors.add(vendor);
	return id;
}

/**
 * 取引先の更新
 */
export async function updateVendor(id: string, updates: VendorUpdate): Promise<void> {
	const now = new Date().toISOString();
	await db.vendors.update(id, {
		...updates,
		updatedAt: now
	});
}

/**
 * 取引先の削除
 * 請求書で使用中の場合はエラー
 */
export async function deleteVendor(id: string): Promise<void> {
	// 使用中チェック
	const invoiceCount = await db.invoices.where('vendorId').equals(id).count();
	if (invoiceCount > 0) {
		throw new Error('この取引先は請求書で使用されているため削除できません');
	}

	await db.vendors.delete(id);
}

/**
 * 取引先が請求書で使用中かチェック
 */
export async function isVendorInUseByInvoice(id: string): Promise<boolean> {
	const count = await db.invoices.where('vendorId').equals(id).count();
	return count > 0;
}

// ============================================================
// 6. 設定キーの追加（SettingsKey に追加）
// ============================================================

/*
// src/lib/types/index.ts の SettingsKey に追加
export type SettingsKey = 
  | 'storageType'
  | 'outputDirectoryHandle'
  | 'businessInfo'           // 追加: 事業者情報
  | 'lastInvoiceNumber';     // 追加: 最後の請求書番号（採番用）

// SettingsValueMap にも追加
export interface SettingsValueMap {
  storageType: StorageType;
  outputDirectoryHandle: FileSystemDirectoryHandle | null;
  businessInfo: BusinessInfo;           // 追加
  lastInvoiceNumber: string;            // 追加
}
*/
