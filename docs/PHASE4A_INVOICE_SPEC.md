# Phase 4a: 請求書機能 実装指示書

## 概要

e-shiwake に請求書機能を追加する。PDF出力までを担当し、電子署名は外部ツール（Adobe等）に任せる。

## 目的

- Excel での請求書作成を廃止
- 取引先マスタの共有
- 売掛金仕訳の自動起票（オプション）
- 発行履歴の管理

---

## 1. 型定義の追加

`src/lib/types/invoice.ts` を新規作成し、以下の型を定義：

```typescript
// 請求書明細
interface InvoiceItem {
	date: string; // "1月31日" "1月分" "1/1〜1/31" 自由記述
	description: string; // "BIMツール開発支援"
	quantity: number; // 1
	unitPrice: number; // 500000
	amount: number; // 自動計算（quantity × unitPrice）
	taxRate: 10 | 8; // 消費税率
}

// 請求書
interface Invoice {
	id: string;
	invoiceNumber: string; // "14104"
	issueDate: string; // 発行日（ISO形式）
	dueDate: string; // 支払期限（ISO形式）
	vendorId: string; // 取引先ID

	items: InvoiceItem[];

	subtotal: number; // 税抜合計
	taxAmount: number; // 消費税合計
	total: number; // 税込合計

	taxBreakdown: {
		taxable10: number; // 10%対象（税抜）
		tax10: number; // 10%消費税
		taxable8: number; // 8%対象（税抜）
		tax8: number; // 8%消費税
	};

	status: 'draft' | 'issued' | 'paid';
	note?: string;
	journalId?: string; // 連携した仕訳ID
	createdAt: string;
	updatedAt: string;
}

// 取引先（既存Vendorを拡張）
interface Vendor {
	id: string;
	name: string;
	address?: string;
	paymentTerms?: string; // "月末締め翌月末払い"
	note?: string;
	createdAt: string;
	updatedAt: string;
}

// 事業者情報（settings に保存）
interface BusinessInfo {
	name: string; // 氏名・屋号
	postalCode?: string;
	address?: string;
	phone?: string;
	email?: string;
	invoiceRegistrationNumber?: string; // T + 13桁
	bankName?: string;
	bankBranch?: string;
	accountType?: '普通' | '当座';
	accountNumber?: string;
	accountHolder?: string;
	sealImage?: string; // 印影（Base64）
}
```

`src/lib/types/index.ts` に export を追加。

---

## 2. データベーススキーマ更新

`src/lib/db/index.ts` に Version 7 を追加：

```typescript
// クラスに追加
invoices!: EntityTable<Invoice, 'id'>;

// Version 7
this.version(7)
  .stores({
    accounts: 'code, name, type, isSystem',
    vendors: 'id, name',
    journals: 'id, date, vendor, evidenceStatus',
    attachments: 'id, journalEntryId',
    settings: 'key',
    fixedAssets: '&id, name, category, acquisitionDate, status',
    invoices: '&id, invoiceNumber, issueDate, vendorId, status'
  })
  .upgrade(async (tx) => {
    const now = new Date().toISOString();
    // 既存 vendors に createdAt, updatedAt を追加
    await tx.table('vendors').toCollection().modify((vendor: any) => {
      if (!vendor.createdAt) vendor.createdAt = now;
      if (!vendor.updatedAt) vendor.updatedAt = now;
    });
  });
```

SettingsKey に `'businessInfo'` を追加。

---

## 3. CRUD関数の実装

`src/lib/db/index.ts` に以下を追加：

### 請求書

- `getAllInvoices(): Promise<Invoice[]>`
- `getInvoiceById(id: string): Promise<Invoice | undefined>`
- `getInvoicesByYear(year: number): Promise<Invoice[]>`
- `getInvoicesByVendor(vendorId: string): Promise<Invoice[]>`
- `getInvoicesByStatus(status: InvoiceStatus): Promise<Invoice[]>`
- `addInvoice(input: InvoiceInput): Promise<string>`
- `updateInvoice(id: string, updates: InvoiceUpdate): Promise<void>`
- `deleteInvoice(id: string): Promise<void>`
- `generateNextInvoiceNumber(): Promise<string>`

### 金額計算

- `calculateInvoiceAmounts(items: InvoiceItem[]): { subtotal, taxAmount, total, taxBreakdown }`
- `calculateItemAmount(item: Omit<InvoiceItem, 'amount'>): number`

### 取引先（拡張）

- `getVendorById(id: string): Promise<Vendor | undefined>`
- `addVendor(input: VendorInput): Promise<string>`
- `updateVendor(id: string, updates: VendorUpdate): Promise<void>`
- `deleteVendor(id: string): Promise<void>` （請求書で使用中はエラー）
- `isVendorInUseByInvoice(id: string): Promise<boolean>`

---

## 4. ユーティリティ関数

`src/lib/utils/invoice-journal.ts` を新規作成：

### 売掛金仕訳の生成

```typescript
// 請求書発行時の仕訳
// 借方: 売掛金（税込）
// 貸方: 売上高（税抜） + 仮受消費税
function generateSalesJournal(invoice: Invoice, vendor: Vendor): JournalEntry;

// 入金時の仕訳
// 借方: 普通預金
// 貸方: 売掛金
function generateDepositJournal(
	invoice: Invoice,
	vendor: Vendor,
	depositDate: string
): JournalEntry;
```

---

## 5. 画面実装

### 5.1 サイドバーに追加

