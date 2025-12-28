/**
 * ディープクローンユーティリティ
 * Svelte 5のリアクティブプロキシを解除しつつ、Blobを保持
 */

import type { JournalEntry, Attachment } from '$lib/types';

/**
 * 添付ファイルをクローン（Blobを保持）
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
		blob: attachment.blob, // Blobはそのまま参照を保持
		exportedAt: attachment.exportedAt,
		blobPurgedAt: attachment.blobPurgedAt,
		createdAt: attachment.createdAt
	};
}

/**
 * 仕訳をディープクローン（Blobを保持）
 * Svelte 5のリアクティブプロキシを解除するために使用
 * JSON.parse(JSON.stringify())はBlobを{}に変換してしまうため使用不可
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
			memo: line.memo
		})),
		vendor: journal.vendor,
		description: journal.description,
		evidenceStatus: journal.evidenceStatus,
		attachments: journal.attachments.map(cloneAttachment),
		createdAt: journal.createdAt,
		updatedAt: journal.updatedAt
	};
}
