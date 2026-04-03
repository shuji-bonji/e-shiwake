You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

## Available MCP Tools:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.

---

# e-shiwake 開発ガイド

## Svelte MCP Server

Svelte MCP server を利用可能。Svelte 5 と SvelteKit のドキュメントにアクセスできる。

### 利用可能なツール

1. **list-sections** - ドキュメントセクション一覧を取得（最初に実行）
2. **get-documentation** - 特定セクションのドキュメントを取得
3. **svelte-autofixer** - Svelte コードの問題を分析・修正提案（コード作成時は必ず使用）
4. **playground-link** - Svelte Playground リンクを生成

## アプリ概要

### 名称

**e-shiwake**（電子仕訳）

### 目的

フリーランス・個人事業主向けの仕訳入力 + 証憑管理 PWA

### 特徴

- **ローカルファースト**: サーバー不要、IndexedDB にデータ保存
- **電帳法対応**: 日本の電子帳簿保存法の検索要件を満たす
- **証憑管理**: PDF を仕訳に紐付け、自動リネームして保存
- **PWA**: オフライン動作、インストール可能
- **全年度横断検索**: 摘要、取引先、勘定科目、金額、日付で検索可能
- **帳簿機能**: 総勘定元帳、試算表、損益計算書、貸借対照表、消費税集計
- **帳簿出力**: 複数帳簿の一括印刷、CSV ZIP出力
- **請求書管理**: 請求書の作成・編集・印刷、仕訳自動生成

### ターゲットユーザー

- 日本のフリーランス・個人事業主
- 確定申告を自分で行う人
- クラウド会計の月額課金を避けたい人

## 技術スタック

- **フレームワーク**: SvelteKit
- **言語**: TypeScript
- **UI**: shadcn-svelte + Tailwind CSS v4
- **データ保存**: IndexedDB（Dexie.js 推奨）
- **ファイル操作**: File System Access API（デスクトップ）
- **PWA**: Service Worker + Web App Manifest

## データモデル

### JournalEntry（仕訳）

複合仕訳（借方/貸方が複数行）に対応。

```typescript
interface JournalEntry {
	id: string; // UUID
	date: string; // 取引日 YYYY-MM-DD（電帳法: 取引年月日）
	lines: JournalLine[]; // 仕訳明細行（複数行対応）
	vendor: string; // 取引先名（電帳法: 取引先名）
	description: string; // 摘要
	evidenceStatus: 'none' | 'paper' | 'digital'; // 証跡ステータス
	attachments: Attachment[]; // 紐付けられた証憑
	createdAt: string; // 作成日時 ISO8601
	updatedAt: string; // 更新日時 ISO8601
}
```

### JournalLine（仕訳明細行）

```typescript
interface JournalLine {
	id: string; // UUID
	type: 'debit' | 'credit'; // 借方 or 貸方
	accountCode: string; // 勘定科目コード
	amount: number; // 金額（電帳法: 取引金額）
	taxCategory?: TaxCategory; // 消費税区分
	memo?: string; // 行メモ（按分理由など）
}

type TaxCategory =
	| 'sales_10' // 課税売上10%
	| 'sales_8' // 課税売上8%（軽減税率）
	| 'purchase_10' // 課税仕入10%
	| 'purchase_8' // 課税仕入8%（軽減税率）
	| 'exempt' // 非課税
	| 'out_of_scope' // 不課税
	| 'na'; // 対象外（事業主勘定等）
```

**消費税区分の使い分け**:

- 課税売上/仕入（10%/8%）: 通常の課税取引
- 非課税: 土地売買、住宅家賃、社会保険料など
- 不課税: 給与、配当金、国外取引など
- 対象外: 事業主勘定など消費税計算に含めない項目

**複合仕訳の例：家事按分**

```
借方：通信費    8,000円（事業分80%）
借方：事業主貸  2,000円（家事分20%）
貸方：普通預金 10,000円
```

**複合仕訳の例：源泉徴収**

```
借方：売掛金   90,000円
貸方：売上   100,000円
貸方：仮受金  10,000円（源泉所得税）
```

**バリデーション**: 借方合計 === 貸方合計 を必ず検証する。

### Attachment（証憑）

```typescript
interface Attachment {
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
	storageType: 'filesystem' | 'indexeddb'; // 保存タイプ
	blob?: Blob; // IndexedDB保存時のみ
	filePath?: string; // ファイルシステム保存時のパス（{年度}/{ファイル名}）
	createdAt: string;
}

type DocumentType =
	| 'invoice' // 請求書（発行）
	| 'bill' // 請求書（受領）
	| 'receipt' // 領収書
	| 'contract' // 契約書
	| 'estimate' // 見積書
	| 'other'; // その他
```

**書類の日付と仕訳の日付の違い**:

- 仕訳の日付: 会計上の認識日
- 書類の日付: 書類に記載された日付（電帳法の「取引年月日」）
- ほとんどのケースで一致するが、請求→入金のような場合は異なる

**仕訳との連動**:

- 仕訳の日付・摘要・金額・取引先を変更すると、紐付いている証憑のファイル名も自動更新される
- 証憑側で個別に編集することも可能（編集ダイアログから）

### Account（勘定科目マスタ）

```typescript
interface Account {
	code: string; // 勘定科目コード（4桁、例: "1001", "5005"）
	name: string; // 勘定科目名（例: "現金", "旅費交通費"）
	type: AccountType; // 5カテゴリ
	isSystem: boolean; // システム初期データか、ユーザー追加か
	createdAt: string;
}

type AccountType =
	| 'asset' // 資産
	| 'liability' // 負債
	| 'equity' // 純資産（資本）
	| 'revenue' // 収益
	| 'expense'; // 費用
```

