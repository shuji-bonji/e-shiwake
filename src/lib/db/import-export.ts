import type {
	Attachment,
	BackupData,
	ExportData,
	JournalEntry,
	SettingsValueMap,
	StorageType
} from '$lib/types';
import type { FixedAsset } from '$lib/types/blue-return-types';
import type { Invoice } from '$lib/types/invoice';
import { db } from './database';
import { restoreAllSettings } from './settings-repository';

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
	fixedAssetsImported: number;
	invoicesImported: number;
	settingsRestored: boolean;
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
 * BackupDataの検証（フルスナップショット形式）
 * type === 'backup' で判別
 */
export function validateBackupData(data: unknown): data is BackupData {
	if (!data || typeof data !== 'object') {
		return false;
	}

	const d = data as Record<string, unknown>;

	// BackupData 固有のフィールドチェック
	if (d.type !== 'backup') return false;
	if (typeof d.version !== 'string') return false;
	if (typeof d.exportedAt !== 'string') return false;
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
 * data.json の中身からデータ種別を判定
 *
 * @returns 'backup' | 'export' | 'unknown'
 */
export function detectDataType(data: unknown): 'backup' | 'export' | 'unknown' {
	if (validateBackupData(data)) return 'backup';
	if (validateExportData(data)) return 'export';
	return 'unknown';
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
		fixedAssetsImported: 0,
		invoicesImported: 0,
		settingsRestored: false,
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
						archived: att.archived,
						createdAt: att.createdAt
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
						archived: att.archived,
						createdAt: att.createdAt
					})),
					updatedAt: journal.updatedAt
				};
				await db.journals.update(journal.id, cleanJournal);
				result.journalsImported++;
			}
			// mergeモードで既存がある場合はスキップ
		}

		// 固定資産のインポート（v2.0.0 以降）
		if (data.fixedAssets && Array.isArray(data.fixedAssets)) {
			for (const asset of data.fixedAssets as FixedAsset[]) {
				const existing = await db.fixedAssets.get(asset.id);
				if (!existing) {
					await db.fixedAssets.add({
						id: asset.id,
						name: asset.name,
						category: asset.category,
						acquisitionDate: asset.acquisitionDate,
						acquisitionCost: asset.acquisitionCost,
						usefulLife: asset.usefulLife,
						depreciationMethod: asset.depreciationMethod,
						depreciationRate: asset.depreciationRate,
						businessRatio: asset.businessRatio,
						status: asset.status,
						disposalDate: asset.disposalDate,
						memo: asset.memo,
						createdAt: asset.createdAt,
						updatedAt: asset.updatedAt
					});
					result.fixedAssetsImported++;
				} else if (mode === 'overwrite') {
					await db.fixedAssets.update(asset.id, {
						name: asset.name,
						category: asset.category,
						acquisitionDate: asset.acquisitionDate,
						acquisitionCost: asset.acquisitionCost,
						usefulLife: asset.usefulLife,
						depreciationMethod: asset.depreciationMethod,
						depreciationRate: asset.depreciationRate,
						businessRatio: asset.businessRatio,
						status: asset.status,
						disposalDate: asset.disposalDate,
						memo: asset.memo,
						updatedAt: asset.updatedAt
					});
					result.fixedAssetsImported++;
				}
			}
		}

		// 請求書のインポート（v2.0.0 以降）
		if (data.invoices && Array.isArray(data.invoices)) {
			for (const invoice of data.invoices as Invoice[]) {
				const existing = await db.invoices.get(invoice.id);
				// DataCloneError回避: ネストした配列/オブジェクトをプレーン化
				const cleanItems = JSON.parse(JSON.stringify(invoice.items || []));
				const cleanTaxBreakdown = JSON.parse(JSON.stringify(invoice.taxBreakdown));
				if (!existing) {
					await db.invoices.add({
						id: invoice.id,
						invoiceNumber: invoice.invoiceNumber,
						issueDate: invoice.issueDate,
						dueDate: invoice.dueDate,
						vendorId: invoice.vendorId,
						items: cleanItems,
						subtotal: invoice.subtotal,
						taxAmount: invoice.taxAmount,
						total: invoice.total,
						taxBreakdown: cleanTaxBreakdown,
						status: invoice.status,
						note: invoice.note,
						journalId: invoice.journalId,
						createdAt: invoice.createdAt,
						updatedAt: invoice.updatedAt
					});
					result.invoicesImported++;
				} else if (mode === 'overwrite') {
					await db.invoices.update(invoice.id, {
						invoiceNumber: invoice.invoiceNumber,
						issueDate: invoice.issueDate,
						dueDate: invoice.dueDate,
						vendorId: invoice.vendorId,
						items: cleanItems,
						subtotal: invoice.subtotal,
						taxAmount: invoice.taxAmount,
						total: invoice.total,
						taxBreakdown: cleanTaxBreakdown,
						status: invoice.status,
						note: invoice.note,
						journalId: invoice.journalId,
						updatedAt: invoice.updatedAt
					});
					result.invoicesImported++;
				}
			}
		}

		// 全設定の復元（v2.0.0 以降）
		if (data.allSettings && typeof data.allSettings === 'object') {
			try {
				await restoreAllSettings(data.allSettings as Partial<SettingsValueMap>);
				result.settingsRestored = true;
			} catch (e) {
				result.errors.push(`設定の復元に失敗: ${e instanceof Error ? e.message : '不明なエラー'}`);
			}
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

				// 添付ファイルのメタデータを更新
				const updatedAttachments = targetJournal.attachments.map((a) =>
					a.id === attachmentId ? { ...a, storageType: 'filesystem' as StorageType, filePath } : a
				);
				await db.journals.update(targetJournal.id, { attachments: updatedAttachments });
			} else {
				// attachmentBlobs テーブルに Blob を保存
				await db.attachmentBlobs.put({ id: attachmentId, blob });

				// 添付ファイルのメタデータを更新
				const updatedAttachments = targetJournal.attachments.map((a) =>
					a.id === attachmentId
						? {
								...a,
								storageType: 'indexeddb' as StorageType,
								filePath: undefined,
								blobPurgedAt: undefined,
								archived: undefined
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
	fixedAssetCount: number;
	newFixedAssetCount: number;
	invoiceCount: number;
	newInvoiceCount: number;
	hasSettings: boolean;
}> {
	// 既存の仕訳ID一覧
	const existingJournalIds = new Set((await db.journals.toArray()).map((j) => j.id));

	// 既存の勘定科目コード一覧
	const existingAccountCodes = new Set((await db.accounts.toArray()).map((a) => a.code));

	// 既存の取引先名一覧
	const existingVendorNames = new Set((await db.vendors.toArray()).map((v) => v.name));

	// 既存の固定資産ID一覧
	const existingFixedAssetIds = new Set((await db.fixedAssets.toArray()).map((a) => a.id));

	// 既存の請求書ID一覧
	const existingInvoiceIds = new Set((await db.invoices.toArray()).map((i) => i.id));

	// 新規追加される件数をカウント
	const newJournals = data.journals.filter((j) => !existingJournalIds.has(j.id));
	const newAccounts = data.accounts.filter((a) => !a.isSystem && !existingAccountCodes.has(a.code));
	const newVendors = data.vendors.filter((v) => !existingVendorNames.has(v.name));

	const fixedAssets = (data.fixedAssets as FixedAsset[] | undefined) ?? [];
	const invoices = (data.invoices as Invoice[] | undefined) ?? [];
	const newFixedAssets = fixedAssets.filter((a) => !existingFixedAssetIds.has(a.id));
	const newInvoices = invoices.filter((i) => !existingInvoiceIds.has(i.id));

	return {
		fiscalYear: data.fiscalYear,
		journalCount: data.journals.length,
		newJournalCount: newJournals.length,
		accountCount: data.accounts.filter((a) => !a.isSystem).length,
		newAccountCount: newAccounts.length,
		vendorCount: data.vendors.length,
		newVendorCount: newVendors.length,
		fixedAssetCount: fixedAssets.length,
		newFixedAssetCount: newFixedAssets.length,
		invoiceCount: invoices.length,
		newInvoiceCount: newInvoices.length,
		hasSettings: !!data.allSettings && Object.keys(data.allSettings).length > 0
	};
}

// ==================== フルリストア（BackupData） ====================

/**
 * フルリストア結果
 */
export interface FullRestoreResult {
	success: boolean;
	journalsRestored: number;
	accountsRestored: number;
	vendorsRestored: number;
	fixedAssetsRestored: number;
	invoicesRestored: number;
	settingsRestored: boolean;
	errors: string[];
}

/**
 * BackupData からフルリストア（上書きのみ）
 *
 * 全テーブルをクリアしてバックアップデータで上書き。
 * storageMode / storageModeByYear / lastExportedAt は除外（リストア先環境に依存）。
 */
export async function importBackupData(data: BackupData): Promise<FullRestoreResult> {
	const result: FullRestoreResult = {
		success: false,
		journalsRestored: 0,
		accountsRestored: 0,
		vendorsRestored: 0,
		fixedAssetsRestored: 0,
		invoicesRestored: 0,
		settingsRestored: false,
		errors: []
	};

	try {
		// 全テーブルをクリア
		await db.journals.clear();
		await db.attachmentBlobs.clear();
		await db.accounts.clear();
		await db.vendors.clear();
		await db.fixedAssets.clear();
		await db.invoices.clear();

		// 勘定科目の復元
		for (const account of data.accounts) {
			try {
				await db.accounts.add({
					code: account.code,
					name: account.name,
					type: account.type,
					isSystem: account.isSystem,
					defaultTaxCategory: account.defaultTaxCategory,
					businessRatioEnabled: account.businessRatioEnabled,
					defaultBusinessRatio: account.defaultBusinessRatio,
					createdAt: account.createdAt
				});
				result.accountsRestored++;
			} catch (error) {
				result.errors.push(
					`勘定科目 ${account.code}: ${error instanceof Error ? error.message : '不明なエラー'}`
				);
			}
		}

		// 取引先の復元
		for (const vendor of data.vendors) {
			try {
				await db.vendors.add({
					id: vendor.id,
					name: vendor.name,
					address: vendor.address,
					contactName: vendor.contactName,
					email: vendor.email,
					phone: vendor.phone,
					paymentTerms: vendor.paymentTerms,
					note: vendor.note,
					createdAt: vendor.createdAt,
					updatedAt: vendor.updatedAt
				});
				result.vendorsRestored++;
			} catch (error) {
				result.errors.push(
					`取引先 ${vendor.name}: ${error instanceof Error ? error.message : '不明なエラー'}`
				);
			}
		}

		// 仕訳の復元
		for (const journal of data.journals) {
			try {
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
						archived: att.archived,
						createdAt: att.createdAt
					})),
					createdAt: journal.createdAt,
					updatedAt: journal.updatedAt
				};
				await db.journals.add(cleanJournal);
				result.journalsRestored++;
			} catch (error) {
				result.errors.push(
					`仕訳 ${journal.id}: ${error instanceof Error ? error.message : '不明なエラー'}`
				);
			}
		}

		// 固定資産の復元
		if (data.fixedAssets && Array.isArray(data.fixedAssets)) {
			for (const asset of data.fixedAssets as FixedAsset[]) {
				try {
					await db.fixedAssets.add({
						id: asset.id,
						name: asset.name,
						category: asset.category,
						acquisitionDate: asset.acquisitionDate,
						acquisitionCost: asset.acquisitionCost,
						usefulLife: asset.usefulLife,
						depreciationMethod: asset.depreciationMethod,
						depreciationRate: asset.depreciationRate,
						businessRatio: asset.businessRatio,
						status: asset.status,
						disposalDate: asset.disposalDate,
						memo: asset.memo,
						createdAt: asset.createdAt,
						updatedAt: asset.updatedAt
					});
					result.fixedAssetsRestored++;
				} catch (error) {
					result.errors.push(
						`固定資産 ${asset.name}: ${error instanceof Error ? error.message : '不明なエラー'}`
					);
				}
			}
		}

		// 請求書の復元
		if (data.invoices && Array.isArray(data.invoices)) {
			for (const invoice of data.invoices as Invoice[]) {
				try {
					const cleanItems = JSON.parse(JSON.stringify(invoice.items || []));
					const cleanTaxBreakdown = JSON.parse(JSON.stringify(invoice.taxBreakdown));
					await db.invoices.add({
						id: invoice.id,
						invoiceNumber: invoice.invoiceNumber,
						issueDate: invoice.issueDate,
						dueDate: invoice.dueDate,
						vendorId: invoice.vendorId,
						items: cleanItems,
						subtotal: invoice.subtotal,
						taxAmount: invoice.taxAmount,
						total: invoice.total,
						taxBreakdown: cleanTaxBreakdown,
						status: invoice.status,
						note: invoice.note,
						journalId: invoice.journalId,
						createdAt: invoice.createdAt,
						updatedAt: invoice.updatedAt
					});
					result.invoicesRestored++;
				} catch (error) {
					result.errors.push(
						`請求書 ${invoice.invoiceNumber}: ${error instanceof Error ? error.message : '不明なエラー'}`
					);
				}
			}
		}

		// 設定の復元（storageMode, storageModeByYear, lastExportedAt は除外）
		if (data.allSettings && typeof data.allSettings === 'object') {
			try {
				await restoreAllSettings(data.allSettings as Partial<SettingsValueMap>);
				result.settingsRestored = true;
			} catch (e) {
				result.errors.push(`設定の復元に失敗: ${e instanceof Error ? e.message : '不明なエラー'}`);
			}
		}

		result.success = true;
	} catch (error) {
		result.errors.push(error instanceof Error ? error.message : '不明なエラー');
	}

	return result;
}

