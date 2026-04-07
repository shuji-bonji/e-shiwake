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

**e-shiwake**（電子仕訳）— フリーランス・個人事業主向けの仕訳入力 + 証憑管理 PWA

- **ローカルファースト**: サーバー不要、IndexedDB にデータ保存
- **SPA モード**: SvelteKit の SSR は使わない
- **PWA**: Service Worker でオフライン動作
- **iPad 対応**: File System Access API が使えないため、IndexedDB + エクスポートで対応

**URL**: `https://shuji-bonji.github.io/e-shiwake/`

> **機能詳細・データモデル・複式簿記ルール・勘定科目コード体系** については
> `src/routes/llms.txt/+server.ts` または各ヘルプページの `content.md` を参照のこと。
>
> **各ページの機能仕様を確認したい場合**: 該当ページの `content.md` が正（Single Source of Truth）。
> 例: 消費税集計の仕様 → `src/routes/help/tax-category/content.md`

## 技術スタック

- **フレームワーク**: SvelteKit
- **言語**: TypeScript
- **UI**: shadcn-svelte + Tailwind CSS v4
- **データ保存**: IndexedDB（Dexie.js）
- **ファイル操作**: File System Access API（デスクトップ）
- **PWA**: @vite-pwa/sveltekit + Workbox

## サイトマップ

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
├── /archive                # 検索機能付アーカイブ（年度締め・長期保存）
├── /invoice                # 請求書一覧
├── /invoice/[id]           # 請求書編集
├── /vendors                # 取引先管理
├── /accounts               # 勘定科目管理
├── /data                   # データ管理（バックアップ/エクスポート/インポート）
├── /settings               # 設定（事業者情報・証憑保存・容量）
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
    ├── /data-management    # 設定
    ├── /backup-restore     # バックアップ・リストア
    ├── /import-export      # インポート・エクスポート
    ├── /archive            # 検索機能付アーカイブ保存
    ├── /pwa                # PWA・インストール
    ├── /shortcuts          # キーボードショートカット
    ├── /glossary           # 用語集
    └── /webmcp             # WebMCP（AIエージェント連携）
```

## 既知の課題

### ストレージモードとデータ移行

証憑の保存先として2つのモード（`filesystem` / `indexeddb`）がある。

| シナリオ                               | 問題点                             |
| -------------------------------------- | ---------------------------------- |
| Chrome(filesystem) → Safari(indexeddb) | `filePath`のみでファイル実体がない |
| Safari(indexeddb) → Chrome(filesystem) | blobがなく、ファイルも存在しない   |
| 端末移行時                             | 証憑PDFが引き継がれない            |

**現状の対応**: JSONエクスポートは仕訳データのみ。ZIPエクスポートで証憑同梱。

## 開発フェーズ

- Phase 1: MVP ✅
- Phase 1.5: PWA & UX強化 ✅
- Phase 2: 帳簿機能 ✅
- Phase 3: 確定申告対応 ✅
- Phase 3.5: バックアップ・アーカイブ改善 — 進行中（`docs/design/backup-archive-redesign.md` 参照）
- Phase 4: 国際展開（i18n・多通貨） — 未着手

## コーディング規約

### ファイル構成

```
src/
├── lib/
│   ├── components/     # 再利用可能なコンポーネント
│   │   ├── ui/         # shadcn-svelte コンポーネント
│   │   ├── layout/     # AppSidebar, AppHeader
│   │   ├── journal/    # JournalEntry, JournalLine, PdfDropZone, SearchHelp
│   │   ├── blue-return/ # BlueReturnSettingsDialog 等
│   │   ├── data/       # ExportCard, ImportCard, CapacityCard, BusinessInfoCard
│   │   ├── invoice/    # InvoicePrint 等
│   │   └── help/       # HelpSection, HelpTable, HelpNote
│   ├── hooks/          # useJournalPage 等のカスタムフック
│   ├── stores/         # Svelte stores（fiscalYear.svelte.ts）
│   ├── db/             # IndexedDB 関連（Dexie、リポジトリパターン）
│   ├── types/          # TypeScript 型定義
│   └── utils/          # ユーティリティ関数
├── routes/             # SvelteKit ルート（サイトマップ参照）
└── app.d.ts            # グローバル型定義（__APP_VERSION__ 等）
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