**勘定科目コード体系（4桁）**:

```
[カテゴリ][区分][連番]
   ↓       ↓    ↓
   1桁目   2桁目 3-4桁目
```

| 桁      | 意味     | 値                                       |
| ------- | -------- | ---------------------------------------- |
| 1桁目   | カテゴリ | 1:資産, 2:負債, 3:純資産, 4:収益, 5:費用 |
| 2桁目   | 区分     | 0:システム, 1:ユーザー追加               |
| 3-4桁目 | 連番     | 01-99                                    |

**例**:

- `1001` = 資産・システム・01番（現金）
- `5005` = 費用・システム・05番（旅費交通費）
- `5101` = 費用・ユーザー追加・01番

**勘定科目管理**:

- 5カテゴリごとにグループ表示
- 新規追加（カテゴリ選択 → コード自動採番）
- ユーザー追加科目のみ編集・削除可能（使用中の科目は削除不可）
- システム科目（`isSystem: true`）は按分設定・デフォルト消費税区分のみ編集可能
- デフォルト消費税区分を設定可能（仕訳入力時に自動適用）
- 消費税区分変更時に既存仕訳の一括更新オプション

### Vendor（取引先マスタ）

```typescript
interface Vendor {
	id: string;
	name: string; // 取引先名
	address?: string; // 住所
	contactName?: string; // 担当者名
	email?: string; // メールアドレス
	phone?: string; // 電話番号
	paymentTerms?: string; // 支払条件
	createdAt: string;
	updatedAt: string;
}
```

### Invoice（請求書）

```typescript
interface Invoice {
	id: string; // UUID
	invoiceNumber: string; // 請求書番号（自動採番、例: INV-2026-0001）
	issueDate: string; // 発行日（YYYY-MM-DD）
	dueDate: string; // 支払期限（YYYY-MM-DD）
	vendorId: string; // 取引先ID
	items: InvoiceItem[]; // 明細行
	subtotal: number; // 税抜合計
	taxAmount: number; // 消費税合計
	total: number; // 税込合計
	taxBreakdown: {
		taxable10: number; // 10%対象（税抜）
		tax10: number; // 10%消費税
		taxable8: number; // 8%対象（税抜）
		tax8: number; // 8%消費税
	};
	status: 'draft' | 'issued' | 'paid'; // ステータス
	note?: string; // 備考
	journalId?: string; // 紐付く仕訳ID（売掛金計上時）
	createdAt: string;
	updatedAt: string;
}

interface InvoiceItem {
	id: string; // UUID
	date: string; // 自由記述（"1月分", "1/1〜1/31"など）
	description: string; // 品名・サービス名
	quantity: number; // 数量
	unitPrice: number; // 単価
	amount: number; // 金額（自動計算: quantity × unitPrice）
	taxRate: 10 | 8; // 消費税率
}
```

**請求書ステータス**:

- `draft`: 下書き - 作成中の請求書
- `issued`: 発行済み - 取引先に送付した請求書
- `paid`: 入金済み - 入金が確認された請求書

**仕訳自動生成**:

- 売掛金仕訳: 請求書から売上計上仕訳を生成
  - 借方: 売掛金（税込合計）
  - 貸方: 売上高（10%対象、8%対象それぞれ）
- 入金仕訳: 入金日を指定して入金仕訳を生成
  - 借方: 普通預金（税込合計）
  - 貸方: 売掛金（税込合計）

### Settings（設定）

```typescript
interface Settings {
	fiscalYearStart: number; // 会計年度開始月（1-12、個人は通常1）
	defaultCurrency: string; // 通貨コード（JPY）
	outputDirectoryHandle?: FileSystemDirectoryHandle; // 保存先ディレクトリ
	licenseKey?: string; // ライセンスキー（将来用）
}
```

### 年度管理

**会計年度の判定**:

```typescript
// 年度判定（個人事業主は1月〜12月）
function getFiscalYear(date: string, fiscalYearStart: number): number {
	const d = new Date(date);
	const month = d.getMonth() + 1;
	const year = d.getFullYear();

	// 開始月より前なら前年度
	return month < fiscalYearStart ? year - 1 : year;
}
```

**年度一覧の自動生成**:

- IndexedDB 内の仕訳から年度を抽出
- サイドバーに年度一覧を表示
- 選択した年度でフィルタリング

**7年保存対応**:

- 電帳法により証憑は7年間保存が必要
- 年度アーカイブ機能で過去データを ZIP エクスポート
- 任意で古い年度を DB から削除可能（容量対策）

## 画面構成

### サイトマップ

