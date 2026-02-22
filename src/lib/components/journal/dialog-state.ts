/**
 * JournalRow のダイアログ状態を Discriminated Union で管理
 *
 * 同時に2つのダイアログが開く不正状態を型レベルで防止する。
 * 各ダイアログに必要なデータをバリアントに含めることで、
 * 個別の state 変数を大幅に削減できる。
 */

import type { Attachment, DocumentType, EvidenceStatus, JournalEntry } from '$lib/types';

export interface RenameInfo {
	oldNames: string[];
	newNames: string[];
	syncArgs: {
		journal: JournalEntry;
		mainDebitAmount: number;
		directoryHandle?: FileSystemDirectoryHandle | null;
	};
}

export type DialogState =
	| { type: 'none' }
	| { type: 'safari'; file: File }
	| { type: 'attachment'; file: File }
	| { type: 'edit'; attachment: Attachment }
	| { type: 'evidenceChange'; nextStatus: EvidenceStatus }
	| { type: 'removeAttachment'; attachmentId: string }
	| { type: 'overwrite'; fileName: string; callback: () => Promise<void> }
	| { type: 'rename'; info: RenameInfo; suppressCheck: boolean };

/** ダイアログを閉じる（初期状態に戻す） */
export const DIALOG_NONE: DialogState = { type: 'none' };

/**
 * JournalRowDialogs のコールバック Props
 * DialogState への移行により、open/close は親が管理するため
 * アクション系コールバックのみ定義する
 */
export interface DialogCallbacks {
	onattachmentconfirm: (
		documentDate: string,
		documentType: DocumentType,
		generatedName: string,
		updatedVendor: string
	) => void;
	onattachmentcancel: () => void;
	oneditconfirm: (updates: {
		documentDate: string;
		documentType: DocumentType;
		description: string;
		amount: number;
		vendor: string;
		generatedName?: string;
	}) => void;
	oneditcancel: () => void;
	onconfirmstatuschange: () => void;
	oncancelstatuschange: () => void;
	onconfirmremoveattachment: () => void;
	oncancelremoveattachment: () => void;
	onconfirmrename: () => void;
	oncancelrename: () => void;
	onsuppresschange: (checked: boolean) => void;
	onconfirmoverwrite: () => void;
	oncanceloverwrite: () => void;
	onsafaridialogconfirm: () => void;
}
