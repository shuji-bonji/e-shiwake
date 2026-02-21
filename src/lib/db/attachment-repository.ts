import type { Account, Attachment, DocumentType } from '$lib/types';
import { db } from './database';

// ==================== 添付ファイル関連 ====================

/**
 * 書類の種類の短縮ラベル（ファイル名用）
 */
export const DocumentTypeShortLabels: Record<DocumentType, string> = {
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
 * 未払金系の勘定科目コード（借方にある場合は支払済み = 領収書）
 */
export const UNPAID_ACCOUNT_CODES = ['2004', '2005', '2006']; // 未払金、未払費用、未払消費税

/**
 * 勘定科目タイプから書類の種類を推測
 * @param accountType 勘定科目タイプ
 * @param accountCode 勘定科目コード（未払金系の判定用）
 */
export function suggestDocumentType(
	accountType: Account['type'] | null,
	accountCode?: string
): DocumentType {
	// 借方が未払金系の場合は領収書（支払済みの証拠）
	if (accountCode && UNPAID_ACCOUNT_CODES.includes(accountCode)) {
		return 'receipt';
	}

	if (!accountType) return 'bill'; // デフォルトは請求書（受領）

	switch (accountType) {
		case 'expense':
			return 'bill'; // 費用系 → 請求書（受領）※インボイス制度対応
		case 'revenue':
			return 'invoice'; // 収益系 → 請求書（発行）
		default:
			return 'bill'; // その他も請求書（受領）をデフォルト
	}
}

/**
 * 添付ファイルのBlobが削除済みかチェック
 */
export function isAttachmentBlobPurged(attachment: Attachment): boolean {
	return attachment.storageType === 'indexeddb' && !!attachment.blobPurgedAt;
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
	generatedName?: string; // 手動編集されたファイル名（指定時は自動生成を上書き）
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

	// 新しいファイル名を生成（手動指定がある場合はそちらを優先）
	const newGeneratedName =
		updates.generatedName ||
		generateAttachmentName(newDocumentDate, newDocumentType, newDescription, newAmount, newVendor);

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