`src/routes/+layout.svelte` のサイドバーに「請求書」メニューを追加：

```
📄 請求書  ← 新規追加（帳簿セクションの下あたり）
```

### 5.2 請求書一覧ページ

`src/routes/invoice/+page.svelte`

- 年度別フィルタ
- ステータス別フィルタ（下書き / 発行済み / 入金済み）
- 新規作成ボタン
- 一覧表示（請求番号、発行日、取引先、金額、ステータス）
- 行クリックで編集

### 5.3 請求書作成・編集ページ

`src/routes/invoice/[id]/+page.svelte` または モーダル/シートで実装

**入力項目：**

- 請求書番号（自動採番 or 手入力）
- 発行日（デフォルト: 今日）
- 支払期限（デフォルト: 取引先の paymentTerms から計算）
- 取引先（選択 or 新規作成）
- 明細行（複数行）
  - 日付（自由記述）
  - 詳細
  - 数量
  - 単価
  - 税率（10% / 8%）
  - 金額（自動計算）
- 備考

**表示項目（自動計算）：**

- 10%対象（税抜）、10%消費税
- 8%対象（税抜）、8%消費税（あれば）
- 合計

**アクション：**

- 保存（下書き）
- 発行（ステータス変更）
- PDF出力
- 仕訳を作成（オプション）
- 削除

### 5.4 取引先管理ページ

`src/routes/vendors/+page.svelte`

- 一覧表示
- 新規作成
- 編集
- 削除（請求書で使用中は不可）

### 5.5 事業者情報設定

`src/routes/settings/+page.svelte` または既存の設定画面に追加

- 氏名・屋号
- 住所
- 適格請求書発行事業者登録番号
- 振込先口座情報
- 印影画像アップロード

---

## 6. PDF出力

### 方式

`window.print()` を使用。印刷用CSSで請求書フォーマットを整形。

### レイアウト（参考: 添付の請求書PDF）

```
┌─────────────────────────────────────────────────────┐
│                      請求書                          │
├─────────────────────────────────────────────────────┤
│ 株式会社○○○ 御中                    No.14104      │
│                                     発行日 令和X年X月X日│
│                                                     │
│ 請求金額: ¥550,000（税込）           ┌──────────┐  │
│                                     │ 事業者情報  │  │
│ 平素は格別のご高配を賜り...           │ 住所       │  │
│                                     │ 氏名  [印] │  │
│                                     └──────────┘  │
├─────────────────────────────────────────────────────┤
│ 日付    │ 詳細           │ 数量 │ 単価    │ 金額   │
│ 1月31日 │ BIMツール開発支援 │ 1   │ 500,000 │ 500,000│
│         │                │      │         │        │
├─────────────────────────────────────────────────────┤
│                          10%対象（税抜）    500,000 │
│                          10%消費税           50,000 │
│                          合計            ¥550,000  │
├─────────────────────────────────────────────────────┤
│ 振込先                                              │
│ 銀行: ○○銀行 ○○支店                              │
│ 普通 1234567                                        │
│ 名義人: ○○ ○○                                    │
│                                                     │
│ 支払い日: 2026年3月6日                              │
├─────────────────────────────────────────────────────┤
│ 備考                                                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 印刷用CSS

```css
@media print {
	/* サイドバー等を非表示 */
	.sidebar,
	.no-print {
		display: none !important;
	}

	/* 請求書を1ページに収める */
	.invoice-print {
		width: 210mm;
		min-height: 297mm;
		padding: 20mm;
	}
}
```

---

## 7. ファイル構成

```
src/
├── lib/
│   ├── types/
│   │   ├── index.ts          # export追加
│   │   └── invoice.ts        # 新規: 請求書関連型
│   ├── db/
│   │   └── index.ts          # Version 7 追加
│   ├── utils/
│   │   └── invoice-journal.ts # 新規: 仕訳生成
│   └── components/
│       └── invoice/          # 新規
│           ├── InvoiceForm.svelte
│           ├── InvoiceItemRow.svelte
│           ├── InvoicePreview.svelte
│           └── InvoicePrint.svelte
└── routes/
    ├── invoice/              # 新規
    │   ├── +page.svelte      # 一覧
    │   └── [id]/
    │       └── +page.svelte  # 編集
    ├── vendors/              # 新規
    │   └── +page.svelte      # 取引先管理
    └── +layout.svelte        # サイドバー更新
```

---

## 8. 実装順序

1. 型定義（`invoice.ts`）
2. DBスキーマ更新（Version 7）
3. CRUD関数
4. 事業者情報設定画面
5. 取引先管理画面
6. 請求書一覧画面
7. 請求書作成・編集画面
8. PDF出力
9. 仕訳連携（オプション）

---

## 9. 注意事項

- 既存の `Vendor` 型を拡張するため、マイグレーションで `createdAt`, `updatedAt` を追加
- 請求書番号は `YYMM + 連番2桁` 形式で自動採番（例: 260201）
- PDF出力は `window.print()` でシンプルに実装
- 仕訳連携は「仕訳を作成」ボタンで手動実行（自動ではない）
- インボイス制度対応：登録番号の表示、税率別の内訳表示

---

## 10. 添付ファイル

以下のファイルを参考に実装：

- `invoice-types.ts` - 型定義の詳細
- `db-migration-v7.ts` - DBマイグレーションとCRUD関数
- `invoice-journal.ts` - 仕訳生成ユーティリティ
