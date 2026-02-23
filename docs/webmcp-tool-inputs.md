# WebMCP ツール別 Input Arguments リファレンス

> Inspector の **Tools タブ**から直接実行する際のコピペ用。Gemini API を消費しません。

---

## 1. search_journals — 仕訳検索

全年度横断でキーワード検索。摘要・取引先・勘定科目名・金額・日付に対応。

| パラメータ   | 型     | 必須 | 説明                       |
| ------------ | ------ | ---- | -------------------------- |
| `query`      | string | ✅   | 検索クエリ                 |
| `fiscalYear` | number | -    | 年度指定（省略時は全年度） |

### サンプル

**Amazonの仕訳を全年度検索**

```json
{
	"query": "Amazon"
}
```

**2026年2月の仕訳**

```json
{
	"query": "2026-02"
}
```

**2026年度の消耗品費**

```json
{
	"query": "消耗品費",
	"fiscalYear": 2026
}
```

**2026年1月の10,000円の仕訳**

```json
{
	"query": "2026-01 10000"
}
```

**Amazonの12月の仕訳（AND検索）**

```json
{
	"query": "Amazon 12月"
}
```

---

## 2. get_journals_by_year — 年度別仕訳一覧

指定年度の全仕訳を取得。

| パラメータ | 型     | 必須 | 説明     |
| ---------- | ------ | ---- | -------- |
| `year`     | number | ✅   | 会計年度 |

### サンプル

**2026年度の全仕訳**

```json
{
	"year": 2026
}
```

**2025年度の全仕訳**

```json
{
	"year": 2025
}
```

---

## 3. create_journal — 仕訳作成

複合仕訳を作成。借方合計 === 貸方合計であること。

| パラメータ    | 型     | 必須 | 説明                 |
| ------------- | ------ | ---- | -------------------- |
| `date`        | string | ✅   | 取引日（YYYY-MM-DD） |
| `description` | string | ✅   | 摘要                 |
| `vendor`      | string | -    | 取引先名             |
| `debitLines`  | array  | ✅   | 借方明細行           |
| `creditLines` | array  | ✅   | 貸方明細行           |

**明細行のオブジェクト構造:**

| フィールド    | 型     | 必須 | 説明                       |
| ------------- | ------ | ---- | -------------------------- |
| `accountCode` | string | ✅   | 勘定科目コード（4桁）      |
| `amount`      | number | ✅   | 金額                       |
| `taxCategory` | string | -    | 消費税区分（省略時: `na`） |
| `memo`        | string | -    | 行メモ                     |

**消費税区分の値:**

| 値             | 意味                   |
| -------------- | ---------------------- |
| `sales_10`     | 課税売上10%            |
| `sales_8`      | 課税売上8%（軽減税率） |
| `purchase_10`  | 課税仕入10%            |
| `purchase_8`   | 課税仕入8%（軽減税率） |
| `exempt`       | 非課税                 |
| `out_of_scope` | 不課税                 |
| `na`           | 対象外                 |

**主要な勘定科目コード:**

| コード | 科目名     | 種別   |
| ------ | ---------- | ------ |
| `1001` | 現金       | 資産   |
| `1002` | 売掛金     | 資産   |
| `1003` | 普通預金   | 資産   |
| `2001` | 買掛金     | 負債   |
| `2002` | 未払金     | 負債   |
| `3001` | 事業主貸   | 純資産 |
| `3002` | 事業主借   | 純資産 |
| `4001` | 売上高     | 収益   |
| `5001` | 仕入高     | 費用   |
| `5002` | 外注費     | 費用   |
| `5003` | 消耗品費   | 費用   |
| `5004` | 通信費     | 費用   |
| `5005` | 旅費交通費 | 費用   |
| `5006` | 地代家賃   | 費用   |
| `5010` | 水道光熱費 | 費用   |
| `5015` | 新聞図書費 | 費用   |
| `5018` | 情報処理費 | 費用   |

