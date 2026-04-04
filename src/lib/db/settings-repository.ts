import type { Attachment, SettingsKey, SettingsValueMap, StorageType } from '$lib/types';
import { db } from './database';
import { getAvailableYears } from './journal-repository';

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
 * 注意: Svelte 5のproxyオブジェクトを完全に除去するため、structuredCloneを使用
 */
export async function setSetting<K extends SettingsKey>(
	key: K,
	value: SettingsValueMap[K]
): Promise<void> {
	// structuredCloneでproxyを完全に除去（JSON round-tripより効率的で型安全）
	const plainValue = structuredClone(value);
	await db.settings.put({
		key,
		value: plainValue,
		updatedAt: new Date().toISOString()
	});
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

/**
 * 年度別の保存モードを取得
 * 年度別設定 → デフォルト（File System Access API対応なら filesystem、非対応なら indexeddb）
 */
export async function getStorageModeForYear(
	year: number,
	supportsFileSystem?: boolean
): Promise<StorageType> {
	const byYear = await getSetting('storageModeByYear');
	const yearKey = String(year);
	if (byYear && (byYear[yearKey] === 'filesystem' || byYear[yearKey] === 'indexeddb')) {
		return byYear[yearKey];
	}
	// 年度別設定がなければ、ブラウザのAPI対応状況でデフォルトを決定
	if (supportsFileSystem !== undefined) {
		return supportsFileSystem ? 'filesystem' : 'indexeddb';
	}
	// supportsFileSystem が渡されない場合はグローバル設定にフォールバック
	return await getStorageMode();
}

/**
 * 年度別の保存モードを設定
 */
export async function setStorageModeForYear(year: number, mode: StorageType): Promise<void> {
	const byYear = (await getSetting('storageModeByYear')) ?? {};
	const updated = { ...byYear, [String(year)]: mode };
	await setSetting('storageModeByYear', updated);
}

/**
 * 全年度の保存モードマップを取得
 */
export async function getStorageModeByYear(): Promise<Record<string, StorageType>> {
	return (await getSetting('storageModeByYear')) ?? {};
}

/**
 * グローバル storageMode を年度別設定にマイグレーション（v0.4.0 初回起動時）
 *
 * storageModeByYear が未設定で、グローバル storageMode が明示設定済みの場合、
 * 全年度にグローバル設定を展開する。これにより既存ユーザーの設定が引き継がれる。
 */
export async function migrateGlobalStorageModeToPerYear(): Promise<void> {
	const byYear = await getSetting('storageModeByYear');
	// 既に年度別設定がある場合はスキップ
	if (byYear && Object.keys(byYear).length > 0) return;

	const globalMode = await getSetting('storageMode');
	// グローバル設定が未設定（デフォルトの場合）はスキップ
	if (!globalMode || (globalMode !== 'filesystem' && globalMode !== 'indexeddb')) return;

	const years = await getAvailableYears();
	if (years.length === 0) return;

	const perYear: Record<string, StorageType> = {};
	for (const year of years) {
		perYear[String(year)] = globalMode;
	}
	await setSetting('storageModeByYear', perYear);
	console.info(
		`[settings] グローバル保存モード "${globalMode}" を ${years.length} 年度に展開しました`
	);
}

/**
 * エクスポート用に全設定をまとめて取得
 * lastExportedAt は動的な値のため除外
 */
export async function getAllSettingsForExport(): Promise<Partial<SettingsValueMap>> {
	const allRecords = await db.settings.toArray();
	const result: Partial<SettingsValueMap> = {};
	for (const record of allRecords) {
		// lastExportedAt はエクスポート時の動的な値のため含めない
		if (record.key === 'lastExportedAt') continue;
		(result as Record<string, unknown>)[record.key] = record.value;
	}
	return result;
}

/**
 * エクスポートデータから全設定を復元
 * デフォルトで除外されるキー:
 * - lastExportedAt: 動的な値のため
 * - storageMode: リストア先の環境に依存するため（リストア時にユーザーが選択）
 */
export async function restoreAllSettings(
	settings: Partial<SettingsValueMap>,
	excludeKeys: (keyof SettingsValueMap)[] = []
): Promise<void> {
	const defaultExcludes: (keyof SettingsValueMap)[] = [
		'lastExportedAt',
		'storageMode',
		'storageModeByYear'
	];
	const allExcludes = new Set([...defaultExcludes, ...excludeKeys]);

	for (const [key, value] of Object.entries(settings)) {
		if (allExcludes.has(key as keyof SettingsValueMap)) continue;
		if (value === undefined) continue;
		// DataCloneError回避: Svelte $stateプロキシをプレーンオブジェクトに変換
		const plainValue = JSON.parse(JSON.stringify(value));
		await db.settings.put({
			key: key as keyof SettingsValueMap,
			value: plainValue,
			updatedAt: new Date().toISOString()
		});
	}
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
 * ストリーミング処理で全仕訳をメモリにロードしない
 */
export async function getUnexportedAttachmentCount(): Promise<number> {
	let count = 0;
	await db.journals.each((journal) => {
		if (journal.attachments.length === 0) return;
		for (const attachment of journal.attachments) {
			if (attachment.storageType === 'indexeddb' && !attachment.exportedAt) {
				count++;
			}
		}
	});
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
 * ストリーミング処理で全仕訳をメモリにロードしない
 */
export async function getPurgeableBlobCount(): Promise<number> {
	const retentionDays = await getBlobRetentionDays();
	const threshold = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

	let count = 0;
	await db.journals.each((journal) => {
		if (journal.attachments.length === 0) return;
		for (const attachment of journal.attachments) {
			if (
				attachment.storageType === 'indexeddb' &&
				attachment.exportedAt &&
				!attachment.blobPurgedAt &&
				new Date(attachment.exportedAt).getTime() <= threshold
			) {
				count++;
			}
		}
	});

	return count;
}

/**
 * エクスポート済みのBlobを削除（容量節約）
 * attachmentBlobs テーブルから Blob を削除し、メタデータに blobPurgedAt を設定
 * @returns 削除した件数
 */
export async function purgeExportedBlobs(): Promise<number> {
	const retentionDays = await getBlobRetentionDays();
	const threshold = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
	const purgedAt = new Date().toISOString();

	// 添付ファイルを持つ仕訳のみフィルタして取得
	const journalsWithAttachments = await db.journals
		.filter((j) => j.attachments.length > 0)
		.toArray();
	let purgedCount = 0;
	const blobIdsToDelete: string[] = [];

	for (const journal of journalsWithAttachments) {
		let modified = false;
		const updatedAttachments = journal.attachments.map((attachment) => {
			if (
				attachment.storageType === 'indexeddb' &&
				attachment.exportedAt &&
				!attachment.blobPurgedAt &&
				new Date(attachment.exportedAt).getTime() <= threshold
			) {
				modified = true;
				purgedCount++;
				blobIdsToDelete.push(attachment.id);
				return { ...attachment, blobPurgedAt: purgedAt } as Attachment;
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

	// attachmentBlobs テーブルから Blob を一括削除
	if (blobIdsToDelete.length > 0) {
		await db.attachmentBlobs.bulkDelete(blobIdsToDelete);
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

	// 添付ファイルを持つ仕訳のみフィルタして取得
	const journalsWithAttachments = await db.journals
		.filter((j) => j.attachments.length > 0)
		.toArray();
	let purgedCount = 0;
	const blobIdsToDelete: string[] = [];

	for (const journal of journalsWithAttachments) {
		let modified = false;
		const updatedAttachments = journal.attachments.map((attachment) => {
			if (
				attachment.storageType === 'indexeddb' &&
				attachment.exportedAt &&
				!attachment.blobPurgedAt
			) {
				modified = true;
				purgedCount++;
				blobIdsToDelete.push(attachment.id);
				return { ...attachment, blobPurgedAt: now } as Attachment;
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

	// attachmentBlobs テーブルから Blob を一括削除
	if (blobIdsToDelete.length > 0) {
		await db.attachmentBlobs.bulkDelete(blobIdsToDelete);
	}

	return purgedCount;
}
