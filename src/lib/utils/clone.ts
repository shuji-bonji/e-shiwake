/**
 * ディープクローンユーティリティ
 * Svelte 5のリアクティブプロキシを解除する
 *
 * Blob は attachmentBlobs テーブルに分離されたため、
 * 仕訳のクローンでは Blob の保持は不要。
 * JSON.parse(JSON.stringify()) でも問題ないが、
 * 明示的なフィールドコピーで安全性を担保する。
 */

import type { JournalEntry, Attachment } from '$lib/types';

/**
 * 添付ファイルのメタデータをクローン
 */
function cloneAttachment(attachment: Attachment): Attachment {
	return {
		id: attachment.id,
		journalEntryId: attachment.journalEntryId,
		documentDate: attachment.documentDate,
		documentType: attachment.documentType,
		originalName: attachment.originalName,
		generatedName: attachment.generatedName,
		mimeType: attachment.mimeType,
		size: attachment.size,
		description: attachment.description,
		amount: attachment.amount,
		vendor: attachment.vendor,
		storageType: attachment.storageType,
		filePath: attachment.filePath,
		exportedAt: attachment.exportedAt,
		blobPurgedAt: attachment.blobPurgedAt,
		archived: attachment.archived,
		createdAt: attachment.createdAt
	};
}

/**
 * 仕訳をディープクローン
 * Svelte 5のリアクティブプロキシを解除するために使用
 *
 * @param journal - クローンする仕訳オブジェクト
 * @returns クローンされた仕訳オブジェクト
 */
export function cloneJournal(journal: JournalEntry): JournalEntry {
	return {
		id: journal.id,
		date: journal.date,
		lines: journal.lines.map((line) => ({
			id: line.id,
			type: line.type,
			accountCode: line.accountCode,
			amount: line.amount,
			taxCategory: line.taxCategory,
			memo: line.memo,
			// 家事按分フラグ
			_businessRatioApplied: line._businessRatioApplied,
			_originalAmount: line._originalAmount,
			_businessRatio: line._businessRatio,
			_businessRatioGenerated: line._businessRatioGenerated
		})),
		vendor: journal.vendor,
		description: journal.description,
		evidenceStatus: journal.evidenceStatus,
		attachments: journal.attachments.map(cloneAttachment),
		createdAt: journal.createdAt,
		updatedAt: journal.updatedAt
	};
}