### サンプル

**基本：消耗品を現金で購入**

```json
{
	"date": "2026-02-23",
	"description": "USBケーブル購入",
	"vendor": "Amazon",
	"debitLines": [{ "accountCode": "5003", "amount": 3980, "taxCategory": "purchase_10" }],
	"creditLines": [{ "accountCode": "1001", "amount": 3980, "taxCategory": "na" }]
}
```

**基本：経費をクレジットカード（未払金）で支払い**

```json
{
	"date": "2026-02-20",
	"description": "電車代",
	"vendor": "JR東日本",
	"debitLines": [{ "accountCode": "5005", "amount": 1200, "taxCategory": "purchase_10" }],
	"creditLines": [{ "accountCode": "2002", "amount": 1200, "taxCategory": "na" }]
}
```

**売上計上（売掛金）**

```json
{
	"date": "2026-02-01",
	"description": "BIMツール開発支援 2月分",
	"vendor": "株式会社ヘルスベイシス",
	"debitLines": [{ "accountCode": "1002", "amount": 550000, "taxCategory": "na" }],
	"creditLines": [{ "accountCode": "4001", "amount": 550000, "taxCategory": "sales_10" }]
}
```

**入金処理（売掛金回収）**

```json
{
	"date": "2026-03-05",
	"description": "BIMツール開発支援：入金",
	"vendor": "株式会社ヘルスベイシス",
	"debitLines": [{ "accountCode": "1003", "amount": 550000, "taxCategory": "na" }],
	"creditLines": [{ "accountCode": "1002", "amount": 550000, "taxCategory": "na" }]
}
```

**家事按分（複合仕訳）**

```json
{
	"date": "2026-02-14",
	"description": "NTTフレッツ光",
	"vendor": "NTT東日本",
	"debitLines": [
		{ "accountCode": "5004", "amount": 2305, "taxCategory": "purchase_10", "memo": "事業分33%" },
		{ "accountCode": "3001", "amount": 4680, "taxCategory": "na", "memo": "家事分67%" }
	],
	"creditLines": [{ "accountCode": "2002", "amount": 6985, "taxCategory": "na" }]
}
```

**生活費の引き出し**

```json
{
	"date": "2026-02-23",
	"description": "生活費",
	"vendor": "",
	"debitLines": [{ "accountCode": "3001", "amount": 300000, "taxCategory": "na" }],
	"creditLines": [{ "accountCode": "1003", "amount": 300000, "taxCategory": "na" }]
}
```

**サブスク経費**

```json
{
	"date": "2026-02-12",
	"description": "DeepL利用料",
	"vendor": "DeepL",
	"debitLines": [{ "accountCode": "5018", "amount": 733, "taxCategory": "purchase_10" }],
	"creditLines": [{ "accountCode": "2002", "amount": 733, "taxCategory": "na" }]
}
```

**オフィス家賃（未払金計上）**

```json
{
	"date": "2026-03-31",
	"description": "オフィス家賃 3月分",
	"vendor": "不動産管理会社",
	"debitLines": [{ "accountCode": "5006", "amount": 150000, "taxCategory": "purchase_10" }],
	"creditLines": [{ "accountCode": "2002", "amount": 150000, "taxCategory": "na" }]
}
```

---

## 4. delete_journal — 仕訳削除

| パラメータ | 型     | 必須 | 説明       |
| ---------- | ------ | ---- | ---------- |
| `id`       | string | ✅   | 仕訳のUUID |

### サンプル

```json
{
	"id": "e47b1d54-2f62-43b7-95ee-a0b8539975f3"
}
```

> ※ IDは `search_journals` や `get_journals_by_year` の結果から取得

---

## 5. list_accounts — 勘定科目一覧

| パラメータ | 型     | 必須 | 説明                               |
| ---------- | ------ | ---- | ---------------------------------- |
| `type`     | string | -    | カテゴリフィルタ（省略時: 全科目） |

