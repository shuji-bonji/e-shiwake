import type { FixedAsset } from '$lib/types/blue-return-types';
import { db } from './database';

// ==================== 固定資産台帳関連 ====================

/**
 * 全固定資産の取得（取得日降順）
 */
export async function getAllFixedAssets(): Promise<FixedAsset[]> {
	return db.fixedAssets.orderBy('acquisitionDate').reverse().toArray();
}

/**
 * アクティブな固定資産のみ取得
 */
export async function getActiveFixedAssets(): Promise<FixedAsset[]> {
	return db.fixedAssets.where('status').equals('active').toArray();
}

/**
 * 固定資産の取得（ID指定）
 */
export async function getFixedAssetById(id: string): Promise<FixedAsset | undefined> {
	return db.fixedAssets.get(id);
}

/**
 * 固定資産の追加
 */
export async function addFixedAsset(
	asset: Omit<FixedAsset, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
	const id = crypto.randomUUID();
	const now = new Date().toISOString();
	await db.fixedAssets.add({
		...asset,
		id,
		createdAt: now,
		updatedAt: now
	});
	return id;
}

/**
 * 固定資産の更新
 */
export async function updateFixedAsset(
	id: string,
	updates: Partial<Omit<FixedAsset, 'id' | 'createdAt'>>
): Promise<void> {
	await db.fixedAssets.update(id, {
		...updates,
		updatedAt: new Date().toISOString()
	});
}

/**
 * 固定資産の削除
 */
export async function deleteFixedAsset(id: string): Promise<void> {
	await db.fixedAssets.delete(id);
}

/**
 * 固定資産を売却済みに変更
 */
export async function markFixedAssetAsSold(id: string, disposalDate: string): Promise<void> {
	await updateFixedAsset(id, {
		status: 'sold',
		disposalDate
	});
}

/**
 * 固定資産を除却済みに変更
 */
export async function markFixedAssetAsDisposed(id: string, disposalDate: string): Promise<void> {
	await updateFixedAsset(id, {
		status: 'disposed',
		disposalDate
	});
}
