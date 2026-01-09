export const prerender = true;

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

## URL

https://shuji-bonji.github.io/e-shiwake/

## ソースコード

https://github.com/shuji-bonji/e-shiwake
`;

export function GET() {
	return new Response(content, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8'
		}
	});
}
