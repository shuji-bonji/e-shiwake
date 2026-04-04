// Branded Types（公称型）の再エクスポート
export type { UUID, AccountCode, DateString, ISODateTimeString } from './branded';
export {
	isAccountCode,
	isDateString,
	isUUID,
	asAccountCode,
	asDateString,
	asUUID,
	asISODateTime
} from './branded';

// 会計ロジック用ユーティリティ型の再エクスポート
export type {
	DebitCredit,
	IncreaseSide,
	DecreaseSide,
	DebitBalanceType,
	CreditBalanceType,
	SalesTaxCategory,
	PurchaseTaxCategory,
	TaxableTaxCategory,
	NonTaxableCategory,
	ExpenseTaxCategory,
	RevenueTaxCategory,
	AssetTaxCategory,
	LiabilityEquityTaxCategory,
	AllowedTaxCategory
} from './accounting';
export {
	isDebitBalanceType,
	getIncreaseSide,
	getDecreaseSide,
	isIncrease,
	calculateBalance,
	getAllowedTaxCategories,
	isValidTaxCategoryForAccount
} from './accounting';

/**
 * 勘定科目カテゴリ
 */
export type AccountType =
	| 'asset' // 資産
	| 'liability' // 負債
	| 'equity' // 純資産（資本）
	| 'revenue' // 収益
	| 'expense'; // 費用

/**
 * 勘定科目カテゴリの日本語ラベル
 */
export const AccountTypeLabels: Record<AccountType, string> = {
	asset: '資産',
	liability: '負債',
	equity: '純資産',
	revenue: '収益',
	expense: '費用'
};

/**
 * 消費税率
 */
export type TaxRate = 10 | 8 | 0;

/**
 * 消費税区分
 */
export type TaxCategory =
	| 'sales_10' // 課税売上10%
	| 'sales_8' // 課税売上8%（軽減税率）
	| 'purchase_10' // 課税仕入10%
	| 'purchase_8' // 課税仕入8%（軽減税率）
	| 'exempt' // 非課税
	| 'out_of_scope' // 不課税
	| 'na'; // 対象外（事業主勘定等）

/**
 * 消費税区分のラベル
 */
export const TaxCategoryLabels: Record<TaxCategory, string> = {
	sales_10: '課売10%',
	sales_8: '課売8%',
	purchase_10: '課仕10%',
	purchase_8: '課仕8%',
	exempt: '非課税',
	out_of_scope: '不課税',
	na: '対象外'
};

/**
 * 消費税区分の短縮ラベル（UI用）
 */
export const TaxCategoryShortLabels: Record<TaxCategory, string> = {
	sales_10: '売10',
	sales_8: '売8',
	purchase_10: '仕10',
	purchase_8: '仕8',
	exempt: '非課',
	out_of_scope: '不課',
	na: '−'
};

/**
 * 勘定科目
 */
export interface Account {
	code: string; // 勘定科目コード（例: "100", "401"）
	name: string; // 勘定科目名（例: "現金", "旅費交通費"）
	type: AccountType; // 5カテゴリ
	isSystem: boolean; // システム初期データか、ユーザー追加か
	defaultTaxCategory?: TaxCategory; // デフォルト消費税区分
	createdAt: string; // 作成日時 ISO8601
	// 家事按分関連
	businessRatioEnabled?: boolean; // 家事按分対象かどうか
	defaultBusinessRatio?: number; // デフォルト事業割合（0-100）
}

/**
 * 取引先
 */
export interface Vendor {
	id: string; // UUID
	name: string; // 取引先名
	address?: string; // 住所
	contactName?: string; // 担当者名
	email?: string; // メールアドレス
	phone?: string; // 電話番号
	paymentTerms?: string; // 支払条件（"月末締め翌月末払い"など）
	note?: string; // メモ
	createdAt: string; // 作成日時 ISO8601
	updatedAt?: string; // 更新日時 ISO8601
}

/**
 * 証跡ステータス
 */
export type EvidenceStatus = 'none' | 'paper' | 'digital';

/**
 * 証憑の保存タイプ
 */
export type StorageType = 'filesystem' | 'indexeddb';

/**
 * 書類の種類
 */
export type DocumentType =
	| 'invoice' // 請求書（発行）
	| 'bill' // 請求書（受領）
	| 'receipt' // 領収書
	| 'contract' // 契約書
	| 'estimate' // 見積書
	| 'other'; // その他

/**
 * 書類の種類の日本語ラベル
 */
export const DocumentTypeLabels: Record<DocumentType, string> = {
	invoice: '請求書（発行）',
	bill: '請求書（受領）',
	receipt: '領収書',
	contract: '契約書',
	estimate: '見積書',
	other: 'その他'
};

/**
 * 仕訳明細行
 */
