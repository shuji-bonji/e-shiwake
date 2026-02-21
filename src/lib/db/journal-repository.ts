import type { JournalEntry, TaxCategory } from '$lib/types';
import { db } from './database';
import { saveVendor } from './vendor-repository';

// ==================== 仕訳関連 ====================

/**
 * 仕訳の取得（年度別、日付降順）
 */
export async function getJournalsByYear(year: number): Promise<JournalEntry[]> {
	const startDate = `${year}-01-01`;
	const endDate = `${year}-12-31`;

	const journals = await db.journals
		.where('date')
		.between(startDate, endDate, true, true)
		.toArray();

	// 日付降順（新しい順）でソート、同日内は作成日時降順
	// createdAtが欠けている場合に備えて防御的に比較
	return journals.sort((a, b) => {
		const dateCompare = (b.date || '').localeCompare(a.date || '');
		if (dateCompare !== 0) return dateCompare;
		const aCreatedAt = a.createdAt || a.updatedAt || '';
		const bCreatedAt = b.createdAt || b.updatedAt || '';
		return bCreatedAt.localeCompare(aCreatedAt);
	});
}

/**
 * 全年度の仕訳を取得（日付降順）
 * 検索時の全年度横断検索用
 */
export async function getAllJournals(): Promise<JournalEntry[]> {
	const journals = await db.journals.toArray();

	// 日付降順（新しい順）でソート、同日内は作成日時降順
	return journals.sort((a, b) => {
		const dateCompare = (b.date || '').localeCompare(a.date || '');
		if (dateCompare !== 0) return dateCompare;
		const aCreatedAt = a.createdAt || a.updatedAt || '';
		const bCreatedAt = b.createdAt || b.updatedAt || '';
		return bCreatedAt.localeCompare(aCreatedAt);
	});
}

/**
 * 利用可能な年度の取得（仕訳データから抽出）
 * 現在年度は常に含める（新規仕訳追加のため）
 */
export async function getAvailableYears(): Promise<number[]> {
	const currentYear = new Date().getFullYear();
	const journals = await db.journals.toArray();

	// 現在年度は常に含める
	const years = new Set<number>([currentYear]);

	// 仕訳の日付から年度を抽出
	for (const journal of journals) {
		const year = parseInt(journal.date.substring(0, 4), 10);
		if (!isNaN(year)) {
			years.add(year);
		}
	}

	// 降順（新しい年度が先）でソート
	return Array.from(years).sort((a, b) => b - a);
}

/**
 * 仕訳の取得（ID指定）
 */
export async function getJournalById(id: string): Promise<JournalEntry | undefined> {
	return db.journals.get(id);
}

/**
 * 仕訳の追加
 */
export async function addJournal(
	journal: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
	const now = new Date().toISOString();
	const id = crypto.randomUUID();

	await db.journals.add({
		...journal,
		id,
		createdAt: now,
		updatedAt: now
	});

	// 取引先を自動登録
	if (journal.vendor) {
		await saveVendor(journal.vendor);
	}

	return id;
}

/**
 * 仕訳の更新
 * 注意: 取引先の自動登録は行わない（blurタイミングで別途saveVendorを呼ぶ）
 */
export async function updateJournal(
	id: string,
	updates: Partial<Omit<JournalEntry, 'id' | 'createdAt'>>
): Promise<void> {
	const now = new Date().toISOString();

	await db.journals.update(id, {
		...updates,
		updatedAt: now
	});
}

/**
 * 仕訳の削除（添付ファイルも削除）
 */
export async function deleteJournal(
	id: string,
	directoryHandle?: FileSystemDirectoryHandle | null
): Promise<void> {
	// 仕訳を取得
	const journal = await db.journals.get(id);
	if (!journal) {
		return; // 既に削除済み
	}

	// 添付ファイルをファイルシステムから削除
	if (directoryHandle && journal.attachments.length > 0) {
		const { deleteFileFromDirectory } = await import('$lib/utils/filesystem');
		for (const attachment of journal.attachments) {
			if (attachment.storageType === 'filesystem' && attachment.filePath) {
				try {
					await deleteFileFromDirectory(directoryHandle, attachment.filePath);
				} catch (error) {
					console.warn(`添付ファイルの削除に失敗: ${attachment.filePath}`, error);
				}
			}
		}
	}

	// 仕訳を削除
	await db.journals.delete(id);
}

