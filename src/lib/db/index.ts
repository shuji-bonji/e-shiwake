/**
 * e-shiwake データベースモジュール
 *
 * リポジトリパターンで分割されたサブモジュールを再エクスポート。
 * 全ての消費側は `import { ... } from '$lib/db'` のまま利用可能。
 */

// ==================== Database ====================
export { db, initializeDatabase } from './database';
export type { SettingsRecord } from './database';

// ==================== Accounts ====================
export {
	getAccountsByType,
	getAllAccounts,
	addAccount,
	updateAccount,
	deleteAccount,
	isAccountInUse,
	isSystemAccount,
	generateNextCode
} from './account-repository';

// ==================== Journals ====================
export {
	getJournalsByYear,
	getAllJournals,
	getAvailableYears,
	getJournalById,
	addJournal,
	updateJournal,
	deleteJournal,
	countJournalLinesByAccountCode,
	updateTaxCategoryByAccountCode,
	deleteYearData,
	createEmptyJournal,
	validateJournal
} from './journal-repository';

// ==================== Vendors ====================
export {
	saveVendor,
	getAllVendors,
	searchVendors,
	getVendorById,
	addVendorWithDetails,
	updateVendor,
	isVendorInUseByInvoice,
	isVendorInUseByJournal,
	deleteVendor
} from './vendor-repository';

// ==================== Attachments ====================
export {
	DocumentTypeShortLabels,
	UNPAID_ACCOUNT_CODES,
	generateAttachmentName,
	suggestDocumentType,
	isAttachmentBlobPurged,
	addAttachmentToJournal,
	removeAttachmentFromJournal,
	getAttachmentBlob,
	updateAttachment,
	syncAttachmentsWithJournal
} from './attachment-repository';
export type { AttachmentParams, AttachmentUpdateParams } from './attachment-repository';

// ==================== Settings ====================
export {
	getSetting,
	setSetting,
	getStorageMode,
	setStorageMode,
	getLastExportedAt,
	setLastExportedAt,
	getUnexportedAttachmentCount,
	markAttachmentAsExported,
	getAutoPurgeBlobSetting,
	setAutoPurgeBlobSetting,
	getSuppressRenameConfirm,
	setSuppressRenameConfirm,
	getBlobRetentionDays,
	setBlobRetentionDays,
	getPurgeableBlobCount,
	purgeExportedBlobs,
	purgeAllExportedBlobs
} from './settings-repository';

// ==================== Import / Export ====================
export {
	validateExportData,
	importData,
	restoreAttachmentBlobs,
	getImportPreview
} from './import-export';
export type { ImportMode, ImportResult } from './import-export';

// ==================== Migration ====================
export {
	getAttachmentsForMigration,
	migrateAttachmentToFilesystem,
	migrateAttachmentToIndexedDB,
	getFilesystemAttachmentCount,
	getAttachmentsForFolderMigration,
	migrateAttachmentToNewFolder
} from './migration';
export type { MigrationAttachment, FolderMigrationItem } from './migration';

// ==================== Fixed Assets ====================
export {
	getAllFixedAssets,
	getActiveFixedAssets,
	getFixedAssetById,
	addFixedAsset,
	updateFixedAsset,
	deleteFixedAsset,
	markFixedAssetAsSold,
	markFixedAssetAsDisposed
} from './fixed-asset-repository';

// ==================== Invoices ====================
export {
	getAllInvoices,
	getInvoiceById,
	getInvoicesByYear,
	getInvoicesByVendor,
	getInvoicesByStatus,
	addInvoice,
	updateInvoice,
	deleteInvoice,
	generateNextInvoiceNumber
} from './invoice-repository';

// ==================== Test Data ====================
export { seedTestData2024 } from './test-data';
