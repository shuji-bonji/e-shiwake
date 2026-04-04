# 証憑保存改善案 — シナリオ別フロー図

## 現状の問題整理

```mermaid
graph TD
    subgraph 現状のデータ構造
        J[journals テーブル]
        J --> A1[attachments配列]
        A1 --> META[メタデータ<br/>id, generatedName, size...]
        A1 --> BLOB[blob?: Blob<br/>PDF実体 indexeddb時]
        A1 --> FP[filePath?: string<br/>filesystem時]
    end

    subgraph 問題点
        P1[❌ Blob が仕訳に埋め込み<br/>→ 仕訳テーブル肥大化]
        P2[❌ Safari 容量上限<br/>→ 証憑増加で破綻]
        P3[❌ 証憑だけの操作が不可<br/>→ 仕訳ごと扱うしかない]
        P4[❌ モード間移行で<br/>証憑データが欠損]
    end
```

## 改善後のデータ構造

```mermaid
graph TD
    subgraph 改善後
        J2[journals テーブル]
        J2 --> A2[attachments配列]
        A2 --> META2[メタデータのみ<br/>id, generatedName, size,<br/>storageType, filePath,<br/>archived: boolean]

        BT[attachmentBlobs テーブル 🆕]
        BT --> |id で参照| BR[id: string<br/>blob: Blob]

        A2 -.->|attachment.id| BT
    end

    style BT fill:#e8f5e9,stroke:#4caf50
    style BR fill:#e8f5e9,stroke:#4caf50
```

**ポイント**: 仕訳にはメタデータだけ。Blob は別テーブルに分離。

## シナリオ 1: 通常利用（Chrome デスクトップ / filesystem モード）

> 変更なし。今まで通り File System Access API で外部フォルダに保存。

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant App as e-shiwake
    participant FS as ファイルシステム
    participant IDB as IndexedDB

    U->>App: PDF をドロップ
    App->>FS: /{年度}/{ファイル名}.pdf として保存
    App->>IDB: journals.attachments[] に<br/>メタデータ + filePath を保存
    Note over IDB: Blob は保存しない<br/>（filePath で参照）

    U->>App: 証憑を表示
    App->>FS: filePath から読み込み
    FS-->>App: Blob
    App-->>U: PDF プレビュー表示
```

## シナリオ 2: 通常利用（Safari・iPad / indexeddb モード）

> **改善点**: Blob が仕訳から分離され、個別に操作可能に。

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant App as e-shiwake
    participant IDB as IndexedDB

    U->>App: PDF をドロップ
    App->>IDB: attachmentBlobs テーブルに<br/>{ id, blob } を保存 🆕
    App->>IDB: journals.attachments[] に<br/>メタデータのみ保存<br/>（blob は含まない）

    U->>App: 証憑を表示
    App->>IDB: attachmentBlobs.get(id)
    IDB-->>App: Blob
    App-->>U: PDF プレビュー表示
```

## シナリオ 3: 年度アーカイブ（Safari 容量対策）