```
/                           # 仕訳帳（ホーム）
├── /ledger                 # 総勘定元帳
├── /trial-balance          # 試算表
├── /profit-loss            # 損益計算書
├── /balance-sheet          # 貸借対照表
├── /tax-summary            # 消費税集計
├── /fixed-assets           # 固定資産台帳
├── /blue-return            # 青色申告決算書
├── /reports                # 帳簿出力（一括印刷・CSV ZIP）
├── /invoice                # 請求書一覧
├── /invoice/[id]           # 請求書編集
├── /vendors                # 取引先管理
├── /accounts               # 勘定科目管理
├── /data                   # データ管理（エクスポート/インポート/削除）
├── /export                 # エクスポート（レガシー）
└── /help                   # ヘルプ トップ
    ├── /getting-started    # はじめに
    ├── /journal            # 仕訳入力
    ├── /ledger             # 総勘定元帳
    ├── /trial-balance      # 試算表
    ├── /tax-category       # 消費税区分
    ├── /evidence           # 証憑管理
    ├── /accounts           # 勘定科目
    ├── /fixed-assets       # 固定資産台帳
    ├── /blue-return        # 青色申告決算書
    ├── /invoice            # 請求書
    ├── /data-management    # データ管理
    ├── /pwa                # PWA・インストール
    ├── /shortcuts          # キーボードショートカット
    ├── /glossary           # 用語集
    └── /webmcp             # WebMCP（AIエージェント連携）
```

**URL**: `https://shuji-bonji.github.io/e-shiwake/`

### レイアウト

サイドバー + メインコンテンツのレイアウト。shadcn-svelte の Sidebar コンポーネントを使用。

```
┌─────────────────┬────────────────────────────────────────────────┐
│  e-shiwake      │                                                │
├─────────────────┤  メインコンテンツ                               │
│                 │                                                │
│  📅 年度        │  （選択中のページを表示）                        │
│  ├─ 2025       │                                                │
│  ├─ 2024  ●    │                                                │
│  └─ 2023       │                                                │
│                 │                                                │
├─────────────────┤                                                │
│                 │                                                │
│  📒 帳簿        │                                                │
│  ├─ 仕訳帳     │                                                │
│  ├─ 総勘定元帳  │                                                │
│  └─ 試算表     │                                                │
│                 │                                                │
├─────────────────┤                                                │
│                 │                                                │
│  ⚙️ 管理        │                                                │
│  ├─ 勘定科目   │                                                │
│  ├─ 設定       │                                                │
│  └─ データ管理 │                                                │
│                 │                                                │
└─────────────────┴────────────────────────────────────────────────┘
```

**レスポンシブ対応**:

- デスクトップ: サイドバー常時表示
- タブレット: 折りたたみ可能（アイコンのみ表示）
- モバイル: ハンバーガーメニュー → ドロワー表示

### 1. 仕訳帳（ホーム）

メイン画面。選択中の年度の仕訳を時系列（日付降順）で表示。

