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
 * 勘定科目
 */
export interface Account {
	code: string; // 勘定科目コード（例: "100", "401"）
	name: string; // 勘定科目名（例: "現金", "旅費交通費"）
	type: AccountType; // 5カテゴリ
	isSystem: boolean; // システム初期データか、ユーザー追加か
	createdAt: string; // 作成日時 ISO8601
}

/**
 * 取引先
 */
export interface Vendor {
	id: string; // UUID
	name: string; // 取引先名
	createdAt: string; // 作成日時 ISO8601
}

/**
 * 証跡ステータス
 */
export type EvidenceStatus = 'none' | 'paper' | 'digital';

/**
 * 仕訳明細行
 */
export interface JournalLine {
	id: string; // UUID
	type: 'debit' | 'credit'; // 借方 or 貸方
	accountCode: string; // 勘定科目コード
	amount: number; // 金額（電帳法: 取引金額）
	memo?: string; // 行メモ（按分理由など）
}

/**
 * 添付ファイル（証憑）
 */
export interface Attachment {
	id: string; // UUID
	journalEntryId: string; // 紐付く仕訳ID
	originalName: string; // 元のファイル名
	generatedName: string; // 自動生成されたファイル名
	mimeType: string; // application/pdf など
	size: number; // ファイルサイズ（bytes）
	blob?: Blob; // IndexedDB保存用（iPad向け）
	createdAt: string;
}

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
 * 設定
 */
export interface Settings {
	fiscalYearStart: number; // 会計年度開始月（1-12、個人は通常1）
	defaultCurrency: string; // 通貨コード（JPY）
	outputDirectoryHandle?: FileSystemDirectoryHandle; // 保存先ディレクトリ
	licenseKey?: string; // 有料オプション用ライセンスキー
}

/**
 * エクスポートデータ
 */
export interface ExportData {
	version: string; // データフォーマットバージョン
	exportedAt: string; // エクスポート日時
	fiscalYear: number; // 会計年度
	journals: JournalEntry[];
	accounts: Account[];
	vendors: Vendor[];
	settings: Settings;
}