/**
 * フルリストアのプレビュー情報を取得
 */
export function getBackupPreview(data: BackupData): {
	journalCount: number;
	accountCount: number;
	vendorCount: number;
	fixedAssetCount: number;
	invoiceCount: number;
	hasSettings: boolean;
	years: number[];
} {
	// 年度一覧を抽出
	const yearSet = new Set<number>();
	for (const journal of data.journals) {
		const year = parseInt(journal.date.substring(0, 4), 10);
		if (!isNaN(year)) yearSet.add(year);
	}

	return {
		journalCount: data.journals.length,
		accountCount: data.accounts.length,
		vendorCount: data.vendors.length,
		fixedAssetCount: data.fixedAssets?.length ?? 0,
		invoiceCount: data.invoices?.length ?? 0,
		hasSettings: !!data.allSettings && Object.keys(data.allSettings).length > 0,
		years: Array.from(yearSet).sort((a, b) => a - b)
	};
}

// ==================== アーカイブリストア（ExportData → 仕訳+証憑のみマージ） ====================

/**
 * アーカイブリストア結果
 */
export interface ArchiveRestoreResult {
	success: boolean;
	journalsRestored: number;
	journalsSkipped: number;
	errors: string[];
}

/**
 * アーカイブZIPからリストア（仕訳＋証憑のみマージ復元）
 *
 * グローバルデータ（勘定科目・取引先・固定資産・設定）は一切触らない。
 * 既存の仕訳IDと重複する場合はスキップ。
 */