### IndexedDB と Svelte 5 の注意

Svelte 5 の `$state` はプロキシオブジェクトを生成する。
IndexedDB に保存する際は `JSON.parse(JSON.stringify(...))` でプレーンオブジェクトに変換すること。
`structuredClone` は Svelte プロキシで `DataCloneError` になるため使用不可。

## 更新チェックリスト

### ページの追加・削除・変更時

ルート（ページ）を追加・削除・変更した際は、以下のファイルも更新すること：

1. **`svelte.config.js`** — `prerender.entries` にルートを追加/削除
2. **`static/sitemap.xml`** — `<url>` エントリを追加/削除
3. **`CLAUDE.md`** — 「サイトマップ」セクションのルート一覧を更新
4. **`README.md`** — 「ページ構成」セクションのルート一覧を更新

ヘルプページの場合はさらに：

5. **`content.md`** + **`llms.txt/+server.ts`** の作成/削除
6. **`src/routes/llms.txt/+server.ts`** — ヘルプリンク一覧を更新

### 機能変更・改善時（必須）

ページの機能やUIを変更・改善した場合、**必ず以下のドキュメントも更新すること**：

1. **該当ヘルプの `content.md`** — 変更内容をMarkdownに反映
2. **該当ヘルプの `+page.svelte`** — `content.md` と同じ内容をSvelteコンポーネントに反映
3. **`src/routes/llms.txt/+server.ts`** — 機能一覧に影響がある場合はルートllms.txtも更新

> **重要**: `content.md` がアプリ各機能の仕様ドキュメント（Single Source of Truth）である。
> CLAUDE.md に機能の詳細仕様を書かず、必ず `content.md` 側に記述すること。
> 開発時に機能仕様を確認する際も `content.md` を参照する。

## ヘルプページのシーケンス図（SVG）

ヘルプページのユースケースシーケンス図は **静的SVG** として管理している。
Mermaid.js をランタイムで使わず、事前生成したSVGを `static/images/help/` に配置。

### SVGファイル一覧

```
static/images/help/
├── backup-restore/
│   ├── pc-migration.svg      # PC買い替え時の端末移行
│   ├── data-recovery.svg     # ブラウザデータ消失からの復旧
│   └── ipad-backup.svg       # iPad（Safari）でのバックアップ
├── import-export/
│   ├── json-transfer.svg     # 仕訳データを別環境に移す
│   ├── csv-excel.svg         # Excelで仕訳を確認する
│   └── save-storage.svg      # ブラウザ容量を節約する
└── archive/
    ├── year-close.svg         # 確定申告後の年度締め
    ├── tax-audit.svg          # 税務調査時の証憑提示
    └── past-reference.svg     # 過去データの参照
```

### SVG再生成手順

シーケンス図の内容を変更した場合：

1. **`content.md`** のMermaid記法を更新（Single Source of Truth）
2. **MCP ツール** `mcp__mcp-mermaid__generate_mermaid_diagram` で SVG を再生成
   - `outputType: "svg"`, `theme: "neutral"`
3. SVG内の `id="mermaid-0"` をユニークIDに変更（例: `mermaid-br-1`）
4. `static/images/help/{section}/{name}.svg` に保存
5. **`+page.svelte`** の `<img>` タグの `alt` テキストも必要に応じて更新

> **注意**: `content.md` にはMermaid記法を残す（LLM用）。`+page.svelte` ではSVG画像を参照する。

## ヘルプページ・llms.txt 管理

### 概要

ヘルプページには2種類のコンテンツがある：

1. **Svelteコンポーネント** (`+page.svelte`) - ブラウザ表示用（スタイリング付き）
2. **Markdownファイル** (`content.md`) - LLM用プレーンテキスト（llms.txt経由で配信）

