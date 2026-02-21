---
name: e-shiwake-accounting
description: |
  e-shiwake（電子仕訳）PWAアプリを操作する会計スキル。
  仕訳入力、帳簿確認、決算処理、証憑管理、データエクスポートを支援する。
  「仕訳」「帳簿」「確定申告」「経費」「青色申告」「勘定科目」「証憑」
  「損益計算書」「貸借対照表」「消費税」「試算表」に関する質問や操作時に使用。
---

# e-shiwake 操作スキル

e-shiwake は日本のフリーランス・個人事業主向けの会計PWAアプリ。
URL: https://shuji-bonji.github.io/e-shiwake/

## アプリ情報の取得

操作前に、アプリの最新仕様を llms.txt から取得すること。

```
GET https://shuji-bonji.github.io/e-shiwake/llms.txt
```

詳細なヘルプが必要な場合:

- `/help/journal/llms.txt` - 仕訳入力
- `/help/accounts/llms.txt` - 勘定科目
- `/help/tax-category/llms.txt` - 消費税区分
- `/help/evidence/llms.txt` - 証憑管理
- `/help/blue-return/llms.txt` - 青色申告決算書
- `/help/webmcp/llms.txt` - WebMCPツール仕様

## WebMCP ツール（Chrome 146+ 環境）

WebMCP 対応環境では、以下のツールで直接データ操作が可能。
詳細な仕様は [WEBMCP-TOOLS.md](WEBMCP-TOOLS.md) を参照。

| ツール                    | 用途                   |
| ------------------------- | ---------------------- |
| search_journals           | 仕訳検索（全年度横断） |
| get_journals_by_year      | 年度別仕訳取得         |
| create_journal            | 仕訳作成               |
| delete_journal            | 仕訳削除               |
| list_accounts             | 勘定科目一覧           |
| list_vendors              | 取引先一覧             |
| generate_ledger           | 総勘定元帳             |
| generate_trial_balance    | 試算表                 |
| generate_profit_loss      | 損益計算書             |
| generate_balance_sheet    | 貸借対照表             |
| calculate_consumption_tax | 消費税集計             |
| get_available_years       | 利用可能年度           |

## ブラウザ操作（WebMCP非対応環境）

WebMCPが使えない場合は、ブラウザ操作ツール（Claude in Chrome等）で以下の手順で操作する。
詳細な手順は [BROWSER-OPERATIONS.md](BROWSER-OPERATIONS.md) を参照。

### 仕訳入力

1. サイドバーで対象年度を選択
2. 「➕ 新規仕訳」ボタンをクリック
3. 一覧の最下部に空の仕訳行が追加される
4. 日付（YYYY-MM-DD）を入力
5. 摘要（取引内容）を入力
6. 借方: 勘定科目を選択 → 金額を入力
7. 貸方: 勘定科目を選択 → 金額を入力
8. 取引先を入力（オートコンプリート対応）
9. 借方合計 = 貸方合計 を確認
10. ✓ ボタンで確定

### 帳簿確認

サイドバーのメニューから各帳簿にアクセス:

- 仕訳帳: `/`（ホーム）
- 総勘定元帳: `/ledger`
- 試算表: `/trial-balance`
- 損益計算書: `/profit-loss`
- 貸借対照表: `/balance-sheet`
- 消費税集計: `/tax-summary`
- 固定資産台帳: `/fixed-assets`
- 青色申告決算書: `/blue-return`

### データエクスポート

1. サイドバー → データ管理（`/data`）
2. 対象年度のエクスポートセクション
3. 形式を選択: JSON / CSV / ZIP

## 会計ルール

### 複式簿記の基本

**必ず 借方合計 = 貸方合計** であること。

| 科目種別 | 借方に来る場合 | 貸方に来る場合 |
| -------- | -------------- | -------------- |
| 資産     | 増加           | 減少           |
| 負債     | 減少           | 増加           |
| 純資産   | 減少           | 増加           |
| 収益     | ―              | 発生           |
| 費用     | 発生           | ―              |

### よくある仕訳パターン

**現金で経費を払った**:

- 借方: 費用科目（通信費、消耗品費等）
- 貸方: 現金（1001）

**銀行振込で経費を払った**:

- 借方: 費用科目
- 貸方: 普通預金（1003）

**売上が入金された**:

- 借方: 普通預金（1003）
- 貸方: 売上高（4001）

**家事按分（事業80%、家事20%）**:

- 借方: 費用科目（事業分の金額）
- 借方: 事業主貸（3002、家事分の金額）
- 貸方: 普通預金（合計金額）

**源泉徴収ありの売上**:

- 借方: 普通預金（手取額）
- 借方: 事業主貸（3002、源泉所得税額）
- 貸方: 売上高（4001、税込総額）

### 勘定科目コード体系

4桁コード: `[カテゴリ][区分][連番]`

- 1桁目: 1=資産, 2=負債, 3=純資産, 4=収益, 5=費用
- 2桁目: 0=システム, 1=ユーザー追加
- 主要コード: [ACCOUNT-CODES.md](ACCOUNT-CODES.md) を参照

### 消費税区分

| コード       | 意味        | 主な用途                 |
| ------------ | ----------- | ------------------------ |
| purchase_10  | 課税仕入10% | 一般的な経費             |
| purchase_8   | 課税仕入8%  | 食品等（軽減税率）       |
| sales_10     | 課税売上10% | 一般的な売上             |
| sales_8      | 課税売上8%  | 食品等の売上             |
| exempt       | 非課税      | 土地、住宅家賃、社会保険 |
| out_of_scope | 不課税      | 給与、配当金、国外取引   |
| na           | 対象外      | 事業主勘定等             |

## 決算ワークフロー

年度末決算の手順:

1. **仕訳の確認**: 全仕訳が入力済みか確認（search_journals で検索）
2. **試算表チェック**: 貸借一致を確認（generate_trial_balance）
3. **損益計算書**: 売上・経費・利益を確認（generate_profit_loss）
4. **貸借対照表**: 資産・負債・純資産を確認（generate_balance_sheet）
5. **消費税集計**: 納付税額を確認（calculate_consumption_tax）
6. **青色申告決算書**: `/blue-return` で4ページプレビュー確認
7. **データバックアップ**: `/data` でZIPエクスポート