`type` の値: `asset`, `liability`, `equity`, `revenue`, `expense`

### サンプル

**全科目**

```json
{}
```

**費用科目のみ**

```json
{
	"type": "expense"
}
```

**資産科目のみ**

```json
{
	"type": "asset"
}
```

---

## 6. list_vendors — 取引先一覧

| パラメータ | 型     | 必須 | 説明                           |
| ---------- | ------ | ---- | ------------------------------ |
| `query`    | string | -    | 検索キーワード（省略時: 全件） |

### サンプル

**全取引先**

```json
{}
```

**Amazonを検索**

```json
{
	"query": "Amazon"
}
```

---

## 7. generate_ledger — 総勘定元帳

| パラメータ    | 型     | 必須 | 説明           |
| ------------- | ------ | ---- | -------------- |
| `accountCode` | string | ✅   | 勘定科目コード |
| `fiscalYear`  | number | ✅   | 会計年度       |

### サンプル

**2026年度の普通預金の元帳**

```json
{
	"accountCode": "1003",
	"fiscalYear": 2026
}
```

**2026年度の売掛金の元帳**

```json
{
	"accountCode": "1002",
	"fiscalYear": 2026
}
```

**2025年度の売上高の元帳**

```json
{
	"accountCode": "4001",
	"fiscalYear": 2025
}
```

---

## 8. generate_trial_balance — 試算表

| パラメータ   | 型     | 必須 | 説明     |
| ------------ | ------ | ---- | -------- |
| `fiscalYear` | number | ✅   | 会計年度 |

### サンプル

```json
{
	"fiscalYear": 2026
}
```

---

## 9. generate_profit_loss — 損益計算書

| パラメータ   | 型     | 必須 | 説明     |
| ------------ | ------ | ---- | -------- |
| `fiscalYear` | number | ✅   | 会計年度 |

### サンプル

```json
{
	"fiscalYear": 2025
}
```

---

## 10. generate_balance_sheet — 貸借対照表

| パラメータ   | 型     | 必須 | 説明     |
| ------------ | ------ | ---- | -------- |
| `fiscalYear` | number | ✅   | 会計年度 |

### サンプル

```json
{
	"fiscalYear": 2026
}
```

---

## 11. calculate_consumption_tax — 消費税集計

| パラメータ   | 型     | 必須 | 説明     |
| ------------ | ------ | ---- | -------- |
| `fiscalYear` | number | ✅   | 会計年度 |

### サンプル

```json
{
	"fiscalYear": 2025
}
```

---

## 12. get_available_years — 年度一覧

パラメータなし。

### サンプル

```json
{}
```

---

## クイックリファレンス

| #   | ツール名                    | 用途           | 必須パラメータ                                     |
| --- | --------------------------- | -------------- | -------------------------------------------------- |
| 1   | `search_journals`           | 仕訳検索       | `query`                                            |
| 2   | `get_journals_by_year`      | 年度別仕訳一覧 | `year`                                             |
| 3   | `create_journal`            | 仕訳作成       | `date`, `description`, `debitLines`, `creditLines` |
| 4   | `delete_journal`            | 仕訳削除       | `id`                                               |
| 5   | `list_accounts`             | 勘定科目一覧   | （なし）                                           |
| 6   | `list_vendors`              | 取引先一覧     | （なし）                                           |
| 7   | `generate_ledger`           | 総勘定元帳     | `accountCode`, `fiscalYear`                        |
| 8   | `generate_trial_balance`    | 試算表         | `fiscalYear`                                       |
| 9   | `generate_profit_loss`      | 損益計算書     | `fiscalYear`                                       |
| 10  | `generate_balance_sheet`    | 貸借対照表     | `fiscalYear`                                       |
| 11  | `calculate_consumption_tax` | 消費税集計     | `fiscalYear`                                       |
| 12  | `get_available_years`       | 年度一覧       | （なし）                                           |