export interface JournalLine {
	id: string; // UUID
	type: 'debit' | 'credit'; // 借方 or 貸方
	accountCode: string; // 勘定科目コード
	amount: number; // 金額（電帳法: 取引金額）
	taxCategory?: TaxCategory; // 消費税区分
	memo?: string; // 行メモ（按分理由など）
	// 家事按分メタデータ（内部管理用、エクスポート時は除外）
	_businessRatioApplied?: boolean; // 按分適用済みフラグ
	_originalAmount?: number; // 按分前の元金額
	_businessRatio?: number; // 適用した按分率
	_businessRatioGenerated?: boolean; // 按分で自動生成された行（事業主貸）
}

/**
 * 添付ファイル（証憑）
 *
 * Blob は attachmentBlobs テーブルに分離保存。
 * 仕訳レコード内にはメタデータのみを保持する。
 */
export interface Attachment {
	id: string; // UUID
	journalEntryId: string; // 紐付く仕訳ID
	documentDate: string; // 書類の日付（電帳法の取引年月日）YYYY-MM-DD
	documentType: DocumentType; // 書類の種類
	originalName: string; // 元のファイル名
	generatedName: string; // 自動生成されたファイル名
	mimeType: string; // application/pdf など
	size: number; // ファイルサイズ（bytes）
	// ファイル名生成用メタデータ（リネーム時に使用）
	description: string; // 摘要（仕訳名）
	amount: number; // 金額
	vendor: string; // 取引先
	// 保存場所による分岐
	storageType: StorageType; // 保存タイプ
	filePath?: string; // ファイルシステム保存時のパス（{年度}/{ファイル名}）
	exportedAt?: string; // エクスポート済み日時（IndexedDB保存時）
	blobPurgedAt?: string; // Blob削除日時（容量管理用）
	archived?: boolean; // アーカイブ済みフラグ（Blob削除済み、ZIP復元可能）
	createdAt: string;
}

/**
 * 証憑の Blob データ（attachmentBlobs テーブルに保存）
 *
 * 仕訳の Attachment.id と同じ id で紐付く。
 */
export interface AttachmentBlob {
	id: string; // Attachment.id と同一
	blob: Blob; // PDF 実体
}

/**
 * エクスポート用証憑（メタデータのみ）
 */
export type ExportAttachment = Attachment;

/**
 * 仕訳
 */
export interface JournalEntry {
	id: string; // UUID
	date: string; // 取引日 YYYY-MM-DD（電帳法: 取引年月日）
	lines: JournalLine[]; // 仕訳明細行（複数行対応）
	vendor: string; // 取引先名（電帳法: 取引先名）
	description: string; // 摘要
	evidenceStatus: EvidenceStatus; // 証跡ステータス
	attachments: Attachment[]; // 紐付けられた証憑
	createdAt: string; // 作成日時 ISO8601
	updatedAt: string; // 更新日時 ISO8601
}

/**
 * エクスポート用仕訳（証憑のBlobを除外したDTO）
 */
export interface ExportJournalEntry extends Omit<JournalEntry, 'attachments'> {
	attachments: ExportAttachment[];
}

/**
 * 設定
 */
export type SettingsKey =
	| 'storageMode'
	| 'storageModeByYear'
	| 'lastExportedAt'
	| 'autoPurgeBlobAfterExport'
	| 'blobRetentionDays'
	| 'businessInfo'
	| 'suppressRenameConfirm'
	| 'blueReturnDeduction'
	| 'inventoryStart'
	| 'inventoryEnd'
	| 'dismissedUpgradeNotice';

// BusinessInfoはblue-return-types.tsで定義（循環参照を避けるため、ここではanyを使用）
// 実際の型は $lib/types/blue-return-types.ts の BusinessInfo を参照
export type SettingsValueMap = {
	storageMode: StorageType;
	storageModeByYear: Record<string, StorageType>;
	lastExportedAt: string;
	autoPurgeBlobAfterExport: boolean;
	blobRetentionDays: number;
	businessInfo: import('./blue-return-types').BusinessInfo;
	suppressRenameConfirm: boolean;
	blueReturnDeduction: 65 | 55 | 10;
	inventoryStart: number;
	inventoryEnd: number;
	/** 非表示にしたアップグレード通知のバージョン（例: "0.4.0"） */
	dismissedUpgradeNotice: string;
};

export interface Settings {
	fiscalYearStart: number; // 会計年度開始月（1-12、個人は通常1）
	defaultCurrency: string; // 通貨コード（JPY）
	storageMode: StorageType; // 現在の保存モード
	outputDirectoryHandle?: FileSystemDirectoryHandle; // 保存先ディレクトリ（filesystem時）
	lastExportedAt?: string; // 最終エクスポート日時（indexeddb時）
	// 容量管理設定
	autoPurgeBlobAfterExport: boolean; // エクスポート後に自動削除（デフォルト: true）
	blobRetentionDays: number; // 削除までの猶予日数（デフォルト: 30）
	licenseKey?: string; // 有料オプション用ライセンスキー
}

