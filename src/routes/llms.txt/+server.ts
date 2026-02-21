export const prerender = true;

// UTF-8 BOM（バイトオーダーマーク）- 静的ファイルサーバーでの文字化け対策
const UTF8_BOM = '\uFEFF';

const content = `# e-shiwake - 電子仕訳

日本のフリーランス・個人事業主向けの無料会計PWAアプリケーション。

## 概要

- 複式簿記による仕訳入力
- 青色申告決算書の作成
- 電子帳簿保存法対応
- オフライン動作（PWA）
- データはブラウザ内に保存（IndexedDB）

## 対象ユーザー

- 個人事業主
- フリーランス
- 副業している方
- 確定申告を自分で行う方
- クラウド会計の月額課金を避けたい方

## 主な機能

- 仕訳帳
- 総勘定元帳
- 試算表
- 損益計算書・貸借対照表
- 青色申告決算書（一般用）
- 固定資産台帳・減価償却計算
- 消費税集計
- 証憑管理（PDF添付）
- 全年度横断検索
- JSON/CSV/ZIPエクスポート・インポート

## 技術スタック

- SvelteKit
- TypeScript
- IndexedDB (Dexie.js)
- PWA (Service Worker)
- Tailwind CSS v4
- shadcn-svelte

## ヘルプドキュメント

各ページの詳細な使い方は以下のllms.txtエンドポイントから取得できます。

- /help/getting-started/llms.txt - はじめに
- /help/journal/llms.txt - 仕訳入力
- /help/ledger/llms.txt - 総勘定元帳
- /help/trial-balance/llms.txt - 試算表
- /help/tax-category/llms.txt - 消費税区分
- /help/evidence/llms.txt - 証憑管理
- /help/accounts/llms.txt - 勘定科目管理
- /help/fixed-assets/llms.txt - 固定資産台帳
- /help/blue-return/llms.txt - 青色申告決算書
- /help/invoice/llms.txt - 請求書
- /help/data-management/llms.txt - 設定・データ管理
- /help/pwa/llms.txt - PWA・オフライン
- /help/shortcuts/llms.txt - ショートカット
- /help/glossary/llms.txt - 用語集

## データモデル

### JournalEntry（仕訳）

複合仕訳（借方/貸方が複数行）に対応。

- id: UUID
- date: 取引日 (YYYY-MM-DD)
- lines: 仕訳明細行（複数行対応）
- vendor: 取引先名
- description: 摘要
- evidenceStatus: 証跡ステータス (none/paper/digital)
- attachments: 紐付けられた証憑

### JournalLine（仕訳明細行）

- id: UUID
- type: 借方(debit) or 貸方(credit)
- accountCode: 勘定科目コード
- amount: 金額
- taxCategory: 消費税区分
- memo: 行メモ（按分理由など）

### Account（勘定科目マスタ）

- code: 勘定科目コード（4桁）
- name: 勘定科目名
- type: 資産/負債/純資産/収益/費用
- isSystem: システム初期データか、ユーザー追加か
- defaultTaxCategory: デフォルト消費税区分
- businessRatio: 家事按分設定

### 消費税区分

- sales_10: 課税売上10%
- sales_8: 課税売上8%（軽減税率）
- purchase_10: 課税仕入10%
- purchase_8: 課税仕入8%（軽減税率）
- exempt: 非課税
- out_of_scope: 不課税
- na: 対象外（事業主勘定等）

## AI連携（WebMCP）

e-shiwake は WebMCP（Web Model Context Protocol）に対応しています。
Chrome 146+ で WebMCP が有効な場合、AIエージェントは以下のツールを通じて
e-shiwake のデータに直接アクセスできます。

### 利用可能なツール

#### 仕訳管理

- search_journals: 仕訳を全年度横断で検索（キーワード、勘定科目、金額、日付で検索可能。スペース区切りでAND検索）
  - 引数: query (string, 必須), fiscalYear (number, 任意)
  - 例: search_journals({query: "Amazon 12月"})

- get_journals_by_year: 指定した会計年度の全仕訳を取得
  - 引数: year (number, 必須)

- create_journal: 複合仕訳を作成（借方合計 = 貸方合計であること）
  - 引数: date (string, 必須), description (string, 必須), vendor (string), debitLines (array, 必須), creditLines (array, 必須)
  - debitLines/creditLines の各要素: {accountCode: "5005", amount: 1200, taxCategory?: "purchase_10"}

- delete_journal: 仕訳を削除
  - 引数: id (string, 必須)

#### マスタ参照

- list_accounts: 勘定科目マスタ一覧を取得
  - 引数: type (string, 任意) - asset/liability/equity/revenue/expense でフィルタ

- list_vendors: 取引先一覧を取得（検索可能）
  - 引数: query (string, 任意)

#### 帳簿生成

- generate_ledger: 総勘定元帳を生成
  - 引数: accountCode (string, 必須), fiscalYear (number, 必須)

- generate_trial_balance: 試算表（合計残高試算表）を生成
  - 引数: fiscalYear (number, 必須)

- generate_profit_loss: 損益計算書を生成
  - 引数: fiscalYear (number, 必須)

- generate_balance_sheet: 貸借対照表を生成
  - 引数: fiscalYear (number, 必須)

#### 税務

- calculate_consumption_tax: 消費税集計を計算（課税売上・課税仕入・納付税額）
  - 引数: fiscalYear (number, 必須)

#### ユーティリティ

- get_available_years: データが存在する会計年度の一覧を取得（引数なし）

### 勘定科目コード体系（4桁）

1桁目: 1=資産, 2=負債, 3=純資産, 4=収益, 5=費用
2桁目: 0=システム, 1=ユーザー追加
3-4桁目: 連番（01-99）

主な勘定科目:
- 1001: 現金, 1002: 当座預金, 1003: 普通預金, 1004: 売掛金
- 2001: 買掛金, 2002: 未払金
- 3001: 元入金, 3002: 事業主貸, 3003: 事業主借
- 4001: 売上高
- 5001: 仕入高, 5002: 租税公課, 5003: 荷造運賃, 5004: 水道光熱費,
  5005: 旅費交通費, 5006: 通信費, 5007: 広告宣伝費, 5008: 接待交際費,
  5009: 損害保険料, 5010: 修繕費, 5011: 消耗品費, 5012: 減価償却費,
  5013: 福利厚生費, 5014: 給料賃金, 5015: 外注工賃, 5016: 利子割引料,
  5017: 地代家賃, 5018: 貸倒金, 5019: 雑費, 5020: 新聞図書費,
  5021: 研修費, 5022: 支払手数料

### 複式簿記のルール

借方(debit)に来る科目:
- 資産の増加（例: 現金が入った）
- 費用の発生（例: 経費を使った）
- 負債の減少（例: 借入を返した）

貸方(credit)に来る科目:
- 資産の減少（例: 現金を払った）
- 収益の発生（例: 売上が立った）
- 負債の増加（例: 借入をした）

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

### 詳細ドキュメント

- /help/webmcp/llms.txt - WebMCPツールの詳細な使い方

## URL

https://shuji-bonji.github.io/e-shiwake/

## ソースコード

https://github.com/shuji-bonji/e-shiwake
`;

export function GET() {
	return new Response(UTF8_BOM + content, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8'
		}
	});
}