```
┌──────────────────────────────────────────────────────────────────────────┐
│  仕訳帳 - 2024年度                                    [➕ 新規仕訳]      │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│ ┌──────────────────────────────────────────────────────────────┬───────┐ │
│ │ 📎 2025-01-15  USBケーブル購入  Amazon                   [🗑]│ 📄    │ │
│ │   借方            3,980円  │  貸方            3,980円        │ 領収書│ │
│ │   [⬆費用] 消耗品費  3,980  │  [⬇資産] 普通預金  3,980       │       │ │
│ └──────────────────────────────────────────────────────────────┴───────┘ │
│                                                                          │
│ ┌──────────────────────────────────────────────────────────────┬───────┐ │
│ │ ○  2025-01-10  電車代                                    [🗑]│       │ │
│ │   借方            1,200円  │  貸方            1,200円        │       │ │
│ │   [⬆費用] 旅費交通費 1,200 │  [⬇資産] 現金      1,200       │       │ │
│ └──────────────────────────────────────────────────────────────┴───────┘ │
│                                                                          │
│  （最初は空、「➕ 新規仕訳 で最初の仕訳を追加しましょう」）               │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**証跡ステータスアイコン**:

- ○（グレー）= 証跡なし
- 📄 = 紙で保管
- 📎 = 電子データ紐付け済み

### 2. 仕訳入力（インライン）

**新規追加フロー**:

1. [➕ 新規仕訳] ボタン押下
2. 一覧の一番下に空の仕訳行が追加される
3. インラインで入力（日付、摘要、取引先、勘定科目、金額）
4. 入力確定後、日付順の適切な位置に自動移動
5. スクロールも移動先に追従

**インライン編集**:

- 各フィールドを直接クリックして編集
- オートセーブ（変更即保存）

**仕訳行の構造**:

```
┌────────────────────────────────────────────────────────────────┬──────────┐
│ [証跡] [日付] [摘要___________] [取引先] [確定] [🗑]           │  証憑    │
├────────────────────────────────────────────────────────────────┤  エリア  │
│   借方              10,000円 [+] │   貸方          10,000円 [+]│          │
│   ┌─────────────────────────────┐│   ┌────────────────────────┐│  ┌────┐ │
│   │[⬆] [勘定科目▼] [金額]      ││   │[⬇] [勘定科目▼] [金額] ││  │ 📄 │ │
│   └─────────────────────────────┘│   └────────────────────────┘│  └────┘ │
└────────────────────────────────────────────────────────────────┴──────────┘
```

- ヘッダー行: 証跡ステータス、日付、摘要、取引先、確定ボタン（編集中のみ）、削除ボタン
- 借方/貸方: それぞれ合計金額と[+]ボタンがヘッダーに表示
- 種別アイコン: 各行の左端に表示（⬆増加/⬇減少）
- 証憑エリア: 右側にPDFドロップゾーン（複数添付可能）

**複合仕訳の追加**:

- 借方ヘッダーの[+]ボタン → 借方行を追加
- 貸方ヘッダーの[+]ボタン → 貸方行を追加

**借方/貸方と増減のルール**:

複式簿記では、勘定科目の種別によって借方・貸方に来る条件が決まっている。

| 種別   | 増加 | 減少 |
| ------ | ---- | ---- |
| 資産   | 借方 | 貸方 |
| 負債   | 貸方 | 借方 |
| 純資産 | 貸方 | 借方 |
| 収益   | 貸方 | ―    |
| 費用   | 借方 | ―    |

**種別アイコンの意味**:

- ⬆ = 増加
- ⬇ = 減少

**種別アイコン（借方側）**:
| アイコン | 意味 |
|---------|------|
| ⬆資産 | 資産の増加（現金が入った、など） |
| ⬆費用 | 費用の発生（経費を使った、など） |
| ⬇負債 | 負債の減少（借入金を返した、など） |

**種別アイコン（貸方側）**:
| アイコン | 意味 |
|---------|------|
| ⬇資産 | 資産の減少（現金を払った、など） |
| ⬆負債 | 負債の増加（借入をした、など） |
| ⬆収益 | 収益の発生（売上が立った、など） |

**色分け**:

- 資産: 青（text-blue-500）
- 負債/純資産: 紫（text-purple-500）
- 収益: 緑（text-green-500）
- 費用: 赤（text-red-500）

**複合仕訳の例（家事按分）**:

```
┌────────────────────────────────────────────────────────────────┬──────────┐
│ 📎 2025-01-20  携帯電話代  NTTドコモ                       [🗑]│  証憑    │
├────────────────────────────────────────────────────────────────┤  エリア  │
│   借方              10,000円     │   貸方          10,000円    │          │
│   ┌─────────────────────────────┐│   ┌────────────────────────┐│  ┌────┐ │
│   │[⬆費用] 通信費     │  8,000 ││   │[⬇資産] 普通預金│10,000││  │ 📄 │ │
│   │[⬆    ] 事業主貸   │  2,000 ││   └────────────────────────┘│  │領収│ │
│   └─────────────────────────────┘│                             │  └────┘ │
└────────────────────────────────────────────────────────────────┴──────────┘
```

**削除**:

- 🗑ボタンクリック → 確認ダイアログ「削除しますか？」

**バリデーション**:

- 借方合計 ≠ 貸方合計 の場合、警告表示（赤枠など）
- 勘定科目が未選択の行がある場合も警告表示
- 確定ボタンはバリデーションが通るまで無効化

### 3. 証憑紐付け

- 仕訳行に PDF をドラッグ＆ドロップ
- 取引先未入力の場合、入力を促すツールチップ表示
- 紐付け後、証跡ステータスが 📎 に変更
- 証跡アイコンクリックで PDF プレビュー表示
- 添付ファイル横の編集アイコンから証憑情報を編集可能

**証憑編集ダイアログ**:

- 書類の日付、書類の種類、仕訳名（摘要）、金額、取引先を編集可能
- 編集するとファイル名も自動更新される
- ファイルシステム保存の場合、実ファイルもリネームされる

**仕訳変更時の自動同期**:

- 仕訳の日付・摘要・取引先・金額を変更すると、紐付いた証憑のファイル名も自動更新

### 4. 勘定科目管理

- 5カテゴリ（資産/負債/純資産/収益/費用）ごとにグループ表示
- 新規科目追加（カテゴリ選択 → コード自動採番）
- ユーザー追加科目のみ編集・削除可能（使用中の科目は削除不可）
- システム科目は按分設定・デフォルト消費税区分のみ編集可能
- システム初期データとユーザー追加を「システム」「カスタム」バッジで区別表示

**デフォルト消費税区分**:

- 各勘定科目にデフォルトの消費税区分を設定可能
- 仕訳入力時に自動で適用される
- カテゴリ別の選択肢:
  - 費用: 課仕10%、課仕8%、非課税、不課税、対象外
  - 収益: 課売10%、課売8%、非課税、不課税、対象外
  - 資産: 対象外、課仕10%、課仕8%
  - 負債・純資産: 対象外

**消費税区分の同期**:

- 既存の勘定科目の消費税区分を変更すると確認ダイアログを表示
- 「既存の仕訳も一括で更新する」オプションで仕訳の消費税区分を一括変更可能
- チェックを外すと、既存の仕訳は変更されず新規仕訳から適用

### 5. 設定

- **証憑保存設定**: filesystem（デスクトップ向け）/ indexeddb（iPad向け）切り替え
- **出力ディレクトリ選択**: File System Access API対応時のみ
- **ストレージ使用状況**: IndexedDB使用量の表示
- **容量管理**: エクスポート後の自動削除、保持日数設定

### 6. データ管理

データのエクスポート・インポートを一元管理するページ。

```
┌──────────────────────────────────────────────────────────────────┐
│  🗃️ データ管理                                                   │
├──────────────────────────────────────────────────────────────────┤
│  ⚠️ N件の証憑が未エクスポートです（IndexedDBモード時のみ表示）    │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📤 エクスポート                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 📅 2024年度（2024/1/1 - 2024/12/31）                       │  │
│  │ 仕訳数: 342件          証憑: 128ファイル                   │  │
│  │ [JSON] [CSV] [証憑ダウンロード] [ZIP]                     │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 📅 2023年度 ...                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  📥 インポート                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ [ファイルを選択]                                           │  │
│  │ プレビュー表示 → マージ/上書きモード選択 → 実行            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ℹ️ 電帳法により、証憑は7年間の保存が必要です                     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**エクスポート形式**:

