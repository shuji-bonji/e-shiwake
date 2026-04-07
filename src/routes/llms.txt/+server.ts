export const prerender = true;

// UTF-8 BOM（バイトオーダーマーク）- 静的ファイルサーバーでの文字化け対策
const UTF8_BOM = '\uFEFF';

const content = `# e-shiwake - 電子仕訳

> 日本のフリーランス・個人事業主向けの無料会計PWAアプリケーション。
> サーバー不要・ブラウザだけで完結するローカルファースト設計。

- URL: https://shuji-bonji.github.io/e-shiwake/
- ソースコード: https://github.com/shuji-bonji/e-shiwake
- 技術スタック: SvelteKit / TypeScript / IndexedDB (Dexie.js) / PWA / Tailwind CSS v4 / shadcn-svelte

## 対象ユーザー

個人事業主・フリーランス・副業者で、確定申告を自分で行い、クラウド会計の月額課金を避けたい方。

## 機能一覧

### 仕訳・帳簿

| 機能 | 概要 |
|------|------|
| 仕訳帳 | 複合仕訳対応のインライン編集、全年度横断検索、仕訳コピー |
| 総勘定元帳 | 科目別取引履歴・残高推移 |
| 試算表 | 合計残高試算表・残高試算表 |
| 損益計算書 | 売上総利益・営業利益・当期純利益 |
| 貸借対照表 | 流動/固定資産・負債・純資産 |

### 税務・申告

| 機能 | 概要 |
|------|------|
| 消費税集計 | 課税売上/仕入の税率別集計、納付税額計算、インボイス登録期間対応 |
| 青色申告決算書 | 一般用4ページプレビュー・印刷 |
| 固定資産台帳 | CRUD・減価償却シミュレーション |

### 証憑・請求書

| 機能 | 概要 |
|------|------|
| 証憑管理 | PDF添付・自動リネーム（電子帳簿保存法対応） |
| 請求書 | 作成・編集・印刷、仕訳自動生成（売掛金計上・入金） |

### データ管理

| 機能 | 概要 |
|------|------|
| バックアップ・リストア | ZIP形式で全年度の全データ（仕訳+証憑PDF+勘定科目+取引先+固定資産+請求書+設定）のフルスナップショット保存と上書きリストア |
| エクスポート | CSV（仕訳）/ JSON（全データ、証憑なし） |
| アーカイブ | 年度決算パッケージ（仕訳+証憑+帳簿レポート+検索HTML）のZIP生成・年度データ削除・アーカイブからのマージリストア |
| 年度別証憑保存設定 | 年度ごとにローカルフォルダ/ブラウザ内を切替可能。切替時に自動マイグレーション |
| PWA | オフライン動作、インストール可能 |

## ヘルプドキュメント

各機能の詳細は以下のエンドポイントから取得できます。

### 基本操作

- /help/getting-started/llms.txt - はじめに（初期設定・基本的な使い方）
- /help/journal/llms.txt - 仕訳入力（複合仕訳・家事按分・検索・コピー）
- /help/evidence/llms.txt - 証憑管理（PDF添付・自動リネーム・電帳法対応）
- /help/accounts/llms.txt - 勘定科目管理（科目追加・デフォルト消費税区分・按分設定）

### 帳簿・財務諸表

- /help/ledger/llms.txt - 総勘定元帳
- /help/trial-balance/llms.txt - 試算表

### 税務・申告

- /help/tax-category/llms.txt - 消費税区分（課税/非課税/不課税/対象外の使い分け）
- /help/fixed-assets/llms.txt - 固定資産台帳（減価償却計算）
- /help/blue-return/llms.txt - 青色申告決算書（事業者情報・控除設定）

### 請求書・取引先

- /help/invoice/llms.txt - 請求書（作成・印刷・仕訳自動生成）

### 設定・その他

- /help/data-management/llms.txt - 設定・データ管理（年度別証憑保存設定・ストレージ管理・データ管理3層構造）
- /help/backup-restore/llms.txt - バックアップ・リストア（全年度フルスナップショットの保存と上書きリストア）
- /help/import-export/llms.txt - エクスポート（CSV/JSONでのデータ出力）
- /help/archive/llms.txt - 検索機能付アーカイブ保存（年度決算パッケージ生成・年度データ削除・アーカイブからリストア）
- /help/pwa/llms.txt - PWA・オフライン（インストール・キャッシュ）
- /help/shortcuts/llms.txt - キーボードショートカット
- /help/glossary/llms.txt - 用語集（簿記・会計用語）
- /help/webmcp/llms.txt - WebMCP（AIエージェント連携・ツール一覧）

## データモデル

### JournalEntry（仕訳）

複合仕訳（借方/貸方が複数行）に対応。

- id: UUID
- date: 取引日 (YYYY-MM-DD)
- lines: JournalLine[] - 仕訳明細行
- vendor: 取引先名
- description: 摘要
- evidenceStatus: 証跡ステータス (none/paper/digital)
- attachments: Attachment[] - 紐付けられた証憑

### JournalLine（仕訳明細行）

- id: UUID
- type: debit（借方）/ credit（貸方）
- accountCode: 勘定科目コード（4桁）
- amount: 金額
- taxCategory: 消費税区分
- memo: 行メモ（按分理由など）

### Account（勘定科目マスタ）

- code: 勘定科目コード（4桁）
- name: 勘定科目名
- type: asset/liability/equity/revenue/expense
- isSystem: システム初期データか否か
- defaultTaxCategory: デフォルト消費税区分
- businessRatio: 家事按分率（0-100）

### 消費税区分（TaxCategory）

| 値 | 意味 |
|----|------|
| sales_10 | 課税売上10% |
| sales_8 | 課税売上8%（軽減税率） |
| purchase_10 | 課税仕入10% |
| purchase_8 | 課税仕入8%（軽減税率） |
| exempt | 非課税 |
| out_of_scope | 不課税 |
| na | 対象外（事業主勘定等） |

### 勘定科目コード体系（4桁）

1桁目: 1=資産, 2=負債, 3=純資産, 4=収益, 5=費用
2桁目: 0=システム, 1=ユーザー追加
3-4桁目: 連番（01-99）

主な勘定科目:
- 1001: 現金, 1002: 当座預金, 1003: 普通預金, 1004: 売掛金
- 2001: 買掛金, 2002: 未払金, 2003: 前受金, 2004: 預り金
- 3001: 元入金, 3002: 事業主貸, 3003: 事業主借
- 4001: 売上高, 4002: 雑収入
- 5001: 仕入高, 5002: 租税公課, 5003: 荷造運賃, 5004: 水道光熱費,
  5005: 旅費交通費, 5006: 通信費, 5007: 広告宣伝費, 5008: 接待交際費,
  5009: 損害保険料, 5010: 修繕費, 5011: 消耗品費, 5012: 減価償却費,
  5013: 福利厚生費, 5014: 給料賃金, 5015: 外注工賃, 5016: 利子割引料,
  5017: 地代家賃, 5018: 貸倒金, 5019: 雑費, 5020: 新聞図書費,
  5021: 研修費, 5022: 支払手数料

## 複式簿記のルール

借方(debit)に来る科目:
- 資産の増加（例: 現金が入った）
- 費用の発生（例: 経費を使った）
- 負債の減少（例: 借入を返した）

貸方(credit)に来る科目:
- 資産の減少（例: 現金を払った）
- 収益の発生（例: 売上が立った）
- 負債の増加（例: 借入をした）

バリデーション: 借方合計 === 貸方合計 を必ず検証する。

## AI連携（WebMCP）

e-shiwake は WebMCP（Web Model Context Protocol）に対応。
Chrome 146+ で WebMCP が有効な場合、AIエージェントはe-shiwakeのデータに直接アクセスできます。

詳細: /help/webmcp/llms.txt

### 主なツール

| ツール | 概要 |
|--------|------|
| search_journals | 仕訳を全年度横断検索 |
| get_journals_by_year | 指定年度の全仕訳を取得 |
| create_journal | 仕訳を作成 |
| delete_journal | 仕訳を削除 |
| list_accounts | 勘定科目一覧 |
| list_vendors | 取引先一覧 |
| generate_ledger | 総勘定元帳を生成 |
| generate_trial_balance | 試算表を生成 |
| generate_profit_loss | 損益計算書を生成 |
| generate_balance_sheet | 貸借対照表を生成 |
| calculate_consumption_tax | 消費税集計 |
| get_available_years | 年度一覧 |

### 仕訳の例

電車代1,200円を現金で支払い:
create_journal({
  date: "2026-02-22",
  description: "電車代",
  vendor: "",
  debitLines: [{accountCode: "5005", amount: 1200, taxCategory: "na"}],
  creditLines: [{accountCode: "1001", amount: 1200, taxCategory: "na"}]
})

家事按分（携帯電話代10,000円、事業80%）:
create_journal({
  date: "2026-02-20",
  description: "携帯電話代",
  vendor: "NTTドコモ",
  debitLines: [
    {accountCode: "5006", amount: 8000, taxCategory: "purchase_10"},
    {accountCode: "3002", amount: 2000, taxCategory: "na"}
  ],
  creditLines: [{accountCode: "1003", amount: 10000, taxCategory: "na"}]
})

### WebMCPの有効化

Chrome 146+ で chrome://flags → "WebMCP for testing" を Enabled にする。
`;

export function GET() {
	return new Response(UTF8_BOM + content, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8'
		}
	});
}
