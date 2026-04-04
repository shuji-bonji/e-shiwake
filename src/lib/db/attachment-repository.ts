import type { Account, Attachment, DocumentType } from '$lib/types';
import { db } from './database';

// ==================== 添付ファイル関連 ====================

/**
 * 書類の種類の短縮ラベル（ファイル名用）
 *
 * invoice（発行）と bill（受領）を明確に区別する。
 * 電帳法の検索要件上、ファイル名だけで書類の方向が判別できることが望ましい。
 */
export const DocumentTypeShortLabels: Record<DocumentType, string> = {
	invoice: '請求書発行',
	bill: '請求書',
	receipt: '領収書',
	contract: '契約書',
	estimate: '見積書',
	other: 'その他'
};

/** ファイル名に使えない文字を安全な文字に置換 */
export function sanitizeFileName(str: string): string {
	return str.replace(/[\\/:*?"<>|]/g, '_').trim();
}

/**
 * ファイル名のバイト長を制限する（ファイルシステムの255バイト制限対応）
 * UTF-8で計算し、超過分は末尾を切り詰める
 */
function truncateToMaxBytes(name: string, maxBytes: number): string {
	const encoder = new TextEncoder();
	if (encoder.encode(name).length <= maxBytes) return name;

	// 1文字ずつ削って収まるまで切り詰め
	let truncated = name;
	while (encoder.encode(truncated).length > maxBytes && truncated.length > 0) {
		truncated = truncated.slice(0, -1);
	}
	return truncated;
}

/** ファイル名の最大バイト長（.pdf の4バイト + 重複回避サフィックス分を考慮して余裕を持たせる） */
const MAX_FILENAME_BYTES = 240;

/**
 * 添付ファイル名を自動生成
 * 形式: {書類の日付}_{種類}_{摘要}_{金額}円_{取引先名}.pdf
 *
 * エッジケース対応:
 * - 摘要が空 → 「未分類」
 * - 取引先が空 → 「不明」
 * - ファイル名が255バイトを超える → 摘要を切り詰め
 */
export function generateAttachmentName(
	documentDate: string,
	documentType: DocumentType,
	description: string,
	amount: number,
	vendor: string
): string {
	const typeLabel = DocumentTypeShortLabels[documentType];
	const sanitizedDescription = sanitizeFileName(description) || '未分類';
	const amountStr = `${amount.toLocaleString('ja-JP')}円`;
	const sanitizedVendor = sanitizeFileName(vendor) || '不明';

	// 摘要以外の固定部分を先に組み立て（切り詰め対象外）
	const prefix = `${documentDate}_${typeLabel}_`;
	const suffix = `_${amountStr}_${sanitizedVendor}`;

	// 摘要部分をバイト長制限に合わせて切り詰め
	const availableBytes =
		MAX_FILENAME_BYTES -
		new TextEncoder().encode(prefix).length -
		new TextEncoder().encode(suffix).length;
	const truncatedDescription =
		availableBytes > 0
			? truncateToMaxBytes(sanitizedDescription, availableBytes)
			: sanitizedDescription;

	return `${prefix}${truncatedDescription}${suffix}.pdf`;
}

/**
 * 手動編集されたファイル名をバリデーション
 * @returns エラーメッセージの配列（空配列なら有効）
 */
export function validateManualFileName(fileName: string): string[] {
	const errors: string[] = [];

	if (!fileName || !fileName.trim()) {
		errors.push('ファイル名を入力してください');
		return errors;
	}

	// パストラバーサル防止
	if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
		errors.push('ファイル名にパス区切り文字（/ \\ ..）は使用できません');
	}

	// ファイルシステムの禁止文字チェック
	if (/[:*?"<>|]/.test(fileName)) {
		errors.push('ファイル名に使用できない文字が含まれています（: * ? " < > |）');
	}

	// .pdf 拡張子の重複チェック
	if (/\.pdf\.pdf$/i.test(fileName)) {
		errors.push('.pdf 拡張子が重複しています');
	}

	// .pdf 拡張子の付与確認
	if (!fileName.toLowerCase().endsWith('.pdf')) {
		errors.push('ファイル名は .pdf で終わる必要があります');
	}

	// バイト長チェック
	const byteLength = new TextEncoder().encode(fileName).length;
	if (byteLength > 255) {
		errors.push(`ファイル名が長すぎます（${byteLength}バイト、最大255バイト）`);
	}

	return errors;
}

/**
 * 未払金系の勘定科目コード（借方にある場合は支払済み = 領収書）
 */
export const UNPAID_ACCOUNT_CODES = ['2004', '2005', '2006']; // 未払金、未払費用、未払消費税

/**
 * 売掛金系の勘定科目コード（借方にある場合は自社発行 = 請求書発行）
 */
export const RECEIVABLE_ACCOUNT_CODES = ['1005']; // 売掛金

/**
 * 勘定科目タイプから書類の種類を推測
 * @param accountType 勘定科目タイプ
 * @param accountCode 勘定科目コード（未払金系・売掛金系の判定用）
 */
export function suggestDocumentType(
	accountType: Account['type'] | null,
	accountCode?: string
): DocumentType {
	// 借方が未払金系の場合は領収書（支払済みの証拠）
	if (accountCode && UNPAID_ACCOUNT_CODES.includes(accountCode)) {
		return 'receipt';
	}

	// 借方が売掛金系の場合は請求書（発行）（自社発行の請求書に基づく売上計上）
	if (accountCode && RECEIVABLE_ACCOUNT_CODES.includes(accountCode)) {
		return 'invoice';
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
 * 全仕訳から使用中の添付ファイル名を収集
 * @param excludeAttachmentId 除外する添付ファイルID（自分自身のリネーム時）
 * @returns 使用中のファイル名のSet
 */
export async function getUsedFileNames(excludeAttachmentId?: string): Promise<Set<string>> {
	const journals = await db.journals.toArray();
	const usedNames = new Set<string>();

	for (const journal of journals) {
		for (const attachment of journal.attachments) {
			if (excludeAttachmentId && attachment.id === excludeAttachmentId) continue;
			if (attachment.generatedName) {
				usedNames.add(attachment.generatedName);
			}
		}
	}

	return usedNames;
}

/**
 * ファイル名の重複を回避するためにサフィックスを付与
 * 例: "2025-01-15_領収書_USBケーブル_3,980円_Amazon.pdf"
 *   → "2025-01-15_領収書_USBケーブル_3,980円_Amazon_2.pdf"
 *   → "2025-01-15_領収書_USBケーブル_3,980円_Amazon_3.pdf"
 */
export function makeFileNameUnique(baseName: string, usedNames: Set<string>): string {
	if (!usedNames.has(baseName)) {
		return baseName;
	}

	const ext = baseName.lastIndexOf('.') >= 0 ? baseName.slice(baseName.lastIndexOf('.')) : '';
	const nameWithoutExt =
		baseName.lastIndexOf('.') >= 0 ? baseName.slice(0, baseName.lastIndexOf('.')) : baseName;

	let counter = 2;
	let candidate = `${nameWithoutExt}_${counter}${ext}`;
	while (usedNames.has(candidate)) {
		counter++;
		candidate = `${nameWithoutExt}_${counter}${ext}`;
	}

	return candidate;
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

	const attachmentId = crypto.randomUUID();

	if (directoryHandle) {
		// ファイルシステムに保存
		const { saveFileToDirectory } = await import('$lib/utils/filesystem');
		const filePath = await saveFileToDirectory(directoryHandle, year, generatedName, file);

		attachment = {
			id: attachmentId,
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
		// IndexedDB に Blob を分離保存
		const arrayBuffer = await file.arrayBuffer();
		const blob = new Blob([arrayBuffer], { type: file.type });

		// attachmentBlobs テーブルに Blob を保存
		await db.attachmentBlobs.put({ id: attachmentId, blob });

		attachment = {
			id: attachmentId,
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

	// attachmentBlobs テーブルから Blob を削除（indexeddb保存の場合）
	if (attachmentToRemove?.storageType === 'indexeddb') {
		await db.attachmentBlobs.delete(attachmentToRemove.id);
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

	// attachmentBlobs テーブルから取得
	const blobRecord = await db.attachmentBlobs.get(attachment.id);
	return blobRecord?.blob ?? null;
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

	// 新しいファイル名を生成
	// 手動指定がある場合はバリデーション後に使用
	// 自動生成の場合のみ重複回避を適用
	let newGeneratedName: string;
	if (updates.generatedName) {
		const errors = validateManualFileName(updates.generatedName);
		if (errors.length > 0) {
			throw new Error(`ファイル名が不正です: ${errors.join(', ')}`);
		}
		newGeneratedName = updates.generatedName;
	} else {
		const baseName = generateAttachmentName(
			newDocumentDate,
			newDocumentType,
			newDescription,
			newAmount,
			newVendor
		);
		const usedNames = await getUsedFileNames(attachmentId);
		newGeneratedName = makeFileNameUnique(baseName, usedNames);
	}

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
 * ファイル名の重複を自動回避する
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

	// 全仕訳から使用中のファイル名を取得（現在の添付ファイル自身は除外）
	const usedNames = await getUsedFileNames();
	for (const att of currentAttachments) {
		usedNames.delete(att.generatedName);
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
			// 使用中名として登録（同じ仕訳内の他の添付との重複回避用）
			usedNames.add(attachment.generatedName);
			continue;
		}

		// 新しいファイル名を生成（重複回避）
		const baseName = generateAttachmentName(
			newDocumentDate,
			attachment.documentType,
			newDescription,
			newAmount,
			newVendor
		);
		const newGeneratedName = makeFileNameUnique(baseName, usedNames);
		// 使用中名として登録（同じ仕訳内の他の添付との重複回避用）
		usedNames.add(newGeneratedName);

		// ファイルシステム保存の場合、実ファイルをリネーム
		let newFilePath = attachment.filePath;
		let renameSucceeded = true;
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
					// リネーム失敗時はメタデータも変更しない（不整合防止）
					renameSucceeded = false;
				}
			}
		}

		if (!renameSucceeded) {
			// 実ファイルのリネームに失敗した場合、元のメタデータを維持
			updatedAttachments.push(attachment);
			usedNames.add(attachment.generatedName);
		} else {
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
	}

	return updatedAttachments;
}