| 形式   | 内容                            | 用途                             | 状態 |
| ------ | ------------------------------- | -------------------------------- | ---- |
| JSON   | 仕訳 + 勘定科目 + 取引先 + 設定 | バックアップ、移行               | ✅   |
| CSV    | 仕訳のみ（フラット形式）        | 他ソフト連携                     | ✅   |
| 証憑DL | IndexedDB内の証憑PDFを個別DL    | iPad向けバックアップ             | ✅   |
| ZIP    | JSON + PDF 証憑同梱             | 完全バックアップ、年次アーカイブ | ✅   |

**JSONエクスポート構造**:

```typescript
interface ExportData {
	version: string; // データフォーマットバージョン
	exportedAt: string; // エクスポート日時
	fiscalYear: number; // 会計年度
	journals: JournalEntry[];
	accounts: Account[];
	vendors: Vendor[];
	settings: Settings;
}
```

## コア機能

### 仕訳 CRUD

- 作成・読取・更新・削除
- IndexedDB に保存

### PDF 証憑紐付け

1. 仕訳入力画面で PDF をドラッグ＆ドロップ
2. 取引先未入力の場合、入力を促す
3. 自動リネーム: `{日付}_{種類}_{摘要}_{金額}円_{取引先}.pdf`
   - 例: `2025-01-15_領収書_USBケーブル購入_3,980円_Amazon.pdf`
4. 保存先:
   - デスクトップ: File System Access API で選択したディレクトリ（年度別フォルダ）
   - iPad/Safari: IndexedDB に Blob として保存
5. 仕訳の日付・摘要・金額・取引先を変更すると、証憑のファイル名も自動更新
6. 証憑の編集ダイアログから個別に情報を編集可能

### 証跡ステータス管理

- `none`: 証跡なし（現金取引など）
- `paper`: 紙の領収書で保管
- `digital`: 電子データ紐付け済み
- クリックでトグル切り替え

### 仕訳検索（全年度横断）

仕訳帳画面の検索ボックスから、**全年度を対象に**仕訳を検索できる。

**検索可能な項目**:

| 入力例       | 検索対象     | 説明                   |
| ------------ | ------------ | ---------------------- |
| `Amazon`     | 摘要・取引先 | テキスト部分一致       |
| `消耗品費`   | 勘定科目     | 科目名の前方一致       |
| `10000`      | 金額         | 完全一致               |
| `10,000`     | 金額         | カンマ付き金額も可     |
| `2025-01`    | 年月         | その月の仕訳を表示     |
| `12月`       | 月           | 全年度の12月の仕訳     |
| `2025-01-15` | 日付         | 特定の日付             |
| `10/13`      | 月日         | 全年度の10月13日の仕訳 |
| `1/5`        | 月日         | ゼロ埋めなし形式も可   |

**複数条件の検索（AND検索）**:

スペースで区切って複数の条件を入力すると、すべてに一致する仕訳を表示。

- `Amazon 12月` → Amazonの12月の仕訳
- `消耗品費 10000` → 消耗品費で1万円の仕訳

**実装ファイル**:

- `$lib/utils/journal-search.ts` - 検索クエリのパースとフィルタリング
- `$lib/components/journal/SearchHelp.svelte` - 検索ヘルプポップオーバー

### 仕訳コピー

既存の仕訳をコピーして新規作成できる。定期的な支払いなどで便利。

- コピーボタン（📋）をクリック
- 日付は今日の日付に自動設定
- 証憑（添付ファイル）はコピーされない

**実装ファイル**: `$lib/utils/journal-copy.ts`

### 請求書コピー

既存の請求書をコピーして新規作成できる。毎月同じ取引先に発行する場合に便利。

- 一覧のコピーボタン（📋）をクリック
- 発行日は今日、支払期限は翌月末に自動設定
- 請求書番号は自動採番
- ステータスは下書きにリセット、仕訳紐付けはクリア
- 取引先・明細行・備考はそのまま引き継ぎ

**実装ファイル**: `$lib/utils/invoice-copy.ts`

### エクスポート / インポート

**エクスポート（無料）**:

- JSON: 完全なデータ構造を保持（バックアップ / 移行用）
- CSV: 仕訳のみフラット形式（他ソフト連携用）
- 証憑ダウンロード: IndexedDB内の証憑PDFを個別ダウンロード（iPad向け）
- ZIP: JSON + PDF 証憑同梱（完全バックアップ / 年次アーカイブ用）

**インポート（設定ページ）**:

- JSON: バックアップからの復元、他端末からの移行
- **マージモード**: 既存データを残し、新規データのみ追加
- **上書きモード**: 対象年度の既存データを削除して置き換え
- インポート前にプレビュー表示（仕訳数、勘定科目数、取引先数）
- 証憑ファイル（PDF）はインポートされない（別途保存が必要）

## 電帳法対応

### 検索要件（必須 3 項目）

1. **取引年月日**: `date` フィールド
2. **取引金額**: `debit.amount` / `credit.amount`
3. **取引先名**: `vendor` フィールド

### ファイル命名規則

```
{書類の日付}_{種類}_{摘要}_{金額}円_{取引先名}.pdf
```

**種類ラベルの対応**:

| DocumentType | ファイル名の種類部分 |
| ------------ | -------------------- |
| invoice      | 請求書発行           |
| bill         | 請求書               |
| receipt      | 領収書               |
| contract     | 契約書               |
| estimate     | 見積書               |
| other        | その他               |

例:

```
2024-01-15_領収書_USBケーブル購入_3,980円_Amazon.pdf
2024-01-15_請求書発行_売掛金計上 INV-2024-0001_100,000円_クライアントA.pdf
2024-01-15_請求書_サーバー利用料_10,000円_AWS.pdf
2024-01-15_契約書_業務委託契約_0円_取引先A.pdf
```