export async function importArchiveData(data: ExportData): Promise<ArchiveRestoreResult> {
	const result: ArchiveRestoreResult = {
		success: false,
		journalsRestored: 0,
		journalsSkipped: 0,
		errors: []
	};

	try {
		for (const journal of data.journals) {
			const existing = await db.journals.get(journal.id);

			if (existing) {
				// 既存の仕訳IDと重複 → スキップ
				result.journalsSkipped++;
				continue;
			}

			try {
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
						archived: att.archived,
						createdAt: att.createdAt
					})),
					createdAt: journal.createdAt,
					updatedAt: journal.updatedAt
				};
				await db.journals.add(cleanJournal);
				result.journalsRestored++;
			} catch (error) {
				result.errors.push(
					`仕訳 ${journal.id}: ${error instanceof Error ? error.message : '不明なエラー'}`
				);
			}
		}

		result.success = true;
	} catch (error) {
		result.errors.push(error instanceof Error ? error.message : '不明なエラー');
	}

	return result;
}

/**
 * アーカイブリストアのプレビュー情報を取得
 */
export async function getArchiveRestorePreview(data: ExportData): Promise<{
	fiscalYear: number;
	journalCount: number;
	newJournalCount: number;
	skippedJournalCount: number;
	attachmentCount: number;
}> {
	const existingJournalIds = new Set((await db.journals.toArray()).map((j) => j.id));

	const newJournals = data.journals.filter((j) => !existingJournalIds.has(j.id));
	const skippedJournals = data.journals.filter((j) => existingJournalIds.has(j.id));

	// 新規仕訳に含まれる証憑数をカウント
	let attachmentCount = 0;
	for (const journal of newJournals) {
		attachmentCount += (journal.attachments || []).length;
	}

	return {
		fiscalYear: data.fiscalYear,
		journalCount: data.journals.length,
		newJournalCount: newJournals.length,
		skippedJournalCount: skippedJournals.length,
		attachmentCount
	};
}
