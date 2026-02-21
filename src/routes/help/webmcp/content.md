# WebMCP - AIエージェント連携

e-shiwake は WebMCP（Web Model Context Protocol）に対応しています。WebMCP を使うと、AIエージェントがブラウザ上の e-shiwake に直接アクセスし、仕訳の検索・作成・帳簿の生成などを実行できます。

## WebMCPとは

WebMCP は W3C で標準化が進められているブラウザAPIです。Webアプリが `navigator.modelContext.registerTool()` でツールを登録すると、AIエージェント（Chrome内蔵AIなど）がそのツールを認識・実行できるようになります。

従来のスクリーンショットベースの操作と比べて、トークン使用量が約89%削減され、高速かつ正確な操作が可能です。

## 前提条件

- Chrome 146 以上（2026年3月安定版リリース予定）
- `chrome://flags` → 「WebMCP for testing」を Enabled に設定
- ブラウザ再起動後、e-shiwake を開く

## 利用可能なツール一覧

e-shiwake は起動時に以下の12ツールを自動登録します。

### 仕訳管理

#### search_journals - 仕訳検索

全年度を横断して仕訳を検索します。スペース区切りでAND検索が可能です。

| 引数       | 型     | 必須 | 説明                       |
| ---------- | ------ | ---- | -------------------------- |
| query      | string | ○    | 検索クエリ                 |
| fiscalYear | number |      | 年度指定（省略時は全年度） |

検索クエリの例:

- `Amazon` → 摘要・取引先に「Amazon」を含む仕訳
- `消耗品費` → 勘定科目「消耗品費」の仕訳
- `10000` → 金額10,000円の仕訳
- `2025-01` → 2025年1月の仕訳
- `12月` → 全年度の12月の仕訳
- `Amazon 12月` → Amazonの12月の仕訳（AND検索）

#### get_journals_by_year - 年度別仕訳取得

指定した会計年度の全仕訳を取得します。

| 引数 | 型     | 必須 | 説明                 |
| ---- | ------ | ---- | -------------------- |
| year | number | ○    | 会計年度（例: 2025） |

#### create_journal - 仕訳作成

複合仕訳を作成します。借方合計と貸方合計は一致させてください。

| 引数        | 型     | 必須 | 説明                     |
| ----------- | ------ | ---- | ------------------------ |
| date        | string | ○    | 取引日（YYYY-MM-DD形式） |
| description | string | ○    | 摘要                     |
| vendor      | string |      | 取引先名                 |
| debitLines  | array  | ○    | 借方明細行の配列         |
| creditLines | array  | ○    | 貸方明細行の配列         |

debitLines / creditLines の各要素:

- accountCode: 勘定科目コード（4桁、例: "5005"）
- amount: 金額（円）
- taxCategory: 消費税区分（省略時は "na"）
- memo: メモ（省略可）

#### delete_journal - 仕訳削除

| 引数 | 型     | 必須 | 説明   |
| ---- | ------ | ---- | ------ |
| id   | string | ○    | 仕訳ID |

### マスタ参照

#### list_accounts - 勘定科目一覧

| 引数 | 型     | 必須 | 説明                                                       |
| ---- | ------ | ---- | ---------------------------------------------------------- |
| type | string |      | カテゴリフィルタ（asset/liability/equity/revenue/expense） |

#### list_vendors - 取引先一覧

| 引数  | 型     | 必須 | 説明           |
| ----- | ------ | ---- | -------------- |
| query | string |      | 取引先名で検索 |

### 帳簿生成

以下の4つのツールは、指定した年度の仕訳データから帳簿を自動生成します。

#### generate_ledger - 総勘定元帳

| 引数        | 型     | 必須 | 説明           |
| ----------- | ------ | ---- | -------------- |
| accountCode | string | ○    | 勘定科目コード |
| fiscalYear  | number | ○    | 会計年度       |

#### generate_trial_balance - 試算表

| 引数       | 型     | 必須 | 説明     |
| ---------- | ------ | ---- | -------- |
| fiscalYear | number | ○    | 会計年度 |

#### generate_profit_loss - 損益計算書

| 引数       | 型     | 必須 | 説明     |
| ---------- | ------ | ---- | -------- |
| fiscalYear | number | ○    | 会計年度 |

#### generate_balance_sheet - 貸借対照表

| 引数       | 型     | 必須 | 説明     |
| ---------- | ------ | ---- | -------- |
| fiscalYear | number | ○    | 会計年度 |

### 税務

#### calculate_consumption_tax - 消費税集計

課税売上・課税仕入・納付税額を計算します。

| 引数       | 型     | 必須 | 説明     |
| ---------- | ------ | ---- | -------- |
| fiscalYear | number | ○    | 会計年度 |

### ユーティリティ

#### get_available_years - 年度一覧

データが存在する会計年度の一覧を取得します。引数なし。

## 仕訳の例

### 基本的な仕訳

電車代1,200円を現金で支払い:

```
create_journal({
  date: "2026-02-22",
  description: "電車代",
  debitLines: [{accountCode: "5005", amount: 1200, taxCategory: "na"}],
  creditLines: [{accountCode: "1001", amount: 1200, taxCategory: "na"}]
})
```

### 消費税あり

Amazonで事務用品3,980円をクレジットカードで購入:

```
create_journal({
  date: "2026-02-22",
  description: "USBケーブル購入",
  vendor: "Amazon",
  debitLines: [{accountCode: "5011", amount: 3980, taxCategory: "purchase_10"}],
  creditLines: [{accountCode: "2002", amount: 3980, taxCategory: "na"}]
})
```

### 家事按分（複合仕訳）

携帯電話代10,000円（事業80%、家事20%）:

```
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
```

### 売上計上

クライアントAからシステム開発費100,000円の売掛金を計上:

```
create_journal({
  date: "2026-02-28",
  description: "システム開発費 2月分",
  vendor: "クライアントA",
  debitLines: [{accountCode: "1004", amount: 100000, taxCategory: "na"}],
  creditLines: [{accountCode: "4001", amount: 100000, taxCategory: "sales_10"}]
})
```

## 消費税区分

| コード       | 名称        | 用途                           |
| ------------ | ----------- | ------------------------------ |
| sales_10     | 課税売上10% | 通常の売上                     |
| sales_8      | 課税売上8%  | 軽減税率対象の売上             |
| purchase_10  | 課税仕入10% | 通常の経費                     |
| purchase_8   | 課税仕入8%  | 軽減税率対象の仕入（書籍等）   |
| exempt       | 非課税      | 土地賃借料、社会保険料等       |
| out_of_scope | 不課税      | 給与、配当金等                 |
| na           | 対象外      | 事業主勘定、現金・預金の増減等 |

## 動作確認

e-shiwake を開いた状態でブラウザのDevTools Consoleを確認してください。WebMCPが有効な環境では以下のログが表示されます:

```
[e-shiwake WebMCP] ツール登録: search_journals
[e-shiwake WebMCP] ツール登録: get_journals_by_year
...
[e-shiwake WebMCP] 12/12 ツールを登録しました
```

WebMCPが無効な環境では、以下のメッセージが表示されます（アプリの動作に影響はありません）:

```
[e-shiwake WebMCP] navigator.modelContext が利用できません。WebMCP は無効です。
```