この命名規則により、ファイル名だけで検索要件をクリア。

**エッジケース対応**:

- 摘要が空の場合 → 「未分類」に自動置換
- 取引先が空の場合 → 「不明」に自動置換
- ファイル名が240バイトを超える場合 → 摘要部分を自動切り詰め
- 手動編集されたファイル名はバリデーション（禁止文字、パストラバーサル、.pdf重複、バイト長）

**自動更新**:

- 仕訳の日付・摘要・金額・取引先を変更すると、紐付いた証憑のファイル名も連動して更新
- ファイルシステム保存の場合、実ファイルもリネームされる
- リネーム失敗時はメタデータも変更しない（不整合防止）

### 対象

電子で受け取った請求書・領収書・見積書・契約書等。
紙で受け取ったものは電帳法の電子取引保存の対象外。

## 既知の課題

### ストレージモードとデータ移行

現在、証憑の保存先として2つのモードがある。

- **filesystem**: デスクトップ向け（File System Access API）
- **indexeddb**: iPad/Safari向け（ブラウザ内保存）

**課題**:

| シナリオ                               | 問題点                             |
| -------------------------------------- | ---------------------------------- |
| Chrome(filesystem) → Safari(indexeddb) | `filePath`のみでファイル実体がない |
| Safari(indexeddb) → Chrome(filesystem) | blobがなく、ファイルも存在しない   |
| 端末移行時                             | 証憑PDFが引き継がれない            |

**現状の対応**:

- JSONエクスポートは「仕訳データのみ」と割り切る
- 証憑PDFは手動でフォルダごとコピー
- データ管理ページに注意書きを表示

**将来の改善案**:

- ZIPインポート実装（JSON + PDF同梱）で端末間移行をシームレスに

## 開発フェーズ

### Phase 1: MVP ✅ 完了

- [x] サイドバーレイアウト
- [x] 年度管理（選択 / フィルタリング）
- [x] 仕訳 CRUD（複合仕訳対応、インライン編集）
- [x] 勘定科目マスタ（初期データ込み）
- [x] 勘定科目管理ページ（追加/編集/削除）
- [x] 取引先オートコンプリート
- [x] PDF 紐付け + 自動リネーム
- [x] 証跡ステータス管理
- [x] IndexedDB 保存（Dexie）
- [x] JSON / CSV エクスポート
- [x] 証憑ダウンロード（iPad向け）
- [x] JSON インポート

### Phase 1.5: PWA & UX強化 ✅ 完了

PWA化とUX改善を行うフェーズ。帳簿機能追加前に基盤を固める。

- [x] PWA対応（@vite-pwa/sveltekit + Workbox）
- [x] Service Worker（自動生成 + キャッシング戦略）
- [x] Web App Manifest（アイコン、メタ情報）
- [x] インストール可能（Add to Home Screen）
- [x] ダークモード / ライトモード / システム設定 切り替え
- [x] 消費税区分（課税売上/仕入 10%/8%、非課税、不課税、対象外）
- [x] ストレージマイグレーション機能（ブラウザ ⇔ ローカルフォルダ間の証憑移行）
- [x] 仕訳入力のタブ順序最適化（日付→摘要→借方→貸方→取引先→PDF→循環）
- [x] 仕訳検索機能（全年度横断、複数条件AND検索）
- [x] 仕訳コピー機能

**実装詳細**:

- `@vite-pwa/sveltekit` を使用したService Worker自動生成
- Workboxによるアセットキャッシング（precache）
- テーマ設定はlocalStorageに保存、システム設定への追従対応
- iOS Safari対応（apple-mobile-web-app-\*メタタグ）
- 消費税計算ユーティリティ（`$lib/utils/tax.ts`）

### Phase 2: 帳簿機能 ✅ 完了

- [x] 総勘定元帳（科目別取引履歴、残高推移、CSV出力、印刷/PDF保存）
- [x] 試算表（合計残高試算表/残高試算表、貸借一致チェック、CSV出力、印刷/PDF保存）

**実装詳細**:

- `$lib/utils/ledger.ts` - 総勘定元帳生成ロジック
- `$lib/utils/trial-balance.ts` - 試算表生成ロジック
- `/ledger` - 総勘定元帳ページ（科目選択、前後ナビ、CSV出力、印刷/PDF）
- `/trial-balance` - 試算表ページ（表示モード切替、貸借一致チェック、印刷/PDF）
- `src/routes/layout.css` - 印刷用スタイル（@media print）

### Phase 3: 確定申告対応 ✅ 完了

- [x] 損益計算書（売上総利益、営業利益、当期純利益、CSV出力、印刷/PDF）
- [x] 貸借対照表（流動/固定資産・負債、純資産、貸借一致チェック、CSV出力、印刷/PDF）
- [x] 消費税集計（課税売上/仕入、納付税額計算、免税・簡易課税判定、CSV出力）
- [x] 帳簿出力（複数帳簿の一括印刷、CSV ZIP出力）
- [x] 固定資産台帳（CRUD、減価償却シミュレーション、CSV出力）
- [x] 青色申告決算書生成（4ページプレビュー、設定ダイアログ、印刷/CSV出力）
- [x] 完全バックアップ（ZIP: JSON + PDF）

**実装詳細**:

- `$lib/types/index.ts` - 決算・申告関連の型定義（ProfitLossData, BalanceSheetData, ConsumptionTaxData）
- `$lib/types/blue-return-types.ts` - 青色申告決算書関連の型定義（BlueReturnData, FixedAsset, DepreciationAssetRow等）
- `$lib/utils/profit-loss.ts` - 損益計算書生成ロジック
- `$lib/utils/balance-sheet.ts` - 貸借対照表生成ロジック
- `$lib/utils/consumption-tax.ts` - 消費税集計ロジック
- `$lib/utils/monthly-summary.ts` - 月別売上・仕入集計、2ページ目データ生成
- `$lib/utils/depreciation.ts` - 減価償却費計算、3ページ目データ生成
- `$lib/utils/blue-return.ts` - 青色申告決算書統合生成、1・4ページ目データ生成
- `/profit-loss` - 損益計算書ページ
- `/balance-sheet` - 貸借対照表ページ
- `/tax-summary` - 消費税集計ページ
- `/reports` - 帳簿出力ページ（一括印刷・CSV ZIP出力）
- `/fixed-assets` - 固定資産台帳ページ（CRUD、減価償却シミュレーション）
- `/blue-return` - 青色申告決算書ページ（4ページプレビュー、設定、印刷/CSV出力）

### Phase 4: 国際展開

- [ ] i18n 対応（多言語化）
- [ ] 多通貨対応

**なぜ最後か**:

- i18nは全テキストに影響し、後から追加すると大規模な改修が必要
- ただし、ベースアプリが安定してからの方が効率的
- 多通貨は日本のフリーランス向けでは優先度低

## コーディング規約

### ファイル構成

```
src/
├── lib/
│   ├── components/     # 再利用可能なコンポーネント
│   │   ├── ui/         # shadcn-svelte コンポーネント
│   │   ├── layout/
│   │   │   ├── AppSidebar.svelte    # サイドバー
│   │   │   └── AppHeader.svelte     # ヘッダー（モバイル用）
│   │   ├── journal/
│   │   │   ├── JournalEntry.svelte  # 仕訳行コンポーネント
│   │   │   ├── JournalLine.svelte   # 仕訳明細行（借方/貸方）
│   │   │   ├── PdfDropZone.svelte   # PDF ドラッグ＆ドロップ
│   │   │   └── SearchHelp.svelte    # 検索ヘルプポップオーバー
│   │   ├── AccountSelect.svelte     # 勘定科目オートコンプリート
│   │   ├── VendorInput.svelte       # 取引先オートコンプリート
│   │   └── EvidenceStatus.svelte    # 証跡ステータスアイコン
│   ├── stores/         # Svelte stores
│   │   └── fiscalYear.svelte.ts     # 選択中の年度
│   ├── db/             # IndexedDB 関連（Dexie）
│   ├── types/          # TypeScript 型定義
│   └── utils/          # ユーティリティ関数
│       ├── fiscalYear.ts            # 年度判定
│       ├── export.ts                # エクスポート処理
│       ├── zip-export.ts            # ZIPエクスポート処理
│       ├── journal-search.ts        # 仕訳検索（クエリパース、フィルタリング）
│       ├── journal-copy.ts          # 仕訳コピー
│       ├── business-ratio.ts        # 家事按分（適用、解除、自動計算）
│       ├── clone.ts                 # ディープクローン（Blob保持）
│       ├── monthly-summary.ts       # 月別売上・仕入集計
│       ├── depreciation.ts          # 減価償却費計算
│       ├── blue-return.ts           # 青色申告決算書生成
│       ├── invoice.ts               # 請求書ユーティリティ（金額計算、日付処理等）
│       ├── invoice-copy.ts          # 請求書コピー
│       ├── invoice-journal.ts       # 請求書→仕訳生成（売掛金、入金）
│       └── debounce.ts              # デバウンスユーティリティ（共通）
├── routes/
│   ├── +layout.svelte        # サイドバーレイアウト
│   ├── +page.svelte          # 仕訳帳（ホーム）
│   ├── ledger/               # 総勘定元帳
│   ├── trial-balance/        # 試算表
│   ├── profit-loss/          # 損益計算書
│   ├── balance-sheet/        # 貸借対照表
│   ├── tax-summary/          # 消費税集計
│   ├── reports/              # 帳簿出力（一括印刷・CSV ZIP）
│   ├── invoice/              # 請求書一覧
│   ├── invoice/[id]/         # 請求書編集（自動保存）
│   ├── vendors/              # 取引先管理
│   ├── accounts/             # 勘定科目管理
│   ├── data/                 # データ管理（エクスポート+インポート）
│   └── help/                 # ヘルプ
```

### 命名規則

- コンポーネント: PascalCase（`JournalEntryCard.svelte`）
- 関数/変数: camelCase
- 型/インターフェース: PascalCase
- 定数: UPPER_SNAKE_CASE

### Svelte 5 ルーン

- `$state()` でリアクティブな状態管理
- `$derived()` で派生値
- `$effect()` で副作用

## 注意事項

- **ユーザー認証なし**: ローカルオンリーなので認証不要
- **サーバーサイドなし**: SvelteKit の SSR は使わない、SPA モード
- **iPad 対応**: File System Access API が使えないため、IndexedDB + エクスポートで対応
- **PWA**: Service Worker でオフライン動作必須

### ページの追加・削除・変更時の更新チェックリスト

ルート（ページ）を追加・削除・変更した際は、以下のファイルも更新すること：

