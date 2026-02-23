# Changelog

e-shiwake（電子仕訳）の変更履歴。[Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に準拠。
[Semantic Versioning](https://semver.org/lang/ja/) に従う。

## [0.2.0] - 2026-02-23

### Added

- **WebMCP 対応** — Chrome 146+ の `navigator.modelContext` API にツールを登録し、AI エージェントから仕訳操作・帳簿生成が可能に
  - 12 ツール: `search_journals`, `get_journals_by_year`, `create_journal`, `delete_journal`, `list_accounts`, `list_vendors`, `generate_ledger`, `generate_trial_balance`, `generate_profit_loss`, `generate_balance_sheet`, `calculate_consumption_tax`, `get_available_years`
  - 入力バリデーション（`validate.ts`）
  - テスト実装（28 テストケース）
- **WebMCP UI 自動更新** — `create_journal` / `delete_journal` 実行後に `CustomEvent` で仕訳帳ページを自動リフレッシュ（リロード不要）
- **請求書作成機能** — 請求書の作成・編集・印刷、仕訳自動生成（売掛金計上・入金処理）
- **PDF 添付上書き警告** — 同一名 PDF 証憑の添付保存時にバリデーション追加
- **仕訳帳ヘッダー固定** — 検索バーをスティッキーヘッダーに配置
- **ヘルプページ llms.txt** — 各ヘルプページに LLM 向けプレーンテキストエンドポイントを設置

### Changed

- **コードリファクタリング**
  - `db/index.ts` の肥大化解消（リポジトリパターンで分割）
  - `JournalRow.svelte` 分割（DialogState 判別共用体、JournalRowDialogs 分離）
  - ルートページ肥大化対応（`useJournalPage` フック抽出、data / reports / blue-return 等）
  - `AppSidebar.svelte` 分割、`setSetting` の改善
  - テストファイル分割（account / database / import-export / invoice / journal / vendor）

### Fixed

- 勘定科目変更時にデフォルト消費税区分が即座に適用されない問題
- 検索で年・年月の組み合わせが正しく動作しない問題
- 青色申告決算書の貸借対照表で事業主貸の配置を国税庁様式に準拠
- 青色申告決算書で `generateBalanceSheet` に当期純利益を渡していない問題
- 日付入力途中で自動ソートが発動する問題
- ヘルプページの llms.txt リンク切れ
- 複数ページで h1 が重複していた問題
- meta description の追加

## [0.1.1] - 2026-02-07

### Added

- **青色申告決算書** — 4 ページプレビュー、設定ダイアログ、印刷 / CSV 出力
- **固定資産台帳** — CRUD、減価償却シミュレーション、CSV 出力
- **帳簿出力** — 複数帳簿の一括印刷、CSV ZIP 出力
- **消費税集計** — 課税売上 / 仕入、納付税額計算、免税・簡易課税判定
- **損益計算書** — 売上総利益、営業利益、当期純利益
- **貸借対照表** — 流動 / 固定資産・負債、純資産、貸借一致チェック
- **ZIP エクスポート** — JSON + PDF 証憑同梱の完全バックアップ
- ヘルプページ（用語集、ショートカット、各機能の使い方）

## [0.1.0] - 2026-01-15

### Added

- **PWA 対応** — `@vite-pwa/sveltekit` + Workbox によるオフライン動作
- **ダークモード** — ライト / ダーク / システム設定切り替え
- **消費税区分** — 課税売上 / 仕入 10% / 8%、非課税、不課税、対象外
- **ストレージマイグレーション** — ブラウザ ⇔ ローカルフォルダ間の証憑移行
- **仕訳検索** — 全年度横断、複数条件 AND 検索
- **仕訳コピー** — 既存仕訳を複製して新規作成
- **タブ順序最適化** — 日付 → 摘要 → 借方 → 貸方 → 取引先 → PDF → 循環

## [0.0.1] - 2025-12-28

### Added

- **初期リリース（MVP）**
  - サイドバーレイアウト（shadcn-svelte Sidebar）
  - 年度管理（選択 / フィルタリング）
  - 仕訳 CRUD（複合仕訳対応、インライン編集）
  - 勘定科目マスタ（初期データ込み、追加 / 編集 / 削除）
  - 取引先オートコンプリート
  - PDF 証憑紐付け + 自動リネーム（電帳法準拠）
  - 証跡ステータス管理（なし / 紙 / 電子）
  - IndexedDB 保存（Dexie.js）
  - JSON / CSV エクスポート、JSON インポート
  - 証憑ダウンロード（IndexedDB モード向け）
  - File System Access API 対応（デスクトップ向け）

[0.2.0]: https://github.com/shuji-bonji/e-shiwake/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/shuji-bonji/e-shiwake/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/shuji-bonji/e-shiwake/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/shuji-bonji/e-shiwake/releases/tag/v0.0.1