**注意**: 内容の一貫性を保つため、片方だけ更新しないこと。

### ファイル構造

```
src/routes/help/{slug}/
├── +page.svelte          # ブラウザ表示用（HelpSection, HelpTable等を使用）
├── content.md            # LLM用Markdownコンテンツ
└── llms.txt/
    └── +server.ts        # content.mdを配信するエンドポイント（UTF-8 BOM付き）
```

### 新規ヘルプページ追加時

1. `src/routes/help/{slug}/+page.svelte` を作成
2. `src/routes/help/{slug}/content.md` を作成（同じ内容をMarkdownで）
3. `src/routes/help/{slug}/llms.txt/+server.ts` を作成：

   ```typescript
   import content from '../content.md?raw';

   export const prerender = true;

   // UTF-8 BOM（バイトオーダーマーク）- 静的ファイルサーバーでの文字化け対策
   const UTF8_BOM = '\uFEFF';

   export function GET() {
   	return new Response(UTF8_BOM + content, {
   		headers: {
   			'Content-Type': 'text/plain; charset=utf-8'
   		}
   	});
   }
   ```

4. `svelte.config.js` の `prerender.entries` に追加
5. `static/sitemap.xml` に `<url>` エントリを追加
6. `src/routes/llms.txt/+server.ts` のヘルプリンク一覧に追加

### Markdownの書式ガイドライン

- `# 見出し1` はページタイトルに使用
- `## 見出し2` はセクション（HelpSectionのtitleに対応）
- `> **INFO**:` / `> **TIP**:` / `> **WARNING**:` でノートを表現
- テーブルはMarkdown形式で記述
- コードブロックは ``` で囲む

## バージョンアップ手順

### バージョン番号の管理

- **`package.json`** の `version` フィールドが唯一のバージョン定義元（Single Source of Truth）
- Vite の `define` で `__APP_VERSION__` としてアプリに注入される（`vite.config.ts`）
- サイドバーフッター（`SidebarFooter.svelte`）に自動表示される

### リリース時の更新チェックリスト

| #   | ファイル           | 更新内容                                                                                                     |
| --- | ------------------ | ------------------------------------------------------------------------------------------------------------ |
| 1   | **`package.json`** | `version` フィールドを更新（例: `"0.2.2"` → `"0.3.0"`）                                                      |
| 2   | **`CHANGELOG.md`** | `[Unreleased]` → `[x.y.z] - YYYY-MM-DD` に移動、新しい `[Unreleased]` セクション追加、末尾のリンク参照を更新 |
| 3   | **`.claude/skills/`** | 機能変更に合わせてスキルファイルを更新（下記「Claude スキル・ルール更新」参照） |

**リリース手順**:

4. **git tag** — `git tag vX.Y.Z` でタグを打つ
5. **GitHub Pages デプロイ** — `main` にマージ後、GitHub Actions で自動デプロイ

### Claude スキル・ルール更新

リリース時に機能変更があった場合、以下の `.claude/` 配下ファイルも確認・更新すること：

| ファイル | 確認観点 |
| --- | --- |
| **`.claude/skills/e-shiwake-accounting/SKILL.md`** | ヘルプリンク一覧、ページ構成、決算ワークフロー手順が最新か |
| **`.claude/skills/e-shiwake-accounting/BROWSER-OPERATIONS.md`** | ページ構成テーブル、操作手順（バックアップ/エクスポート/アーカイブ等）が最新か |
| **`.claude/skills/e-shiwake-accounting/WEBMCP-TOOLS.md`** | WebMCPツールの追加・変更・削除がある場合に更新 |
| **`.claude/skills/e-shiwake-accounting/ACCOUNT-CODES.md`** | 勘定科目コードの追加・変更がある場合に更新 |
| **`.claude/rules/route-change.md`** | ルート変更チェックリストの更新が必要な場合 |
| **`.claude/rules/help-sync.md`** | ドキュメント同期ルールの変更が必要な場合 |
| **`.claude/rules/indexeddb-proxy.md`** | DB関連の注意事項が変更された場合 |

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
