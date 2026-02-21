import type { Attachment, ExportData, JournalEntry, StorageType } from '$lib/types';
import { db } from './database';

// ==================== インポート関連 ====================

/**
 * インポートモード
 */
export type ImportMode = 'merge' | 'overwrite';

/**
 * インポート結果
 */
export interface ImportResult {
	success: boolean;
	journalsImported: number;
	accountsImported: number;
	vendorsImported: number;
	errors: string[];
}

/**
 * ExportDataの検証
 */
export function validateExportData(data: unknown): data is ExportData {
	if (!data || typeof data !== 'object') {
		return false;
	}

	const d = data as Record<string, unknown>;

	// 必須フィールドのチェック
	if (typeof d.version !== 'string') return false;
	if (typeof d.exportedAt !== 'string') return false;
	if (typeof d.fiscalYear !== 'number') return false;
	if (!Array.isArray(d.journals)) return false;
	if (!Array.isArray(d.accounts)) return false;
	if (!Array.isArray(d.vendors)) return false;

	// 仕訳の必須フィールドをチェック
	for (const journal of d.journals as Record<string, unknown>[]) {
		if (typeof journal.id !== 'string') return false;
		if (typeof journal.date !== 'string') return false;
		if (typeof journal.createdAt !== 'string') return false;
		if (typeof journal.updatedAt !== 'string') return false;
		if (!Array.isArray(journal.lines)) return false;
	}

	return true;
}

/**
 * JSONファイルからデータをインポート
 */
export async function importData(
	data: ExportData,
	mode: ImportMode = 'merge'
): Promise<ImportResult> {
	const result: ImportResult = {
		success: false,
		journalsImported: 0,
		accountsImported: 0,
		vendorsImported: 0,
		errors: []
	};

	try {
		// 上書きモードの場合、既存データを削除
		if (mode === 'overwrite') {
			// 対象年度の仕訳のみ削除
			const startDate = `${data.fiscalYear}-01-01`;
			const endDate = `${data.fiscalYear}-12-31`;
			const existingJournals = await db.journals
				.where('date')
				.between(startDate, endDate, true, true)
				.toArray();

			for (const journal of existingJournals) {
				await db.journals.delete(journal.id);
			}
		}

		// 勘定科目のインポート
		for (const account of data.accounts) {
			const existing = await db.accounts.get(account.code);

			if (account.isSystem) {
				// システム科目の場合：設定（税区分、家事按分）のみ更新
				if (existing) {
					await db.accounts.update(account.code, {
						defaultTaxCategory: account.defaultTaxCategory,
						businessRatioEnabled: account.businessRatioEnabled,
						defaultBusinessRatio: account.defaultBusinessRatio
					});
				}
				continue;
			}

			// ユーザー追加科目のインポート
			if (!existing) {
				// DataCloneError回避のため、明示的にプロパティを指定
				await db.accounts.add({
					code: account.code,
					name: account.name,
					type: account.type,
					isSystem: false,
					defaultTaxCategory: account.defaultTaxCategory,
					businessRatioEnabled: account.businessRatioEnabled,
					defaultBusinessRatio: account.defaultBusinessRatio,
					createdAt: account.createdAt
				});
				result.accountsImported++;
			} else if (mode === 'overwrite') {
				// 上書きモードでも既存のユーザー科目は更新
				await db.accounts.update(account.code, {
					name: account.name,
					type: account.type,
					defaultTaxCategory: account.defaultTaxCategory,
					businessRatioEnabled: account.businessRatioEnabled,
					defaultBusinessRatio: account.defaultBusinessRatio
				});
				result.accountsImported++;
			}
		}

		// 取引先のインポート
		for (const vendor of data.vendors) {
			const existing = await db.vendors.where('name').equals(vendor.name).first();
			if (!existing) {
				// 新規追加（IDは新規生成）
				await db.vendors.add({
					id: crypto.randomUUID(),
					name: vendor.name,
					createdAt: vendor.createdAt
				});
				result.vendorsImported++;
			}
		}

		// 仕訳のインポート
		for (const journal of data.journals) {
			const existing = await db.journals.get(journal.id);

			if (!existing) {
				// 新規追加
				// DataCloneError回避のため、明示的にプロパティを指定（スプレッド演算子を避ける）
				const cleanJournal: JournalEntry = {
					id: journal.id,
					date: journal.date,
					lines: (journal.lines || []).map((line) => ({
						id: line.id,
						type: line.type,
						accountCode: line.accountCode,
						amount: line.amount,
						taxCategory: line.taxCategory,
						memo: line.memo,
						// 家事按分メタデータ
						_businessRatioApplied: line._businessRatioApplied,
						_originalAmount: line._originalAmount,
						_businessRatio: line._businessRatio,
						_businessRatioGenerated: line._businessRatioGenerated
					})),
					vendor: journal.vendor,
					description: journal.description,
					evidenceStatus: journal.evidenceStatus,
					attachments: (journal.attachments || []).map((att) => ({
						id: att.id,
						journalEntryId: att.journalEntryId,
						documentDate: att.documentDate,
						documentType: att.documentType,
						originalName: att.originalName,
						generatedName: att.generatedName,
						mimeType: att.mimeType,
						size: att.size,
						description: att.description,
						amount: att.amount,
						vendor: att.vendor,
						storageType: att.storageType,
						filePath: att.filePath,
						exportedAt: att.exportedAt,
						blobPurgedAt: att.blobPurgedAt,
						createdAt: att.createdAt
						// blob は除外（JSONにはないはず）
					})),
					createdAt: journal.createdAt,
					updatedAt: journal.updatedAt
				};
				await db.journals.add(cleanJournal);
				result.journalsImported++;
			} else if (mode === 'overwrite') {
				// 上書きモード: 既存を更新
				const cleanJournal: Partial<JournalEntry> = {
					date: journal.date,
					lines: (journal.lines || []).map((line) => ({
						id: line.id,
						type: line.type,
						accountCode: line.accountCode,
						amount: line.amount,
						taxCategory: line.taxCategory,
						memo: line.memo,
						// 家事按分メタデータ
						_businessRatioApplied: line._businessRatioApplied,
						_originalAmount: line._originalAmount,
						_businessRatio: line._businessRatio,
						_businessRatioGenerated: line._businessRatioGenerated
					})),
					vendor: journal.vendor,
					description: journal.description,
					evidenceStatus: journal.evidenceStatus,
					attachments: (journal.attachments || []).map((att) => ({
						id: att.id,
						journalEntryId: att.journalEntryId,
						documentDate: att.documentDate,
						documentType: att.documentType,
						originalName: att.originalName,
						generatedName: att.generatedName,
						mimeType: att.mimeType,
						size: att.size,
						description: att.description,
						amount: att.amount,
						vendor: att.vendor,
						storageType: att.storageType,
						filePath: att.filePath,
						exportedAt: att.exportedAt,
						blobPurgedAt: att.blobPurgedAt,
						createdAt: att.createdAt
					})),
					updatedAt: journal.updatedAt
				};
				await db.journals.update(journal.id, cleanJournal);
				result.journalsImported++;
			}
			// mergeモードで既存がある場合はスキップ
		}

		result.success = true;
	} catch (error) {
		result.errors.push(error instanceof Error ? error.message : '不明なエラー');
	}

	return result;
}

