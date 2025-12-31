/**
 * ストレージ容量管理ユーティリティ
 * IndexedDBの容量監視とBlob削除機能
 */

import type { JournalEntry, StorageUsage } from '$lib/types';

// 推奨上限（500MB）- iPad/Safariの1GB制限に対して余裕を持たせる
export const RECOMMENDED_QUOTA = 500 * 1024 * 1024;

// 警告しきい値（80%）
export const WARNING_THRESHOLD = 80;

/**
 * ストレージ使用状況を取得
 */
export async function getStorageUsage(): Promise<StorageUsage> {
	if ('storage' in navigator && 'estimate' in navigator.storage) {
		try {
			const estimate = await navigator.storage.estimate();
			const used = estimate.usage || 0;
			const quota = estimate.quota || 0;
			const percentage = quota > 0 ? (used / quota) * 100 : 0;

			return { used, quota, percentage };
		} catch {
			// APIが利用できない場合
			return { used: 0, quota: 0, percentage: 0 };
		}
	}

	// フォールバック: 計算不可
	return { used: 0, quota: 0, percentage: 0 };
}

/**
 * 推奨上限に対する使用率を計算
 */
export function getRecommendedUsagePercentage(used: number): number {
	return (used / RECOMMENDED_QUOTA) * 100;
}

/**
 * バイト数を人間が読みやすい形式に変換
 */
export function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B';

	const units = ['B', 'KB', 'MB', 'GB'];
	const k = 1024;
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return `${(bytes / Math.pow(k, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/**
 * 容量警告が必要かチェック
 */
export function shouldShowStorageWarning(usage: StorageUsage): boolean {
	const recommendedPercentage = getRecommendedUsagePercentage(usage.used);
	return recommendedPercentage >= WARNING_THRESHOLD;
}

/**
 * 削除可能なBlob（エクスポート済みで保持期間を過ぎたもの）の数を取得
 */
export function getPurgeableAttachmentCount(
	journals: JournalEntry[],
	retentionDays: number
): number {
	const now = new Date();
	const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
	let count = 0;

	for (const journal of journals) {
		for (const attachment of journal.attachments || []) {
			// IndexedDBに保存されていて、エクスポート済みで、Blobがまだある場合
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
