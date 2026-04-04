import type { Attachment, StorageType } from '$lib/types';
import { db } from './database';

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
 * @param filterYear 指定した年度のみフィルタ（省略時は全年度）
 */
export async function getAttachmentsForMigration(
	targetStorageType: StorageType,
	filterYear?: number
): Promise<MigrationAttachment[]> {
	const journals = await db.journals.toArray();
	const result: MigrationAttachment[] = [];

	for (const journal of journals) {
		const year = parseInt(journal.date.substring(0, 4), 10);

		// 年度フィルタ
		if (filterYear !== undefined && year !== filterYear) continue;

		for (const attachment of journal.attachments) {
			// 移行先と異なるストレージタイプのものを収集
			if (targetStorageType === 'filesystem') {
				// IndexedDB → Filesystem: Blobが存在するもの（purge済みは除外）
				if (attachment.storageType === 'indexeddb' && !attachment.blobPurgedAt) {
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
	if (!attachment) return;

	// attachmentBlobs テーブルから Blob を取得
	const blobRecord = await db.attachmentBlobs.get(attachment.id);
	if (!blobRecord?.blob) return;

	// Blobをファイルとして保存
	const filePath = await saveFileToDirectory(
		directoryHandle,
		item.year,
		attachment.generatedName,
		blobRecord.blob
	);

	// 添付ファイルのメタデータを更新（filesystem に切り替え）
	const updatedAttachments = journal.attachments.map((a) => {
		if (a.id === item.attachmentId) {
			return {
				...a,
				storageType: 'filesystem' as StorageType,
				filePath,
				exportedAt: undefined,
				blobPurgedAt: undefined
			};
		}
		return a;
	});

	await db.journals.update(item.journalId, {
		attachments: updatedAttachments,
		updatedAt: new Date().toISOString()
	});

	// attachmentBlobs テーブルから Blob を削除
	await db.attachmentBlobs.delete(attachment.id);
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

	// attachmentBlobs テーブルに Blob を保存
	await db.attachmentBlobs.put({ id: attachment.id, blob });

	// 添付ファイルのメタデータを更新（indexeddb に切り替え）
	const updatedAttachments = journal.attachments.map((a) => {
		if (a.id === item.attachmentId) {
			return {
				...a,
				storageType: 'indexeddb' as StorageType,
				filePath: undefined
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