/**
 * インポート後に証憑のBlobデータを復元
 * ZIPインポート時に使用
 */
export async function restoreAttachmentBlobs(
	attachmentBlobs: Map<string, Blob>,
	storageMode: StorageType,
	directoryHandle?: FileSystemDirectoryHandle | null,
	onProgress?: (current: number, total: number) => void
): Promise<{ restored: number; failed: number; errors: string[] }> {
	const result = { restored: 0, failed: 0, errors: [] as string[] };
	const total = attachmentBlobs.size;
	let current = 0;

	// 全仕訳を取得して証憑を探す
	const journals = await db.journals.toArray();

	for (const [attachmentId, blob] of attachmentBlobs) {
		current++;
		onProgress?.(current, total);

		// この証憑が属する仕訳を検索
		let targetJournal: JournalEntry | undefined;
		let targetAttachment: Attachment | undefined;

		for (const journal of journals) {
			const attachment = journal.attachments.find((a) => a.id === attachmentId);
			if (attachment) {
				targetJournal = journal;
				targetAttachment = attachment;
				break;
			}
		}

		if (!targetJournal || !targetAttachment) {
			result.failed++;
			result.errors.push(`証憑ID ${attachmentId} に対応する仕訳が見つかりません`);
			continue;
		}

		try {
			if (storageMode === 'filesystem' && directoryHandle) {
				// ファイルシステムに保存
				const { saveFileToDirectory } = await import('$lib/utils/filesystem');
				const year = parseInt(targetAttachment.documentDate.substring(0, 4), 10);
				const file = new File([blob], targetAttachment.generatedName, {
					type: targetAttachment.mimeType
				});
				const filePath = await saveFileToDirectory(
					directoryHandle,
					year,
					targetAttachment.generatedName,
					file
				);

				// 添付ファイル情報を更新
				const updatedAttachments = targetJournal.attachments.map((a) =>
					a.id === attachmentId
						? { ...a, storageType: 'filesystem' as StorageType, filePath, blob: undefined }
						: a
				);
				await db.journals.update(targetJournal.id, { attachments: updatedAttachments });
			} else {
				// IndexedDB に Blob 保存
				const updatedAttachments = targetJournal.attachments.map((a) =>
					a.id === attachmentId
						? {
								...a,
								storageType: 'indexeddb' as StorageType,
								blob,
								filePath: undefined,
								blobPurgedAt: undefined
							}
						: a
				);
				await db.journals.update(targetJournal.id, { attachments: updatedAttachments });
			}
			result.restored++;
		} catch (error) {
			result.failed++;
			result.errors.push(
				`${targetAttachment.generatedName}: ${error instanceof Error ? error.message : '不明なエラー'}`
			);
		}
	}

	return result;
}

/**
 * インポート前のプレビュー情報を取得
 */
export async function getImportPreview(data: ExportData): Promise<{
	fiscalYear: number;
	journalCount: number;
	newJournalCount: number;
	accountCount: number;
	newAccountCount: number;
	vendorCount: number;
	newVendorCount: number;
}> {
	// 既存の仕訳ID一覧
	const existingJournalIds = new Set((await db.journals.toArray()).map((j) => j.id));

	// 既存の勘定科目コード一覧
	const existingAccountCodes = new Set((await db.accounts.toArray()).map((a) => a.code));

	// 既存の取引先名一覧
	const existingVendorNames = new Set((await db.vendors.toArray()).map((v) => v.name));

	// 新規追加される件数をカウント
	const newJournals = data.journals.filter((j) => !existingJournalIds.has(j.id));
	const newAccounts = data.accounts.filter((a) => !a.isSystem && !existingAccountCodes.has(a.code));
	const newVendors = data.vendors.filter((v) => !existingVendorNames.has(v.name));

	return {
		fiscalYear: data.fiscalYear,
		journalCount: data.journals.length,
		newJournalCount: newJournals.length,
		accountCount: data.accounts.filter((a) => !a.isSystem).length,
		newAccountCount: newAccounts.length,
		vendorCount: data.vendors.length,
		newVendorCount: newVendors.length
	};
}
