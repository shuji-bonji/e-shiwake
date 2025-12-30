# データ・証憑ストレージ アーキテクチャ

e-shiwake のデータと証憑（PDF）の保存、エクスポート、インポートに関する技術ドキュメント。

## 目次

- [ストレージモード](#ストレージモード)
- [データ構造](#データ構造)
- [ユースケース](#ユースケース)
  - [証憑添付](#証憑添付)
  - [証憑閲覧](#証憑閲覧)
  - [JSONエクスポート](#jsonエクスポート)
  - [ZIPバックアップ](#zipバックアップ)
  - [JSONインポート](#jsonインポート)
  - [ZIPインポート](#zipインポート)
- [ストレージモード移行](#ストレージモード移行)

## ストレージモード

e-shiwake は2つのストレージモードをサポート。

| モード       | 対象環境                 | 証憑保存先           | API                    |
| ------------ | ------------------------ | -------------------- | ---------------------- |
| `filesystem` | デスクトップ Chrome/Edge | ローカルフォルダ     | File System Access API |
| `indexeddb`  | iPad Safari、その他      | ブラウザ内 IndexedDB | Dexie.js               |

### モード判定

```typescript
// 設定で明示的に選択、またはAPI対応状況で自動判定
const storageMode: 'filesystem' | 'indexeddb' = settings.storageType;
```

### 各モードの特徴

```
┌─────────────────────────────────────────────────────────────────┐
│                     filesystem モード                           │
├─────────────────────────────────────────────────────────────────┤
│  ブラウザ                        ローカルフォルダ                │
│  ┌──────────────┐               ┌──────────────────────┐       │
│  │ IndexedDB    │               │ e-shiwake/           │       │
│  │ ・仕訳データ  │               │ ├─ 2024/             │       │
│  │ ・勘定科目   │               │ │  ├─ 領収書_xxx.pdf │       │
│  │ ・取引先     │               │ │  └─ 請求書_yyy.pdf │       │
│  │ ・設定       │               │ └─ 2025/             │       │
│  │              │  filePath     │    └─ 領収書_zzz.pdf │       │
│  │ attachment:  │─────────────▶│                      │       │
│  │  filePath    │               └──────────────────────┘       │
│  │  (blob無し)  │                                              │
│  └──────────────┘                                              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     indexeddb モード                            │
├─────────────────────────────────────────────────────────────────┤
│  ブラウザ                                                       │
│  ┌──────────────────────────────────────────────────┐          │
│  │ IndexedDB                                        │          │
│  │ ・仕訳データ                                      │          │
│  │ ・勘定科目                                        │          │
│  │ ・取引先                                          │          │
│  │ ・設定                                            │          │
│  │                                                  │          │
│  │ attachment:                                      │          │
│  │  blob: Blob(PDF)  ◀── 証憑はDB内に保存           │          │
│  │  (filePath無し)                                  │          │
│  └──────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

## データ構造

### Attachment（証憑）

```typescript
interface Attachment {
	id: string;
	journalEntryId: string;
	documentDate: string; // 書類の日付 YYYY-MM-DD
	documentType: DocumentType; // 'receipt' | 'invoice' | 'bill' | ...
	originalName: string; // 元のファイル名
	generatedName: string; // 自動生成ファイル名
	mimeType: string;
	size: number;
	description: string;
	amount: number;
	vendor: string;

	// ストレージモードにより異なる
	storageType: 'filesystem' | 'indexeddb';
	blob?: Blob; // indexeddb モード時のみ
	filePath?: string; // filesystem モード時のみ

	createdAt: string;
}
```

### ExportData（エクスポートデータ）

```typescript
interface ExportData {
	version: string;
	exportedAt: string;
	fiscalYear: number;
	journals: JournalEntry[]; // attachments含む（blob除外）
	accounts: Account[];
	vendors: Vendor[];
	settings: Settings;
}
```

## ユースケース

### 証憑添付

PDFを仕訳にドラッグ＆ドロップして添付する。

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant UI as JournalRow
    participant DB as IndexedDB
    participant FS as ローカルフォルダ

    User->>UI: PDFをドロップ
    UI->>UI: generateAttachmentName()

    alt filesystem モード
        UI->>FS: saveFileToDirectory(blob, year)
        FS-->>UI: filePath
        UI->>DB: journals.update(attachments)
        Note over DB: filePath保存、blob無し
    else indexeddb モード
        UI->>DB: journals.update(attachments)
        Note over DB: blob保存、filePath無し
    end

    UI-->>User: 添付完了表示
```

### 証憑閲覧

添付済みPDFをクリックしてプレビュー表示。

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant UI as AttachmentList
    participant DB as IndexedDB
    participant FS as ローカルフォルダ

    User->>UI: 証憑クリック

    alt filesystem モード
        UI->>FS: directoryHandle.getFileHandle(filePath)
        FS-->>UI: FileHandle
        UI->>FS: fileHandle.getFile()
        FS-->>UI: File (Blob)
    else indexeddb モード
        UI->>DB: attachment.blob
        DB-->>UI: Blob
    end

    UI->>UI: URL.createObjectURL(blob)
    UI-->>User: PDFプレビュー表示
```

### JSONエクスポート

仕訳データのみをJSONでエクスポート（証憑PDFは含まない）。

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant UI as DataPage
    participant DB as IndexedDB

    User->>UI: JSONエクスポート クリック
    UI->>DB: getAllJournals(fiscalYear)
    DB-->>UI: journals[]
    UI->>DB: getAllAccounts()
    DB-->>UI: accounts[]
    UI->>DB: getAllVendors()
    DB-->>UI: vendors[]

    UI->>UI: prepareExportData()
    Note over UI: blobを除外してJSON生成

    UI->>UI: downloadJson(exportData)
    UI-->>User: data_2024.json ダウンロード

    Note over User: 証憑PDFは含まれない<br/>別途バックアップが必要
```

### ZIPバックアップ

仕訳データ + 証憑PDFを完全バックアップ。

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant UI as DataPage
    participant DB as IndexedDB
    participant FS as ローカルフォルダ
    participant ZIP as JSZip

    User->>UI: ZIPバックアップ クリック
    UI->>DB: getAllJournals(fiscalYear)
    DB-->>UI: journals[]

    UI->>ZIP: new JSZip()
    UI->>ZIP: zip.file('data.json', exportData)

    loop 各証憑
        alt filesystem モード
            UI->>FS: getFile(filePath)
            FS-->>UI: Blob
        else indexeddb モード
            UI->>DB: attachment.blob
            DB-->>UI: Blob
        end
        UI->>ZIP: zip.file('evidences/' + year + '/' + journalId + '/' + attachmentId + '/' + fileName, blob)
    end

    UI->>ZIP: zip.generateAsync({type: 'blob'})
    ZIP-->>UI: zipBlob
    UI-->>User: e-shiwake_backup_2024.zip ダウンロード
```

**ZIPファイル構造:**

```
e-shiwake_backup_2024.zip
├── data.json                              # 仕訳・勘定科目・取引先・設定
└── evidences/                             # 証憑PDF（ID安全な階層）
    ├── 2024/
    │   ├── {journalId}/
    │   │   ├── {attachmentId}/
    │   │   │   └── 2024-01-15_領収書_USBケーブル_3980円_Amazon.pdf
    │   │   └── ...
    │   └── ...
    └── ...
```

### JSONインポート

JSONファイルから仕訳データを復元（証憑PDFは復元されない）。

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant UI as DataPage
    participant DB as IndexedDB

    User->>UI: JSONファイル選択
    UI->>UI: JSON.parse(file)
    UI->>UI: validateExportData()
    UI-->>User: プレビュー表示

    User->>UI: インポート実行

    alt 上書きモード
        UI->>DB: 対象年度のデータ削除
    end

    UI->>DB: accounts.bulkPut()
    UI->>DB: vendors.bulkPut()
    UI->>DB: journals.bulkPut()
    Note over DB: attachment.blobは空

    UI-->>User: インポート完了

    Note over User: 証憑PDFは閲覧不可<br/>ZIPからのインポートが必要
```

### ZIPインポート

ZIPファイルから仕訳データ + 証憑PDFを完全復元。

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant UI as DataPage
    participant ZIP as JSZip
    participant DB as IndexedDB
    participant FS as ローカルフォルダ

    User->>UI: ZIPファイル選択
    UI->>ZIP: JSZip.loadAsync(file)
    ZIP-->>UI: zip

    UI->>ZIP: zip.file('data.json').async('string')
    ZIP-->>UI: jsonText
    UI->>UI: JSON.parse() & validate()

    UI->>ZIP: evidences/ 内のファイル一覧取得

    loop 各証憑ファイル
        UI->>ZIP: zip.files[path].async('arraybuffer')
        ZIP-->>UI: arrayBuffer
        UI->>UI: new Blob([arrayBuffer])
        UI->>UI: attachmentBlobs.set(attachmentId, blob)
    end

    UI-->>User: プレビュー表示（証憑数含む）

    User->>UI: インポート実行

    UI->>DB: journals.bulkPut()
    Note over DB: 仕訳データ保存

    UI->>UI: restoreAttachmentBlobs()

    loop 各証憑Blob
        alt filesystem モード
            UI->>FS: saveFileToDirectory(blob, year)
            FS-->>UI: filePath
            UI->>DB: attachment更新(filePath)
        else indexeddb モード
            UI->>DB: attachment更新(blob)
        end
    end

    UI-->>User: インポート完了

    Note over User: ZIPファイルは削除可能<br/>証憑はブラウザ/フォルダに保存済み
```

## ストレージモード移行

### filesystem → indexeddb

デスクトップからiPadへの移行など。

```mermaid
sequenceDiagram
    participant Desktop as デスクトップ Chrome
    participant ZIP as ZIPファイル
    participant iPad as iPad Safari

    Note over Desktop: filesystem モード
    Desktop->>ZIP: ZIPバックアップ作成
    Note over ZIP: data.json + PDFs

    ZIP->>iPad: ファイル転送（AirDrop等）

    Note over iPad: indexeddb モード
    iPad->>iPad: ZIPインポート
    Note over iPad: PDFはIndexedDBに保存

    iPad->>iPad: 証憑閲覧可能
```

### indexeddb → filesystem

iPadからデスクトップへの移行など。

```mermaid
sequenceDiagram
    participant iPad as iPad Safari
    participant ZIP as ZIPファイル
    participant Desktop as デスクトップ Chrome

    Note over iPad: indexeddb モード
    iPad->>ZIP: ZIPバックアップ作成
    Note over ZIP: data.json + PDFs

    ZIP->>Desktop: ファイル転送

    Note over Desktop: filesystem モード
    Desktop->>Desktop: ZIPインポート
    Note over Desktop: PDFはローカルフォルダに保存

    Desktop->>Desktop: 証憑閲覧可能
```

## 重要な注意点

### JSONエクスポート/インポートの制限

- **証憑PDFは含まれない**: JSONには仕訳データのみ
- **移行時は注意**: JSONインポート後、証憑は閲覧不可
- **推奨**: 完全バックアップにはZIPを使用

### ZIPバックアップ後のデータ安全性

```
┌─────────────────────────────────────────────────────────────┐
│ ZIPインポート完了後                                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ZIPファイル           ブラウザ（IndexedDB）                   │
│  ┌─────────────┐      ┌─────────────────────────────┐       │
│  │ data.json   │      │ 仕訳データ ✓                  │      │
│  │ evidences/  │ ──▶  │ 証憑Blob ✓                   │      │
│  │  ├─ a.pdf   │      │                             │      │
│  │  └─ b.pdf   │      │ ※完全に独立したコピー          │      │
│  └─────────────┘      └─────────────────────────────┘      │
│        ↓                                                    │
│   削除可能 ✓                                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

- インポート後、データはブラウザ内に完全保存
- 元のZIPファイルは削除しても問題なし
- 再バックアップは「ZIPバックアップ」で新規作成

### ストレージ容量

| モード     | 容量制限                    | 対策                         |
| ---------- | --------------------------- | ---------------------------- |
| indexeddb  | ブラウザ依存（通常 数GB〜） | 古い年度をエクスポート後削除 |
| filesystem | ディスク容量次第            | 特に制限なし                 |
