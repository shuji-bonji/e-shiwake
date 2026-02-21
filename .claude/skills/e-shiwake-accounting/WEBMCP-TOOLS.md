# WebMCP ツール詳細リファレンス

Chrome 146+ で WebMCP が有効な場合に利用可能なツール一覧。

## 仕訳管理

### search_journals

仕訳を全年度横断で検索する。スペース区切りでAND検索に対応。

| 引数       | 型     | 必須 | 説明           |
| ---------- | ------ | ---- | -------------- |
| query      | string | ✅   | 検索キーワード |
| fiscalYear | number |      | 年度で絞り込み |

検索可能な項目:

- テキスト → 摘要・取引先に部分一致
- 勘定科目名 → 前方一致
- 数値 → 金額に完全一致（カンマ可: "10,000"）
- YYYY-MM-DD → 日付に完全一致
- YYYY-MM → 月で絞り込み
- M月 → 全年度のM月
- M/D → 全年度のM月D日

例:

```
search_journals({query: "Amazon 消耗品費"})
search_journals({query: "12月", fiscalYear: 2025})
search_journals({query: "10000"})
```

### get_journals_by_year

指定した会計年度の全仕訳を取得。

| 引数 | 型     | 必須 | 説明     |
| ---- | ------ | ---- | -------- |
| year | number | ✅   | 会計年度 |

### create_journal

新しい仕訳を作成する。借方合計 = 貸方合計 であること。

| 引数        | 型     | 必須 | 説明                 |
| ----------- | ------ | ---- | -------------------- |
| date        | string | ✅   | 取引日（YYYY-MM-DD） |
| description | string | ✅   | 摘要                 |
| vendor      | string |      | 取引先名             |
| debitLines  | array  | ✅   | 借方明細行           |
| creditLines | array  | ✅   | 貸方明細行           |

debitLines / creditLines の各要素:

```json
{
	"accountCode": "5005",
	"amount": 1200,
	"taxCategory": "purchase_10"
}
```

例 - 基本的な経費:

```
create_journal({
  date: "2026-01-15",
  description: "USBケーブル購入",
  vendor: "Amazon",
  debitLines: [{accountCode: "5011", amount: 3980, taxCategory: "purchase_10"}],
  creditLines: [{accountCode: "1003", amount: 3980, taxCategory: "na"}]
})
```

例 - 家事按分（事業80%）:

```
create_journal({
  date: "2026-01-20",
  description: "携帯電話代",
  vendor: "NTTドコモ",
  debitLines: [
    {accountCode: "5006", amount: 8000, taxCategory: "purchase_10"},
    {accountCode: "3002", amount: 2000, taxCategory: "na"}
  ],
  creditLines: [{accountCode: "1003", amount: 10000, taxCategory: "na"}]
})
```

例 - 売上入金:

```
create_journal({
  date: "2026-02-28",
  description: "2月分システム開発",
  vendor: "クライアントA",
  debitLines: [{accountCode: "1003", amount: 550000, taxCategory: "na"}],
  creditLines: [{accountCode: "4001", amount: 550000, taxCategory: "sales_10"}]
})
```

### delete_journal

仕訳を削除する。紐付いた証憑も削除される。

| 引数 | 型     | 必須 | 説明           |
| ---- | ------ | ---- | -------------- |
| id   | string | ✅   | 仕訳ID（UUID） |

## マスタ参照

### list_accounts

勘定科目マスタの一覧を取得。

| 引数 | 型     | 必須 | 説明                                   |
| ---- | ------ | ---- | -------------------------------------- |
| type | string |      | asset/liability/equity/revenue/expense |

### list_vendors

取引先一覧を取得。

| 引数  | 型     | 必須 | 説明           |
| ----- | ------ | ---- | -------------- |
| query | string |      | 取引先名で検索 |

## 帳簿生成

### generate_ledger

特定の勘定科目の総勘定元帳（取引履歴と残高推移）を生成。

| 引数        | 型     | 必須 | 説明           |
| ----------- | ------ | ---- | -------------- |
| accountCode | string | ✅   | 勘定科目コード |
| fiscalYear  | number | ✅   | 会計年度       |

### generate_trial_balance

合計残高試算表を生成。貸借一致チェックも含む。

| 引数       | 型     | 必須 | 説明     |
| ---------- | ------ | ---- | -------- |
| fiscalYear | number | ✅   | 会計年度 |

### generate_profit_loss

損益計算書を生成。売上総利益、営業利益、当期純利益を算出。

| 引数       | 型     | 必須 | 説明     |
| ---------- | ------ | ---- | -------- |
| fiscalYear | number | ✅   | 会計年度 |

### generate_balance_sheet

貸借対照表を生成。資産・負債・純資産の一覧と貸借一致チェック。

| 引数       | 型     | 必須 | 説明     |
| ---------- | ------ | ---- | -------- |
| fiscalYear | number | ✅   | 会計年度 |

## 税務

### calculate_consumption_tax

消費税集計を計算。課税売上・課税仕入・納付税額を算出。

| 引数       | 型     | 必須 | 説明     |
| ---------- | ------ | ---- | -------- |
| fiscalYear | number | ✅   | 会計年度 |

## ユーティリティ

### get_available_years

データが存在する会計年度の一覧を取得。引数なし。
まず最初に呼んで、利用可能な年度を確認するのが推奨。
