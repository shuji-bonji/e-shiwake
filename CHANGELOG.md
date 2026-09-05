# Changelog

e-shiwake（電子仕訳）の変更履歴。[Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に準拠。
[Semantic Versioning](https://semver.org/lang/ja/) に従う。

## [Unreleased]

## [0.6.2] - 2026-09-05

### Fixed

- 請求書の印刷・PDF 出力のレイアウトを修正（`layout.css` の `@media print`）
  - Safari で請求書タイトルの左に縦線が印刷されていた問題を修正。サイドバーの枠（`[data-slot='sidebar-container']`、`position: fixed` で右辺に `border-e` を持つ）が印刷時に非表示になっておらず、右辺の罫線だけが残っていた。`[data-slot='sidebar']` / `[data-slot='sidebar-container']` も非表示にする
  - 印刷内容が左に寄っていた問題を修正。`main` の余白を左だけ 0 にしていたため右の `padding` が残っていた。左右とも 0 にして対称にする
  - 表の右端の縦罫線が Safari で切れる（ビューアによっては灰色の半線になる）問題を修正。`border-collapse` の外周罫線は表の外側に半分はみ出すため、`.invoice-print` に `padding: 0 1mm` を持たせて印刷領域の内側に収める
  - ブラウザがダーク配色で印刷した場合に `@page` の余白が `#121212` で塗られる問題を修正（`html, body` に `color-scheme: light` を指定）
  - アプリのダークテーマのまま印刷した場合に、請求書の下端に黒い帯が出る問題を修正（`.group/sidebar-wrapper` / `[data-slot='sidebar-inset']` / `main` の背景を白に固定）

## [0.6.1] - 2026-09-05

### Added

- 請求書の売掛金仕訳を二重に作成できないようにした（#55）
  - 作成済み（`invoice.journalId` の仕訳が仕訳帳に存在する）なら「売掛金仕訳」ボタンを無効にし「作成済み」を表示する。仕訳帳でその仕訳を削除すると再び有効になる
  - 売掛金仕訳の作成後に請求書（明細行・取引先・発行日・請求書番号）を変更すると、自動保存のあとに `compareSalesJournal()` で不一致を検出し、`syncSalesJournal()` で仕訳の日付・取引先・摘要・明細行を上書きしてトーストで通知する（証憑と evidenceStatus は保持。ステータス変更は対象外）
  - 請求書一覧から請求書を削除すると、紐付く売掛金仕訳も削除してトーストで通知する（削除ダイアログに対象を表示）。入金仕訳は削除せず仕訳帳に残す
- 入金仕訳が作成済みの場合、仕訳作成ダイアログに警告を表示するようにした（#55）
  - `Invoice` に `depositJournalIds`（入金仕訳 ID の配列）を追加して紐付けを保存し、作成済みの一覧・入金合計・未入金残額を表示する。全額入金済みならボタンを「それでも作成」に変える
  - 警告内の「仕訳帳で検索」で、請求書番号を検索した状態の仕訳帳へ移動する
  - 請求書編集画面の入金仕訳ボタンに「n 件」のバッジを表示する
- 入金仕訳ダイアログに入金額の入力欄を追加（初期値は未入金残額）。分割入金に対応し、`generateDepositJournal()` に `amount` 引数を追加
- `calculateDepositSummary()` / `getJournalAmount()` / `compareSalesJournal()` / `buildSalesJournalUpdate()` を `invoice-journal.ts` に、`getLinkedJournals()` / `syncSalesJournal()` / `deleteLinkedJournal()` を `invoice-journal-sync.ts` に追加（純粋関数は単体テスト付き）

### Changed

- 請求書のコピー時に `depositJournalIds` もクリアする
- バックアップ・インポートで `depositJournalIds` を引き継ぐ

## [0.6.0] - 2026-09-05

### Added

- 請求書のステータスを 1 段階前に戻せるようにした（入金済み → 発行済み、発行済み → 下書き）（#54）
  - 請求書編集画面のヘッダーに「ステータスを戻す」ボタンを追加。確認ダイアログを経て反映する
  - 戻しても、その請求書から作成した仕訳（売掛金仕訳・入金仕訳）は削除しない。ダイアログとヘルプ「請求書」にその旨を明記
- 請求書編集画面から取引先を追加できる導線を追加
  - 取引先欄に「取引先を追加」リンクを追加。取引先管理を `?new=1&returnTo=/invoice/{id}` で開き、追加ダイアログを最初から表示する
  - 取引先を保存すると元の請求書に戻り（`?vendorId=`）、作成した取引先を自動で選択する。取引先管理のヘッダーには「請求書に戻る」ボタンを表示する
  - 取引先未設定のまま「売掛金仕訳」「入金仕訳」を押した場合、ボタンを無効にする代わりに案内トースト（「取引先を追加」アクション付き）を表示する
  - 取引先が 1 件も登録されていない場合、取引先欄に案内文を表示する
- AI チャットのプロバイダ設定に、HTTPS ページから `http://` を呼ぶ構成の判定を追加（`detectMixedContentRisk()`）
  - 設定画面の接続先 URL 入力欄に、ブラウザ側の制限と対処を警告表示
  - 接続に失敗したときのエラーメッセージにも同じ説明を含める（従来は CORS 設定の確認だけを案内していたが、実際には別の制限で止まっている場合がある）
  - 接続先がローカルネットワーク（`.local` / RFC1918 / リンクローカル）かどうかで文言を分ける。Chrome 142 以降はローカルネットワーク宛を混在コンテンツの対象外とし、「ローカルネットワークへのアクセス」の許可を求める方式に変わったため、Chrome と Safari・Firefox で挙動が異なる
  - 送信自体は止めない（Chrome の許可設定によっては通るため、ブラウザの判断を先取りしない）
  - `localhost` / `127.0.0.1` は安全なオリジンとして扱われるため判定から除外

### Fixed

- 請求書一覧で、取引先を一度も設定していない請求書が「(削除された取引先)」と表示されていた問題を修正（「(取引先未設定)」と表示する）
- AI チャットを全画面（`/chat`）で開くと、サイドパネル表示に戻す手段がなかった問題を修正
  - 全画面ページのヘッダーに「サイドパネルに戻す」ボタンを追加
  - 全画面で開く直前のパスを記録し（`setChatReturnPath()`）、そのページへ戻ってパネルを開く。サイドバーから直接 `/chat` を開いた場合はホームへ戻る

### Changed

- LLM プロバイダ設定と型定義の例示を、開発者の環境固有のホスト名から一般的な例に差し替え（接続先 URL の入力例を `http://localhost:4000/v1`、表示名の入力例を「自宅サーバーの Gemma」、ヘルプの LAN 内の例を `http://192.168.1.10:4000/v1` に変更）
- ヘルプ「AI チャット」に「接続先 URL のプロトコル」の節とトラブルシューティング行を追加（`content.md` / `+page.svelte`）
- `docs/design/llm-chat.md` の CORS 留意点を、混在コンテンツと CORS の 2 点に分けて記述（LiteLLM は既定で `access-control-allow-origin: *` を返すことを実測で確認）

## [0.5.2] - 2026-07-13

### Added

- 証憑削除確認ダイアログに電帳法（事務処理規程）の注意書きとヘルプリンクを追加（`docs/design/correction-workflow.md` Phase 0）
- 訂正・削除ワークフロー設計メモ `docs/design/correction-workflow.md` を追加（correctionLogs・請求書発行後ロックの構想）

### Changed

- ヘルプ（証憑管理・アーカイブ）の電帳法説明を是正
  - 「真実性の確保＝ファイル命名規則」という誤解を招く記述を修正（ファイル命名規則は**検索要件**への対応であり、真実性の措置ではない）
  - 真実性の確保は電子帳簿保存法施行規則第4条第1項の4措置の**いずれか1つ**で足り、本アプリは4号「訂正削除の防止に関する事務処理規程」の備付け・運用で対応する前提であることを明記（国税庁ひな型へのリンクを追加）
  - 「タイムスタンプの付与や訂正削除の履歴管理が必要な場合があります」という曖昧な WARNING を、事務処理規程で足りる旨の具体的な案内に置換
  - 基準期間売上高5,000万円以下＋ダウンロードの求めに応じる場合の検索要件免除を追記
  - 事務処理規程の具体的な導入手順（3ステップ・ひな型直リンク・記入例）と「取引情報訂正・削除申請書」の記入例を追加。規程未整備のまま保存すると要件を満たさない旨を WARNING で強調

## [0.5.1] - 2026-07-05

### Fixed

- 家事按分適用中の仕訳で、貸方金額の変更が按分再計算に反映されない・証憑PDFのリネームダイアログが開かない問題を修正
  - 原因: `handleUpdateJournal`（仕訳帳ページ）が IndexedDB への `await updateJournal()` を**先に**実行し、ローカル状態 `journals` の更新が後になるため、change イベント直後に発火する blur / click ハンドラが古い `journal` prop を読む競合ウィンドウが存在した
  - 症状1: 金額入力直後に「按分適用」ボタンを押すと、旧 prop（金額0）を基に按分され金額が0円になる
  - 症状2: 貸方変更時、blur の証憑同期が旧 prop で名前差分なしと誤判定 → リネームダイアログが開かない
  - 症状3: リネームダイアログ確定時、blur 時点の古いスナップショットで `onupdate` するため、直前の按分再計算が古いデータで上書きされる
  - 対策: ①ローカル状態を同期的に先へ更新し DB 書き込みを後追いに変更、②リネーム確定時は attachments のみを最新の journal prop に適用（`JournalRow.executeSyncAttachments`）

## [0.5.0] - 2026-07-04

### Added

- **AI チャット（LLM アシスタント）** — ユーザーが用意した LLM（ローカル/クラウド）で帳簿を自然言語操作できるアプリ内コパイロット（設計: `docs/design/llm-chat.md`）
  - `ProviderAdapter`（OpenAI 互換 `/v1/chat/completions`）でローカル LLM（LiteLLM/Ollama/vLLM/llamafile）・OpenAI・Anthropic・Gemini・Grok・カスタムを同一コードで切替（`src/lib/llm/`）
  - 設定ページに LLM プロバイダ設定カードを追加（プリセット選択・疎通テスト・クラウド警告。API キーは端末内 IndexedDB のみ）
  - ブラウザ内エージェントループで WebMCP と同一のツール定義 17 個を tool calling 実行（iPad Safari でも動作）
  - `delete_journal` は実行前に承認ダイアログを表示（Human-in-the-Loop）
  - デスクトップはドッキング型サイドパネル（本体画面が横縮小し、AI が開いたフォームを並行操作可能）、モバイルはオーバーレイ Sheet、+ 専用ルート `/chat` の兼用 UI。会話履歴は IndexedDB に永続化
  - ユーザーメッセージに「再実行・コピー・編集して再送信」アクション（初回のローカルネットワーク許可等で送信が失敗した際の再送に対応）
  - AI 回答の Markdown レンダリング（marked + DOMPurify + @tailwindcss/typography。サニタイズ済み HTML のみ表示）
  - ヘルプページ `/help/llm-chat` を追加
  - IndexedDB スキーマ v9（`llmProviders` / `chatSessions` テーブル追加）

### Fixed

- WebMCP ツール説明・ルート `llms.txt`・`docs/webmcp-tool-inputs.md`・`.claude/skills` の勘定科目コード一覧/サンプルが実際のマスタ（seed）と不一致だった問題を修正（例: 売掛金は 1005、未払金は 2004、消耗品費は 5011）

## [0.4.1] - 2026-05-03

### Fixed

- 仕訳帳で日付を変更しても証憑PDFのファイル名が更新されない問題を修正
  - `JournalRow.svelte` の `handleDateBlur` から `syncAttachmentsOnBlur` を呼び出す際、親の `handleUpdateJournal` が `await updateJournal(...)` を含む async 関数のため `journal` prop の伝播が間に合わず、旧日付でファイル名生成が走っていた
  - `localDate` を「実効日付」として採用し、`effectiveJournal = { ...journal, date: localDate }` をベースにファイル名生成・リネームダイアログ・`syncAttachmentsOnBlurUseCase` 呼び出しを行うよう修正
  - `executeSyncAttachments(targetJournal, mainDebitAmount)` のシグネチャを変更し、リネームダイアログ確認後も最新日付でリネームされるよう修正

## [0.4.0] - 2026-04-08

### Added

- **データ管理3層構造** — バックアップ・リストア / エクスポート / アーカイブの整理
  - 設定ページ（`/settings`）とデータ管理ページ（`/data`）を分離
  - バックアップ・リストアをBackupCardに統合（ZIP形式で全データの保存・復元）
  - エクスポート機能をExportCardに分離（CSV/JSONでのデータ出力）
- **フルバックアップ（スナップショット）** — 全年度の全データを一括バックアップ・上書きリストア
  - 新型 `BackupData`（version 3.0.0）で全年度の仕訳・証憑・勘定科目・取引先・固定資産・請求書・設定を含む
  - 年度選択を廃止し、単一の「フルバックアップ作成」ボタン + 全体サマリ表示
  - リストアはマージモードを廃止し上書きのみ（確認ダイアログ強化）
  - ZIP判別: BackupData → フルリストア / ExportData → アーカイブページへ自動誘導
- **アーカイブリストア** — アーカイブZIPから年度の仕訳＋証憑をマージ復元する機能
  - 仕訳＋証憑のみ復元（グローバルデータは一切触らない）
  - 既存の仕訳IDと重複する場合はスキップ
  - 旧バックアップ（v1/v2）ZIPもアーカイブリストアとして読み込み可能
  - 証憑保存先を年度単位で選択可能
- **検索機能付アーカイブ** — 年度決算パッケージのZIP生成（`/archive`）
  - 仕訳＋証憑＋帳簿レポート（HTML/CSV）＋検索HTMLを単一ZIPで保存
  - 電帳法対応の検索要件（日付・金額・取引先）をオフラインで利用可能
  - アーカイブ後の年度データ削除機能（ストレージ容量節約）
- **v0.4.0アップグレード通知** — 初回起動時にバックアップ仕様変更を通知するダイアログ
  - 「バックアップを作成する」ボタンでデータ管理ページへ直接移動
  - 「以降この通知を表示しない」チェックボックスで非表示設定
  - 既存ユーザー（仕訳データあり）のみ表示、新規ユーザーには非表示
- **旧ZIPフォーマット警告** — v0.3.x以前のZIP読み込み時に設定データ未復元の注意を表示
  - BackupCard リストアセクションに旧ZIP注意バナーを常設
  - アーカイブリストアのプレビューで旧バージョン検出時に目立つ警告バナー
- **バックアップUX改善**
  - 最終バックアップ日時の表示（30日以上未バックアップで警告バナー）
  - リストア時の証憑保存先選択UI（ローカルフォルダ/ブラウザ内を選択可能）
  - IndexedDB容量表示と容量不足リスクの警告
  - File System API非対応ブラウザでのフォールバック処理
  - リストア時の証憑保存先を毎回明示的に選択（バックアップ元の設定に依存しない）
- **テスト追加** — zip-import / archive-export / settings-repository のユニットテスト（66テスト追加）
- **年度別の証憑保存先設定** — 設定ページで年度ごとにローカルフォルダ/ブラウザ内を切替可能
  - 切替時に該当年度の証憑PDFを自動マイグレーション（確認ダイアログ+進捗バー付き）
  - デフォルト保存先をFile System Access API対応状況で自動判定（Chrome→ローカル、Safari→ブラウザ）
  - リストア時に選択した保存先も年度別の設定として自動保存

### Changed

- バックアップを年度スコープからフルスナップショットに変更（`BackupData` v3.0.0）
  - `ExportData` は年度スコープのエクスポート・アーカイブ用として維持
  - 旧バックアップ（v1/v2）はアーカイブリストアとして処理
- `deleteYearData` を拡張: 請求書の削除、ローカルファイルシステムの証憑ファイル削除に対応
- 証憑保存先のグローバル設定（RadioGroup）を廃止し、年度別設定に一本化
  - 初回起動時にグローバル設定が既存の場合、全年度に自動展開（既存ユーザーの設定を引き継ぎ）
- インポート機能を削除（バックアップ・リストアに統合）
  - ImportCard.svelte を削除
  - ヘルプページ「インポート・エクスポート」→「エクスポート」に改名・内容を書き換え
- `restoreAllSettings` で `storageMode` / `storageModeByYear` をリストア対象から除外（リストア先の環境に依存するため）
- ヘルプページ全面更新
  - 「バックアップ・リストア」→ フルスナップショット・上書きリストア・ZIP判別の説明に刷新
  - 「アーカイブ」→ アーカイブリストアセクション追加、バックアップとの違い表を更新
  - 「設定・データ管理」→ 設定/データ管理の2層構造に書き換え
- ヘルプページのユースケース・シーケンス図を保存モードベースに刷新（SVG再生成）
- llms.txt をデータ管理3層構造・年度別証憑保存設定に合わせて更新

## [0.3.1] - 2026-04-04

### Added

- **インボイス登録期間の適用月指定** — 年度途中での登録・脱退に対応（[#31](https://github.com/shuji-bonji/e-shiwake/issues/31)）
  - BusinessInfo に `invoiceRegistrationStart` / `invoiceRegistrationEnd` フィールドを追加
  - 事業者情報・青色申告設定の両画面で登録適用開始日・終了日を設定可能
  - 消費税集計ページにインボイス登録期間のステータス表示（全期間適用/一部期間/期間外）
  - 登録期間外に課税売上がある仕訳の検出・警告表示（最大5件表示）
  - 請求書編集画面に適格請求書の記載要件チェック機能を追加（登録番号・発行者名・取引先・品名）
  - 印刷時に要件不備があればトースト通知で注意喚起（非ブロッキング）
  - 免税事業者（登録番号未設定）の場合はチェックをスキップ

### Changed

- **llms.txt の全面見直し** — 構成改善・内容最新化（[#36](https://github.com/shuji-bonji/e-shiwake/issues/36)）
  - ルート `/llms.txt` をテーブル形式で再構成、機能一覧・ヘルプリンクをカテゴリ別に整理
  - ヘルプリンクにWebMCPを追加、各リンクに概要説明を付与
  - WebMCPツール一覧をテーブル形式に変更
  - 消費税区分のヘルプにインボイス登録期間の説明を追加
  - 青色申告決算書のヘルプ設定項目にインボイス関連を追加
  - WebMCP の llms.txt サーバーに UTF-8 BOM を追加（他エンドポイントと統一）
- エクスポートボタンのラベルを用途ベースに変更（[#29](https://github.com/shuji-bonji/e-shiwake/issues/29)）
  - CSV → `仕訳のエクスポート (.csv)`
  - JSON → `データのエクスポート (.json)`
  - ZIP → `データと証憑のエクスポート (.zip)`
- 証憑PDFのダウンロード機能をエクスポートカードからストレージ使用量セクションに移動（運用向けワークアラウンドとして整理）
- 「データ形式について」カードをエクスポートボタンと一致する3形式に整理
- ヘルプ「設定・データ管理」をエクスポートUI変更に合わせて全面更新
  - エクスポート形式表を3列（.csv / .json / .zip）に再構成
  - インポートモード（マージ / 上書き）の説明追加
  - ZIP復元 × 保存モードの関係表を追加
  - ブラウザ別ストレージ容量の参考情報を追加

## [0.3.0] - 2026-04-04

### Added

- サイドバーフッターにアプリバージョン表示（`package.json` の version を Vite define で注入）
- **ExportData v2.0.0** — エクスポート/インポートに固定資産・請求書・全設定を追加（[#29](https://github.com/shuji-bonji/e-shiwake/issues/29)）
  - 固定資産台帳（`fixedAssets`）のエクスポート/インポート対応
  - 請求書（`invoices`）のエクスポート/インポート対応
  - 全設定（`allSettings`）のエクスポート/インポート対応（青色申告設定・事業者情報等）
  - v1 データとの後方互換性を維持（optional フィールド）
  - エクスポートカードに固定資産・請求書件数表示
  - インポートプレビューに固定資産・請求書・設定有無を表示

### Changed

- 請求書→仕訳生成の摘要を変更（証憑ファイル名の `_請求書_請求書_` 重複を解消）
  - 売掛金仕訳: `請求書 INV-XXXX-XXXX` → `売掛金計上 INV-XXXX-XXXX`
  - 入金仕訳: `入金 請求書 INV-XXXX-XXXX` → `入金 INV-XXXX-XXXX`
- 証憑ファイル命名テンプレートのドキュメントを修正（`{勘定科目}` → `{摘要}`）
- ヘルプドキュメント（証憑管理・請求書）を最新仕様に合わせて更新

### Fixed

- 青色申告決算書の控除額・棚卸設定が再読み込みで消える問題（IndexedDB に永続化）([#35](https://github.com/shuji-bonji/e-shiwake/issues/35))
- 証憑PDFリネームロジックの包括的改善 ([#34](https://github.com/shuji-bonji/e-shiwake/issues/34))
  - ファイルシステムリネーム失敗時にメタデータをロールバック（不整合防止）
  - 手動ファイル名のバリデーション追加（パストラバーサル、禁止文字、`.pdf` 重複、UTF-8 バイト長）
  - 長いファイル名の自動切り詰め（UTF-8 で 240 バイト上限）
  - 金額 0 円が falsy 扱いされる問題を修正
  - 摘要・取引先が空の場合の自動補完（「未分類」「不明」）
- 請求書→仕訳生成時に取引先未選択でエラーになる問題（ボタン無効化 + トースト通知）
- 売掛金仕訳の証憑添付時に書類種別が `請求書`（受領）と推定される問題を修正（売掛金が借方 → `請求書発行` に自動判定）
- インポート時の DataCloneError を修正（Svelte $state プロキシのプレーンオブジェクト変換）
- インポート後に事業者情報が画面に反映されない問題を修正

## [0.2.2] - 2026-03-08

### Added

- **請求書コピー機能** — 既存の請求書をコピーして新規作成（[#21](https://github.com/shuji-bonji/e-shiwake/issues/21)）
  - 一覧のコピーボタン（📋）から即座にコピー＆編集画面へ遷移
  - 発行日は今日、支払期限は翌月末、ステータスは下書きにリセット
  - 取引先・明細行・備考はそのまま引き継ぎ
  - 請求書番号は自動採番、仕訳紐付けはクリア

## [0.2.1] - 2026-03-06

### Changed

- **パフォーマンス最適化**
  - `filterJournals()` の `toLowerCase()` をループ外でキャッシュし、検索条件が複数ある場合の冗長な変換を排除
  - `settings-repository.ts` の証憑カウント関数を `toArray()` → `each()` に変更し、全仕訳の一括メモリロードを回避
  - `settings-repository.ts` の purge 系関数で `attachments.length > 0` の事前フィルタを追加し、添付なし仕訳のスキャンを排除
  - WebMCP ツール群の `getAllAccounts()` にモジュールレベルキャッシュを導入（7 箇所の重複 DB 呼び出しを解消）

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

[Unreleased]: https://github.com/shuji-bonji/e-shiwake/compare/v0.6.2...HEAD
[0.6.2]: https://github.com/shuji-bonji/e-shiwake/compare/v0.6.1...v0.6.2
[0.6.1]: https://github.com/shuji-bonji/e-shiwake/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/shuji-bonji/e-shiwake/compare/v0.5.2...v0.6.0
[0.5.2]: https://github.com/shuji-bonji/e-shiwake/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/shuji-bonji/e-shiwake/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/shuji-bonji/e-shiwake/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/shuji-bonji/e-shiwake/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/shuji-bonji/e-shiwake/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/shuji-bonji/e-shiwake/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/shuji-bonji/e-shiwake/compare/v0.2.2...v0.3.0
[0.2.2]: https://github.com/shuji-bonji/e-shiwake/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/shuji-bonji/e-shiwake/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/shuji-bonji/e-shiwake/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/shuji-bonji/e-shiwake/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/shuji-bonji/e-shiwake/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/shuji-bonji/e-shiwake/releases/tag/v0.0.1