1. **`svelte.config.js`** — `prerender.entries` にルートを追加/削除
2. **`static/sitemap.xml`** — `<url>` エントリを追加/削除
3. **`CLAUDE.md`** — 「サイトマップ」セクションのルート一覧を更新
4. **`README.md`** — 「ページ構成」セクションのルート一覧を更新

ヘルプページの場合はさらに：

5. **`content.md`** + **`llms.txt/+server.ts`** の作成/削除
6. **CLAUDE.md** — 「llms.txtエンドポイント一覧」テーブルを更新

## ヘルプページ・llms.txt 管理

### 概要

ヘルプページには2種類のコンテンツがある：

1. **Svelteコンポーネント** (`+page.svelte`) - ブラウザ表示用（スタイリング付き）
2. **Markdownファイル** (`content.md`) - LLM用プレーンテキスト（llms.txt経由で配信）

### ファイル構造

```
src/routes/help/{slug}/
├── +page.svelte          # ブラウザ表示用（HelpSection, HelpTable等を使用）
├── content.md            # LLM用Markdownコンテンツ
└── llms.txt/
    └── +server.ts        # content.mdを配信するエンドポイント
```

### 更新手順

ヘルプページを更新・追加する際は、以下の両方を更新する：

1. **`+page.svelte`** - UIコンポーネントを使ったHTML版
2. **`content.md`** - 同じ内容のMarkdown版

**注意**: 内容の一貫性を保つため、片方だけ更新しないこと。

### 新規ヘルプページ追加時

1. `src/routes/help/{slug}/+page.svelte` を作成
2. `src/routes/help/{slug}/content.md` を作成（同じ内容をMarkdownで）
3. `src/routes/help/{slug}/llms.txt/+server.ts` を作成：

   ```typescript
   import content from '../content.md?raw';

   export const prerender = true;

   export function GET() {
   	return new Response(content, {
   		headers: {
   			'Content-Type': 'text/plain; charset=utf-8'
   		}
   	});
   }
   ```

4. `svelte.config.js` の `prerender.entries` に追加：
   - `/help/{slug}`
   - `/help/{slug}/llms.txt`

5. `static/sitemap.xml` に `<url>` エントリを追加

### llms.txtエンドポイント一覧

| URL                              | 内容                                       |
| -------------------------------- | ------------------------------------------ |
| `/llms.txt`                      | サービス概要・機能一覧・各ヘルプへのリンク |
| `/help/getting-started/llms.txt` | はじめに                                   |
| `/help/journal/llms.txt`         | 仕訳入力                                   |
| `/help/ledger/llms.txt`          | 総勘定元帳                                 |
| `/help/trial-balance/llms.txt`   | 試算表                                     |
| `/help/tax-category/llms.txt`    | 消費税区分                                 |
| `/help/evidence/llms.txt`        | 証憑管理                                   |
| `/help/accounts/llms.txt`        | 勘定科目管理                               |
| `/help/fixed-assets/llms.txt`    | 固定資産台帳                               |
| `/help/blue-return/llms.txt`     | 青色申告決算書                             |
| `/help/invoice/llms.txt`         | 請求書                                     |
| `/help/data-management/llms.txt` | 設定・データ管理                           |
| `/help/pwa/llms.txt`             | PWA・オフライン                            |
| `/help/shortcuts/llms.txt`       | ショートカット                             |
| `/help/glossary/llms.txt`        | 用語集                                     |
| `/help/webmcp/llms.txt`          | WebMCP（AIエージェント連携）               |

### Markdownの書式ガイドライン

- `# 見出し1` はページタイトルに使用
- `## 見出し2` はセクション（HelpSectionのtitleに対応）
- `> **INFO**:` / `> **TIP**:` / `> **WARNING**:` でノートを表現
- テーブルはMarkdown形式で記述
- コードブロックは ``` で囲む

## バージョンアップ手順

リリース時に更新が必要なファイルと手順。

### バージョン番号の管理

- **`package.json`** の `version` フィールドが唯一のバージョン定義元（Single Source of Truth）
- Vite の `define` で `__APP_VERSION__` としてアプリに注入される（`vite.config.ts`）
- サイドバーフッター（`SidebarFooter.svelte`）に自動表示される
- 型定義は `app.d.ts` の `declare const __APP_VERSION__: string`

### リリース時の更新チェックリスト

1. **`package.json`** — `version` フィールドを更新（例: `"0.2.2"` → `"0.3.0"`）
2. **`CHANGELOG.md`** — `[Unreleased]` セクションの内容を新バージョンに移動、日付を記入、リンクを更新
3. **git tag** — `git tag v0.3.0` でタグを打つ
4. **GitHub Pages デプロイ** — `main` にマージ後、GitHub Actions で自動デプロイ

### バージョニング方針（Semantic Versioning）

| 変更種別                       | バージョン        | 例                       |
| ------------------------------ | ----------------- | ------------------------ |
| 破壊的変更（データ形式変更等） | メジャー（x.0.0） | IndexedDB スキーマ変更   |
| 新機能追加                     | マイナー（0.x.0） | 新ページ追加、新帳簿機能 |
| バグ修正・改善                 | パッチ（0.0.x）   | ロジック修正、UI改善     |

### CHANGELOG.md の書き方

[Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に準拠：

- **Added** — 新機能
- **Changed** — 既存機能の変更
- **Fixed** — バグ修正
- **Removed** — 削除された機能
- **Security** — セキュリティ修正

開発中の変更は `[Unreleased]` セクションに蓄積し、リリース時にバージョン番号と日付を付与する。
