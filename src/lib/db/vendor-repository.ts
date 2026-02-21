import type { Vendor } from '$lib/types';
import { db } from './database';

// ==================== 取引先関連（基本） ====================

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

// ==================== 取引先関連（拡張） ====================

/**
 * 取引先の取得（ID指定）
 */
export async function getVendorById(id: string): Promise<Vendor | undefined> {
	return db.vendors.get(id);
}

/**
 * 取引先の追加（詳細情報付き）
 */
export async function addVendorWithDetails(
	vendor: Omit<Vendor, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
	const id = crypto.randomUUID();
	const now = new Date().toISOString();

	await db.vendors.add({
		...vendor,
		id,
		createdAt: now,
		updatedAt: now
	});

	return id;
}

/**
 * 取引先の更新
 */
export async function updateVendor(
	id: string,
	updates: Partial<Omit<Vendor, 'id' | 'createdAt'>>
): Promise<void> {
	await db.vendors.update(id, {
		...updates,
		updatedAt: new Date().toISOString()
	});
}

/**
 * 取引先が請求書で使用されているかチェック
 */
export async function isVendorInUseByInvoice(vendorId: string): Promise<boolean> {
	const invoice = await db.invoices.where('vendorId').equals(vendorId).first();
	return !!invoice;
}

/**
 * 取引先が仕訳で使用されているかチェック
 */
export async function isVendorInUseByJournal(vendorId: string): Promise<boolean> {
	const vendor = await db.vendors.get(vendorId);
	if (!vendor) return false;

	const journal = await db.journals.filter((j) => j.vendor === vendor.name).first();
	return !!journal;
}

/**
 * 取引先の削除（使用中の場合はエラー）
 */
export async function deleteVendor(id: string): Promise<void> {
	// 請求書で使用されているかチェック
	const inUseByInvoice = await isVendorInUseByInvoice(id);
	if (inUseByInvoice) {
		throw new Error('この取引先は請求書で使用されているため削除できません');
	}

	// 仕訳で使用されているかチェック
	const inUseByJournal = await isVendorInUseByJournal(id);
	if (inUseByJournal) {
		throw new Error('この取引先は仕訳で使用されているため削除できません');
	}

	await db.vendors.delete(id);
}
