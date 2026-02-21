import type { Attachment, SettingsKey, SettingsValueMap, StorageType } from '$lib/types';
import { omit } from '$lib/utils';
import { db } from './database';

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
 * 注意: Svelte 5のproxyオブジェクトを完全に除去するため、JSON round-tripを行う
 */
export async function setSetting<K extends SettingsKey>(
	key: K,
	value: SettingsValueMap[K]
): Promise<void> {
	// JSON round-tripでproxyを完全に除去
	const plainValue = JSON.parse(JSON.stringify(value)) as SettingsValueMap[K];
	const record = {
		key,
		value: plainValue,
		updatedAt: new Date().toISOString()
	};
	// デバッグ用: 構造化クローン可能かテスト
	try {
		structuredClone(record);
	} catch (e) {
		console.error('setSetting: structuredClone failed for record:', record);
		throw e;
	}
	await db.settings.put(record);
}

/**
 * 現在の保存モードを取得
 */
export async function getStorageMode(): Promise<StorageType> {
	const mode = await getSetting('storageMode');
	// ランタイム検証: 不正な値の場合はデフォルトにフォールバック
	if (mode !== 'filesystem' && mode !== 'indexeddb') {
		if (mode !== undefined) {
			console.warn(`[settings] 不正なstorageMode値: ${mode}、デフォルト値を使用します`);
		}
		return 'indexeddb';
	}
	return mode;
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
	// ランタイム検証: 文字列以外はnullにフォールバック
	if (value !== undefined && typeof value !== 'string') {
		console.warn(`[settings] 不正なlastExportedAt値: ${typeof value}、nullを返します`);
		return null;
	}
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
	// ランタイム検証: boolean以外はデフォルトにフォールバック
	if (value !== undefined && typeof value !== 'boolean') {
		console.warn(
			`[settings] 不正なautoPurgeBlobAfterExport値: ${typeof value}、デフォルト値を使用します`
		);
		return true;
	}
	return value ?? true; // デフォルト: true
}

/**
 * 自動Blob削除設定を保存
 */
export async function setAutoPurgeBlobSetting(enabled: boolean): Promise<void> {
	await setSetting('autoPurgeBlobAfterExport', enabled);
}

/**
 * 証憑リネーム確認の非表示設定を取得
 */
export async function getSuppressRenameConfirm(): Promise<boolean> {
	const value = await getSetting('suppressRenameConfirm');
	if (value !== undefined && typeof value !== 'boolean') {
		console.warn(
			`[settings] 不正なsuppressRenameConfirm値: ${typeof value}、デフォルト値を使用します`
		);
		return false;
	}
	return value ?? false; // デフォルト: false（確認を表示する）
}

/**
 * 証憑リネーム確認の非表示設定を保存
 */
export async function setSuppressRenameConfirm(suppress: boolean): Promise<void> {
	await setSetting('suppressRenameConfirm', suppress);
}

/**
 * Blob保持日数を取得
 */
export async function getBlobRetentionDays(): Promise<number> {
	const value = await getSetting('blobRetentionDays');
	// ランタイム検証: 正の数値以外はデフォルトにフォールバック
	if (value !== undefined && (typeof value !== 'number' || value < 0 || !Number.isFinite(value))) {
		console.warn(`[settings] 不正なblobRetentionDays値: ${value}、デフォルト値を使用します`);
		return 30;
	}
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
					return { ...omit(attachment, ['blob']), blobPurgedAt: purgedAt } as Attachment;
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
				return { ...omit(attachment, ['blob']), blobPurgedAt: now } as Attachment;
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
