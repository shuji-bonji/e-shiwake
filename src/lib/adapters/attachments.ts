import type { Attachment } from '$lib/types';
import type { AttachmentParams, AttachmentUpdateParams } from '$lib/db';
import {
	addAttachmentToJournal,
	getAttachmentBlob,
	removeAttachmentFromJournal,
	saveVendor,
	syncAttachmentsWithJournal,
	updateAttachment
} from '$lib/db';

export interface AttachmentAdapter {
	addAttachmentToJournal: (
		journalId: string,
		params: AttachmentParams,
		directoryHandle?: FileSystemDirectoryHandle | null
	) => Promise<Attachment>;
	removeAttachmentFromJournal: (
		journalId: string,
		attachmentId: string,
		directoryHandle?: FileSystemDirectoryHandle | null
	) => Promise<void>;
	getAttachmentBlob: (
		journalId: string,
		attachmentId: string,
		directoryHandle?: FileSystemDirectoryHandle | null
	) => Promise<Blob | null>;
	updateAttachment: (
		journalId: string,
		attachmentId: string,
		updates: AttachmentUpdateParams,
		directoryHandle?: FileSystemDirectoryHandle | null
	) => Promise<Attachment>;
	syncAttachmentsWithJournal: (
		attachments: Attachment[],
		context: { date: string; description: string; vendor: string; amount: number },
		directoryHandle?: FileSystemDirectoryHandle | null
	) => Promise<Attachment[]>;
	saveVendor: (name: string) => Promise<void>;
}

export const attachmentAdapter: AttachmentAdapter = {
	addAttachmentToJournal,
	getAttachmentBlob,
	removeAttachmentFromJournal,
	saveVendor,
	syncAttachmentsWithJournal,
	updateAttachment
};