> 古い年度の証憑 Blob を ZIP 出力後に IndexedDB から削除。メタデータは残る。

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant App as e-shiwake
    participant IDB as IndexedDB
    participant DL as ダウンロード

    U->>App: 「2024年度をアーカイブ」
    App->>IDB: 2024年度の仕訳を取得
    App->>IDB: 該当 attachmentBlobs を取得

    App->>App: ZIP 生成<br/>journals.json + /evidence/*.pdf
    App->>DL: e-shiwake-2024-archive.zip

    Note over U,DL: ユーザーが ZIP 保存を確認

    U->>App: 「アーカイブ完了、Blob削除」
    App->>IDB: attachmentBlobs から<br/>該当 Blob を削除 🗑️
    App->>IDB: attachments[].archived = true<br/>attachments[].blobPurgedAt = now

    Note over IDB: メタデータは残る<br/>仕訳⇔証憑の紐付けは維持<br/>容量は開放される ✅
```

```mermaid
graph LR
    subgraph アーカイブ後の状態
        J[仕訳: 2024-01-15 消耗品費]
        J --> A[attachment:<br/>id=xxx<br/>name=領収書.pdf<br/>archived=true ⚠️]
        A -.->|Blob なし| BT[attachmentBlobs<br/>該当レコード削除済み]
    end

    subgraph 画面表示
        V[📎 領収書.pdf<br/>サイズ: 245KB<br/>⚠️ アーカイブ済み<br/>→ ZIPから復元可能]
    end
```

## シナリオ 4: アーカイブ ZIP からの復元

> ZIP をインポートし、Blob を IndexedDB に戻す。仕訳は既存なのでスキップ。

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant App as e-shiwake
    participant IDB as IndexedDB

    U->>App: e-shiwake-2024-archive.zip をインポート

    App->>App: ZIP 展開<br/>journals.json + /evidence/*.pdf

    App->>IDB: 仕訳を照合
    Note over App,IDB: 既存の仕訳は更新しない<br/>（メタデータ一致確認のみ）

    loop 各 evidence/*.pdf
        App->>IDB: attachment.id で照合
        alt archived == true（Blob欠損）
            App->>IDB: attachmentBlobs に<br/>{ id, blob } を再保存 ✅
            App->>IDB: archived = false に更新
        else Blob が既に存在
            App->>App: スキップ（重複回避）
        end
    end

    App-->>U: 復元完了<br/>「12件の証憑を復元しました」
```

**ポイント**: 容量が足りない場合はここで警告を出す。全件ではなく選択的な復元も検討可。

## シナリオ 5: 端末移行（Safari → Safari）

```mermaid
sequenceDiagram
    participant OLD as 旧端末 Safari
    participant ZIP as ZIPファイル
    participant NEW as 新端末 Safari

    Note over OLD: 全データ ZIP エクスポート
    OLD->>ZIP: journals.json<br/>+ /evidence/*.pdf<br/>+ accounts.json<br/>+ vendors.json<br/>+ settings.json

    Note over ZIP: Airdrop / クラウド / USB で転送

    ZIP->>NEW: ZIP インポート
    NEW->>NEW: 仕訳 + メタデータ復元
    NEW->>NEW: attachmentBlobs に<br/>各 PDF を保存

    Note over NEW: 仕訳⇔証憑の紐付け<br/>完全に復元される ✅
```

## シナリオ 6: クロスブラウザ移行（Chrome filesystem → Safari indexeddb）

```mermaid
sequenceDiagram
    participant CH as Chrome<br/>filesystem モード
    participant ZIP as ZIPファイル
    participant SF as Safari<br/>indexeddb モード

    Note over CH: ZIP エクスポート
    CH->>CH: filesystem から PDF 読み込み
    CH->>ZIP: journals.json<br/>+ /evidence/*.pdf

    ZIP->>SF: ZIP インポート

    SF->>SF: journals.json から仕訳復元
    SF->>SF: evidence/*.pdf を<br/>attachmentBlobs に保存
    SF->>SF: storageType を<br/>'filesystem' → 'indexeddb' に変換
    SF->>SF: filePath をクリア

    Note over SF: 紐付け維持 ✅<br/>保存先が自動切り替え
```

## シナリオ 7: クロスブラウザ移行（Safari indexeddb → Chrome filesystem）

```mermaid
sequenceDiagram
    participant SF as Safari<br/>indexeddb モード
    participant ZIP as ZIPファイル
    participant CH as Chrome<br/>filesystem モード

    Note over SF: ZIP エクスポート
    SF->>SF: attachmentBlobs から Blob 取得
    SF->>ZIP: journals.json<br/>+ /evidence/*.pdf

    ZIP->>CH: ZIP インポート

    CH->>CH: journals.json から仕訳復元
    CH->>CH: ユーザーに保存先フォルダ選択を要求
    CH->>CH: evidence/*.pdf を<br/>ファイルシステムに保存
    CH->>CH: storageType を<br/>'indexeddb' → 'filesystem' に変換
    CH->>CH: filePath を設定

    Note over CH: 紐付け維持 ✅<br/>実ファイルとして保存
```

## シナリオ比較まとめ

```mermaid
graph TB
    subgraph 改善前
        B1[Chrome → Safari] -->|❌ filePath のみ<br/>Blob なし| FAIL1[証憑欠損]
        B2[Safari → Chrome] -->|❌ Blob なし<br/>ファイルもない| FAIL2[証憑欠損]
        B3[Safari 容量超過] -->|❌ 対処法なし| FAIL3[データ破損リスク]
        B4[端末移行] -->|❌ JSON は仕訳のみ| FAIL4[証憑引き継ぎ不可]
    end

    subgraph 改善後
        A1[Chrome → Safari] -->|✅ ZIP 経由| OK1[紐付け維持]
        A2[Safari → Chrome] -->|✅ ZIP 経由| OK2[紐付け維持]
        A3[Safari 容量超過] -->|✅ 年度アーカイブ| OK3[Blob削除+復元可]
        A4[端末移行] -->|✅ ZIP 完全バックアップ| OK4[全データ復元]
    end

    style FAIL1 fill:#ffebee,stroke:#f44336
    style FAIL2 fill:#ffebee,stroke:#f44336
    style FAIL3 fill:#ffebee,stroke:#f44336
    style FAIL4 fill:#ffebee,stroke:#f44336
    style OK1 fill:#e8f5e9,stroke:#4caf50
    style OK2 fill:#e8f5e9,stroke:#4caf50
    style OK3 fill:#e8f5e9,stroke:#4caf50
    style OK4 fill:#e8f5e9,stroke:#4caf50
```

## 実装の優先順位案

| 優先度 | タスク                                            | 影響範囲                                 | 工数感 |
| ------ | ------------------------------------------------- | ---------------------------------------- | ------ |
| 🔴 高  | Blob 分離（attachmentBlobs テーブル作成）         | DB マイグレーション + 全 attachment 操作 | 中     |
| 🔴 高  | ZIP エクスポートに全証憑を含める                  | import-export.ts                         | 中     |
| 🔴 高  | ZIP インポートで証憑 Blob 復元 + storageType 変換 | import-export.ts                         | 中     |
| 🟡 中  | 年度アーカイブ機能（Blob 削除 + archived フラグ） | 新規 UI + repository                     | 中     |
| 🟡 中  | アーカイブ済み証憑の表示（⚠️ マーク + 復元導線）  | journal 編集 UI                          | 小     |
| 🟢 低  | 選択的 Blob 復元（ZIP 内から特定年度だけ復元）    | import UI                                | 小     |
| 🟢 低  | ストレージ使用量の詳細表示（年度別 Blob サイズ）  | data ページ UI                           | 小     |

## 未解決の論点

1. **DBマイグレーション**: 既存ユーザーの仕訳に埋め込まれた Blob を attachmentBlobs テーブルに移行する必要がある。Dexie の `.upgrade()` で対応可能だが、証憑が多いユーザーはマイグレーションに時間がかかる可能性。

2. **ZIP インポート時の容量チェック**: Safari でインポートする前に「この ZIP の証憑は合計 XXX MB です。現在の空き容量は十分ですか？」と確認するべきか。IndexedDB の空き容量取得は `navigator.storage.estimate()` で可能。

3. **部分復元の UI**: ZIP から全証憑を一括復元すると容量不足になる場合、年度単位や件数単位で選択復元する UI が必要。ただし初期リリースでは一括のみで十分か。

4. **archived 状態のエクスポート**: アーカイブ済み（Blob なし）の仕訳を JSON エクスポートしたとき、`archived: true` を含めるべきか。再インポート先で「この証憑はアーカイブ済みです」と表示できるように。