/**
 * エクスポートデータ（年度スコープ）
 *
 * version "1.0.0": 初期フォーマット（journals, accounts, vendors, settings）
 * version "2.0.0": 固定資産・請求書・全設定を追加（後方互換: 追加フィールドはoptional）
 *
 * エクスポート（CSV/JSON）およびアーカイブで使用。
 * 旧バックアップ（v0.3.1以前）もこの型。
 */
export interface ExportData {
	version: string; // データフォーマットバージョン
	exportedAt: string; // エクスポート日時
	fiscalYear: number; // 会計年度
	journals: JournalEntry[];
	accounts: Account[];
	vendors: Vendor[];
	settings: Settings;
	// v2.0.0 追加フィールド（optional で v1 との後方互換を維持）
	fixedAssets?: import('./blue-return-types').FixedAsset[];
	invoices?: import('./invoice').Invoice[];
	allSettings?: Partial<SettingsValueMap>; // IndexedDB の全設定キーバリュー
}

/**
 * バックアップデータ（フルスナップショット）
 *
 * v0.4.0 で導入。全年度の全データを含むスナップショット。
 * リストアは上書きのみ（マージなし）。
 */
export interface BackupData {
	type: 'backup'; // ZIP判別用
	version: '3.0.0';
	exportedAt: string;
	journals: JournalEntry[]; // 全年度
	accounts: Account[]; // 全件
	vendors: Vendor[]; // 全件
	fixedAssets: import('./blue-return-types').FixedAsset[]; // 全件
	invoices: import('./invoice').Invoice[]; // 全年度
	allSettings: Partial<SettingsValueMap>;
}

/**
 * ZIP/JSONエクスポート用データ（Blobを除外したDTO）
 */
export interface ExportDataDTO extends Omit<ExportData, 'journals'> {
	journals: ExportJournalEntry[];
}

/**
 * ストレージ使用状況
 */
export interface StorageUsage {
	used: number; // 使用中（bytes）
	quota: number; // 上限（bytes）
	percentage: number; // 使用率（0-100）
}

// ============================================================
// 決算・申告関連の型定義
// ============================================================

/**
 * 損益計算書の行
 */
export interface ProfitLossRow {
	accountCode: string;
	accountName: string;
	amount: number;
}

/**
 * 損益計算書データ
 */
export interface ProfitLossData {
	fiscalYear: number;
	// 収益
	salesRevenue: ProfitLossRow[]; // 売上高
	otherRevenue: ProfitLossRow[]; // 雑収入など
	totalRevenue: number; // 収益合計
	// 費用
	costOfSales: ProfitLossRow[]; // 売上原価（仕入など）
	operatingExpenses: ProfitLossRow[]; // 販売費及び一般管理費
	totalExpenses: number; // 費用合計
	// 利益
	grossProfit: number; // 売上総利益（売上 - 売上原価）
	operatingIncome: number; // 営業利益
	netIncome: number; // 当期純利益
}

/**
 * 貸借対照表の行
 */
export interface BalanceSheetRow {
	accountCode: string;
	accountName: string;
	amount: number;
}

/**
 * 貸借対照表データ
 */
export interface BalanceSheetData {
	fiscalYear: number;
	// 資産の部
	currentAssets: BalanceSheetRow[]; // 流動資産
	fixedAssets: BalanceSheetRow[]; // 固定資産
	totalAssets: number; // 資産合計
	// 負債の部
	currentLiabilities: BalanceSheetRow[]; // 流動負債
	fixedLiabilities: BalanceSheetRow[]; // 固定負債
	totalLiabilities: number; // 負債合計
	// 純資産の部
	equity: BalanceSheetRow[]; // 純資産
	retainedEarnings: number; // 繰越利益（当期純利益）
	totalEquity: number; // 純資産合計
	// 貸借バランス
	totalLiabilitiesAndEquity: number; // 負債・純資産合計
}

/**
 * 消費税集計の行
 */
export interface ConsumptionTaxRow {
	taxCategory: TaxCategory;
	taxCategoryLabel: string;
	taxableAmount: number; // 税抜金額
	taxAmount: number; // 消費税額
}

/**
 * 消費税集計データ
 */
export interface ConsumptionTaxData {
	fiscalYear: number;
	// 課税売上
	salesRows: ConsumptionTaxRow[];
	totalTaxableSales: number; // 課税売上合計（税抜）
	totalSalesTax: number; // 売上に係る消費税額
	// 課税仕入
	purchaseRows: ConsumptionTaxRow[];
	totalTaxablePurchases: number; // 課税仕入合計（税抜）
	totalPurchaseTax: number; // 仕入に係る消費税額
	// 納付税額
	netTaxPayable: number; // 納付すべき消費税額（売上税額 - 仕入税額）
	// 非課税・不課税の参考情報
	exemptSales: number; // 非課税売上
	outOfScopeSales: number; // 不課税売上
	exemptPurchases: number; // 非課税仕入
	outOfScopePurchases: number; // 不課税仕入
}