/**
 * 特定の勘定科目を使用している仕訳行の数を取得
 */
export async function countJournalLinesByAccountCode(accountCode: string): Promise<number> {
	const journals = await db.journals.toArray();
	let count = 0;
	for (const journal of journals) {
		for (const line of journal.lines) {
			if (line.accountCode === accountCode) {
				count++;
			}
		}
	}
	return count;
}

/**
 * 特定の勘定科目を使用している仕訳行の消費税区分を一括更新
 */
export async function updateTaxCategoryByAccountCode(
	accountCode: string,
	newTaxCategory: TaxCategory
): Promise<number> {
	const journals = await db.journals.toArray();
	let updatedCount = 0;

	for (const journal of journals) {
		let hasUpdate = false;
		const updatedLines = journal.lines.map((line) => {
			if (line.accountCode === accountCode && line.taxCategory !== newTaxCategory) {
				hasUpdate = true;
				updatedCount++;
				return { ...line, taxCategory: newTaxCategory };
			}
			return line;
		});

		if (hasUpdate) {
			await db.journals.update(journal.id, {
				lines: updatedLines,
				updatedAt: new Date().toISOString()
			});
		}
	}

	return updatedCount;
}

/**
 * 年度の全データを削除
 * 仕訳とそれに紐づく添付ファイルを削除
 */
export async function deleteYearData(
	year: number
): Promise<{ journalCount: number; attachmentCount: number }> {
	// 対象年度の仕訳を取得
	const startDate = `${year}-01-01`;
	const endDate = `${year}-12-31`;

	const journals = await db.journals
		.where('date')
		.between(startDate, endDate, true, true)
		.toArray();

	let attachmentCount = 0;

	// 仕訳ごとに添付ファイルを削除
	for (const journal of journals) {
		for (const attachment of journal.attachments) {
			await db.attachments.delete(attachment.id);
			attachmentCount++;
		}
	}

	// 仕訳を削除
	const journalIds = journals.map((j) => j.id);
	await db.journals.bulkDelete(journalIds);

	return { journalCount: journals.length, attachmentCount };
}

/**
 * 空の仕訳を作成
 */
export function createEmptyJournal(): Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'> {
	return {
		date: new Date().toISOString().slice(0, 10),
		lines: [
			{ id: crypto.randomUUID(), type: 'debit', accountCode: '', amount: 0 },
			{ id: crypto.randomUUID(), type: 'credit', accountCode: '', amount: 0 }
		],
		vendor: '',
		description: '',
		evidenceStatus: 'none',
		attachments: []
	};
}

/**
 * 仕訳のバリデーション（借方合計 === 貸方合計、勘定科目選択済み）
 */
export function validateJournal(journal: Pick<JournalEntry, 'lines'>): {
	isValid: boolean;
	debitTotal: number;
	creditTotal: number;
	hasEmptyAccounts: boolean;
} {
	const debitTotal = journal.lines
		.filter((line) => line.type === 'debit')
		.reduce((sum, line) => sum + line.amount, 0);

	const creditTotal = journal.lines
		.filter((line) => line.type === 'credit')
		.reduce((sum, line) => sum + line.amount, 0);

	// 勘定科目が選択されていない行があるかチェック
	const hasEmptyAccounts = journal.lines.some((line) => !line.accountCode);

	const isTotalValid = debitTotal === creditTotal && debitTotal > 0;

	return {
		isValid: isTotalValid && !hasEmptyAccounts,
		debitTotal,
		creditTotal,
		hasEmptyAccounts
	};
}
