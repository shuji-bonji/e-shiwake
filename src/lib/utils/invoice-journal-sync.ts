/**
 * 請求書に紐づく仕訳の取得・更新・削除
 *
 * invoice-journal.ts が純粋関数（生成・比較）、invoice-settlement.ts が導出（純粋関数）なのに対し、
 * ここは DB とファイルシステムに触る処理をまとめる。
 * 紐づけは仕訳側の invoiceId で表す（設計: docs/design/invoice-settlement.md）。
 */

import type { Invoice } from '$lib/types/invoice';
import type { JournalEntry, Vendor } from '$lib/types';
import {
	getJournalById,
	getJournalsByInvoiceId,
	updateJournal,
	deleteJournal,
	getStorageModeForYear
} from '$lib/db';
import { getSavedDirectoryHandle, supportsFileSystemAccess } from '$lib/utils/filesystem';
import { buildSalesJournalUpdate } from '$lib/utils/invoice-journal';
import { deriveInvoiceSettlement, type InvoiceSettlement } from '$lib/utils/invoice-settlement';

/**
 * 請求書に紐づく仕訳を読み、決済状態を導出して返す
 */
export async function loadInvoiceSettlement(
	invoice: Pick<Invoice, 'id' | 'total' | 'settledManually'>
): Promise<{ journals: JournalEntry[]; settlement: InvoiceSettlement }> {
	const journals = await getJournalsByInvoiceId(invoice.id);
	return { journals, settlement: deriveInvoiceSettlement(invoice, journals) };
}

/**
 * 請求書から生成した売掛金仕訳を、請求書の現在の内容で上書きする
 *
 * 証憑・evidenceStatus・invoiceId・generatedFrom は保持される（buildSalesJournalUpdate() が含めないため）。
 */
export async function syncSalesJournal(
	journalId: string,
	invoice: Invoice,
	vendor: Vendor
): Promise<void> {
	await updateJournal(journalId, buildSalesJournalUpdate(invoice, vendor));
}

/**
 * 仕訳を削除する（証憑ファイルも削除）
 *
 * 証憑がファイルシステムに保存されている場合は、仕訳の年度の保存モードを見て
 * ディレクトリハンドルを取得し、ファイルも削除する。
 *
 * @returns 削除した場合 true。既に存在しなければ false
 */
export async function deleteLinkedJournal(journalId: string): Promise<boolean> {
	const journal = await getJournalById(journalId);
	if (!journal) return false;

	let directoryHandle: FileSystemDirectoryHandle | null = null;
	if (journal.attachments.length > 0 && supportsFileSystemAccess()) {
		const year = Number(journal.date.slice(0, 4));
		const mode = await getStorageModeForYear(year, true);
		if (mode === 'filesystem') {
			directoryHandle = await getSavedDirectoryHandle();
		}
	}

	await deleteJournal(journalId, directoryHandle);
	return true;
}

/**
 * 仕訳と請求書の紐づけを外す（仕訳は残す）
 */
export async function unlinkJournalFromInvoice(journalId: string): Promise<void> {
	await updateJournal(journalId, { invoiceId: undefined, generatedFrom: undefined });
}
