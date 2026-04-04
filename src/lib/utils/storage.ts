/**
 * ストレージ容量管理ユーティリティ
 * IndexedDBの容量監視とBlob削除機能
 */

import type { JournalEntry, StorageUsage } from '$lib/types';

/** 推奨上限（500MB）- iPad/Safariの1GB制限に対して余裕を持たせる */
export const RECOMMENDED_QUOTA = 500 * 1024 * 1024;

/** 警告しきい値（80%） */
export const WARNING_THRESHOLD = 80;

/**
 * IndexedDBとブラウザキャッシュのストレージ使用状況を取得
 *
 * @returns ストレージ使用状況（used: 使用量バイト、quota: 割り当て量バイト、percentage: 使用率%）
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
 *
 * @param used - 使用量（バイト）
 * @returns 推奨上限に対する使用率（%）
 */
export function getRecommendedUsagePercentage(used: number): number {
	return (used / RECOMMENDED_QUOTA) * 100;
}

/**
 * バイト数を人間が読みやすい形式に変換（B/KB/MB/GB）
 *
 * @param bytes - バイト数
 * @returns フォーマット済みの文字列（例：「25.5 MB」）
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
 *
 * @param usage - ストレージ使用状況
 * @returns 推奨上限の80%以上を使用している場合true
 */
export function shouldShowStorageWarning(usage: StorageUsage): boolean {
	const recommendedPercentage = getRecommendedUsagePercentage(usage.used);
	return recommendedPercentage >= WARNING_THRESHOLD;
}

/**
 * 削除可能なBlob（エクスポート済みで保持期間を過ぎたもの）の数を取得
 * IndexedDBに保存されていて、かつエクスポート済みで、保持期間を超えた証憑をカウント
 *
 * @param journals - 仕訳配列
 * @param retentionDays - 保持期間（日数）。この期間を超えたBlob削除対象にする
 * @returns 削除可能なBlob数
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
