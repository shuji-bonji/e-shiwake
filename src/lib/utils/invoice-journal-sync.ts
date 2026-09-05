/**
 * 請求書に紐付く仕訳の更新・削除
 *
 * invoice-journal.ts が純粋関数（生成・比較）なのに対し、
 * ここは DB とファイルシステムに触る処理をまとめる。
 */

import type { Invoice } from '$lib/types/invoice';
import type { JournalEntry, Vendor } from '$lib/types';
import { getJournalById, updateJournal, deleteJournal, getStorageModeForYear } from '$lib/db';
import { getSavedDirectoryHandle, supportsFileSystemAccess } from '$lib/utils/filesystem';
import { buildSalesJournalUpdate } from '$lib/utils/invoice-journal';

/**
 * 請求書に紐付く仕訳のうち、DB に存在するものを返す
 */
export async function getLinkedJournals(
	invoice: Pick<Invoice, 'journalId' | 'depositJournalIds'>
): Promise<{ sales: JournalEntry | null; deposits: JournalEntry[] }> {
	const sales = invoice.journalId ? ((await getJournalById(invoice.journalId)) ?? null) : null;
	const found = await Promise.all(
		(invoice.depositJournalIds ?? []).map((id) => getJournalById(id))
	);
	const deposits = found.filter((j): j is JournalEntry => j !== undefined);
	return { sales, deposits };
}

/**
 * 売掛金仕訳を請求書の現在の内容で上書きする
 *
 * 証憑と evidenceStatus は保持される（buildSalesJournalUpdate() が含めないため）。
 */
export async function syncSalesJournal(
	journalId: string,
	invoice: Invoice,
	vendor: Vendor
): Promise<void> {
	await updateJournal(journalId, buildSalesJournalUpdate(invoice, vendor));
}

/**
 * 請求書に紐付く仕訳を削除する（証憑ファイルも削除）
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
