import type { Attachment, DocumentType, EvidenceStatus, JournalEntry } from '$lib/types';
import { attachmentAdapter, type AttachmentAdapter } from '$lib/adapters/attachments';

interface BaseInput {
	journal: JournalEntry;
	directoryHandle?: FileSystemDirectoryHandle | null;
	adapter?: AttachmentAdapter;
}

interface SyncAttachmentsInput extends BaseInput {
	mainDebitAmount: number;
}

interface AddAttachmentInput extends BaseInput {
	file: File;
	documentDate: string;
	documentType: DocumentType;
	generatedName: string;
	updatedVendor: string;
	mainAmount: number;
}

interface UpdateAttachmentInput extends BaseInput {
	attachmentId: string;
	updates: {
		documentDate: string;
		documentType: DocumentType;
		description: string;
		amount: number;
		vendor: string;
	};
}

interface RemoveAttachmentInput extends BaseInput {
	attachmentId: string;
}

interface PreviewAttachmentInput extends BaseInput {
	attachment: Attachment;
}

interface ConfirmEvidenceStatusInput extends BaseInput {
	nextStatus: EvidenceStatus;
}

function parseYearFromDate(dateStr: string): number {
	const match = /^(\d{4})-\d{2}-\d{2}$/.exec(dateStr);
	if (match) {
		const year = parseInt(match[1], 10);
		if (year >= 1900 && year <= 2100) {
			return year;
		}
	}
	// 不正な日付の場合は警告を出して現在年度にフォールバック
	const fallbackYear = new Date().getFullYear();
	console.warn(
		`[journal-attachments] 不正な日付形式のため現在年度（${fallbackYear}）を使用します: "${dateStr}"`
	);
	return fallbackYear;
}

export async function saveVendorIfNeeded(
	vendor: string,
	adapter: AttachmentAdapter = attachmentAdapter
): Promise<void> {
	if (vendor.trim()) {
		await adapter.saveVendor(vendor);
	}
}

export async function syncAttachmentsOnBlur({
	journal,
	directoryHandle,
	mainDebitAmount,
	adapter = attachmentAdapter
}: SyncAttachmentsInput): Promise<Attachment[] | null> {
	const syncedAttachments = await adapter.syncAttachmentsWithJournal(
		journal.attachments,
		{
			date: journal.date,
			description: journal.description,
			vendor: journal.vendor,
			amount: mainDebitAmount
		},
		directoryHandle
	);

	if (syncedAttachments.length === 0) {
		return null;
	}

	const hasChanges = syncedAttachments.some(
		(synced, i) => synced.generatedName !== journal.attachments[i]?.generatedName
	);
	return hasChanges ? syncedAttachments : null;
}

export async function addJournalAttachment({
	journal,
	file,
	documentDate,
	documentType,
	generatedName,
	updatedVendor,
	mainAmount,
	directoryHandle,
	adapter = attachmentAdapter
}: AddAttachmentInput): Promise<JournalEntry> {
	const year = parseYearFromDate(journal.date);
	const attachment = await adapter.addAttachmentToJournal(
		journal.id,
		{
			file,
			documentDate,
			documentType,
			generatedName,
			year,
			description: journal.description,
			amount: mainAmount,
			vendor: updatedVendor
		},
		directoryHandle
	);

	return {
		...journal,
		vendor: updatedVendor,
		attachments: [...journal.attachments, attachment],
		evidenceStatus: 'digital'
	};
}

export async function removeJournalAttachment({
	journal,
	attachmentId,
	directoryHandle,
	adapter = attachmentAdapter
}: RemoveAttachmentInput): Promise<JournalEntry> {
	await adapter.removeAttachmentFromJournal(journal.id, attachmentId, directoryHandle);

	const updatedAttachments = journal.attachments.filter((a) => a.id !== attachmentId);
	return {
		...journal,
		attachments: updatedAttachments,
		evidenceStatus: updatedAttachments.length > 0 ? 'digital' : 'none'
	};
}

export async function updateJournalAttachment({
	journal,
	attachmentId,
	updates,
	directoryHandle,
	adapter = attachmentAdapter
}: UpdateAttachmentInput): Promise<JournalEntry> {
	const updatedAttachment = await adapter.updateAttachment(
		journal.id,
		attachmentId,
		updates,
		directoryHandle
	);

	const updatedAttachments = journal.attachments.map((a) =>
		a.id === updatedAttachment.id ? updatedAttachment : a
	);

	return {
		...journal,
		attachments: updatedAttachments
	};
}

export async function previewJournalAttachment({
	journal,
	attachment,
	directoryHandle,
	adapter = attachmentAdapter
}: PreviewAttachmentInput): Promise<void> {
	const blob = await adapter.getAttachmentBlob(journal.id, attachment.id, directoryHandle);
	if (!blob) return;

	const url = URL.createObjectURL(blob);
	window.open(url, '_blank');
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function confirmEvidenceStatusChange({
	journal,
	nextStatus,
	directoryHandle,
	adapter = attachmentAdapter
}: ConfirmEvidenceStatusInput): Promise<JournalEntry> {
	for (const attachment of journal.attachments) {
		await adapter.removeAttachmentFromJournal(journal.id, attachment.id, directoryHandle);
	}

	return {
		...journal,
		attachments: [],
		evidenceStatus: nextStatus
	};
}
