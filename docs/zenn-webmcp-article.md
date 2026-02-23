---
title: "WebMCPで会計PWAにAIエージェント機能を組み込んでみた"
emoji: "🤖"
type: "tech"
topics: ["webmcp", "chrome", "sveltekit", "indexeddb", "pwa"]
published: false
---

## はじめに

Chrome 146 から実験的に導入された **WebMCP**（Web Model Context Protocol）をご存知でしょうか。

ブラウザ内の AI エージェントに対して、Web アプリが「ツール」を公開できる仕組みです。たとえば「今月の経費を教えて」と AI に聞くと、アプリ内の IndexedDB を検索して回答してくれる、そんな世界が見えてきます。

この記事では、個人開発している会計 PWA「**e-shiwake**」に WebMCP を実際に組み込んだ経験をもとに、仕組み・実装・ハマりポイントを共有します。

### 対象読者

- WebMCP に興味がある Web 開発者
- PWA やローカルファーストなアプリを作っている方
- AI エージェントとの統合に関心がある方

### 前提

- Chrome Canary 146+ が必要（2026年2月時点）
- `chrome://flags` → **WebMCP for testing** を有効にする
- Chrome 拡張機能「**Model Context Tool Inspector**」をインストール

## WebMCP とは

### MCP のブラウザ版

MCP（Model Context Protocol）は、AI エージェントが外部ツールを呼び出すためのプロトコルです。Claude Desktop や VS Code の GitHub Copilot など、デスクトップアプリではすでに広く使われています。

**WebMCP** はこれをブラウザに持ち込んだものです。`navigator.modelContext` という新しい API を通じて、Web アプリが AI エージェントにツールを公開できます。

```
┌─────────────────────────────────────────────┐
│  ブラウザ                                     │
│                                               │
│  ┌───────────┐    navigator     ┌───────────┐ │
│  │ Inspector │ ──modelContext──→│  Web App  │ │
│  │ (拡張機能)│    .registerTool │ (e-shiwake)│ │
│  │           │ ←── execute() ──│           │ │
│  └───────────┘                  └───────────┘ │
│                                    ↕           │
│                               IndexedDB       │
└─────────────────────────────────────────────┘
```

### ポイント

- **サーバー不要**: ブラウザ内で完結する。MCPサーバーを立てる必要がない
- **ローカルファーストと相性抜群**: IndexedDB のデータに AI が直接アクセスできる
- **Graceful Degradation**: WebMCP 非対応の環境では何もしない（通常利用に影響なし）

## e-shiwake の概要

e-shiwake は、フリーランス・個人事業主向けの仕訳入力 + 証憑管理 PWA です。

- **SvelteKit** + TypeScript + shadcn-svelte
- **IndexedDB**（Dexie.js）にデータ保存
- サーバーなし、ユーザー認証なし、完全ローカル
- 日本の電子帳簿保存法（電帳法）の検索要件に対応

https://github.com/shuji-bonji/e-shiwake

このアプリに「ブラウザ拡張からツールを直接実行して、仕訳を検索・作成・削除でき、帳簿も生成できる」機能を追加しました。

## 使ってみる

実装の詳細に入る前に、実際に何ができるのかを見てみましょう。

動作確認には Chrome 拡張機能「**Model Context Tool Inspector**」を使います。サイドパネルを開き、**ツールを選択 → Input Arguments に JSON を入力 → Execute** で直接実行できます。API 消費なしです。

### 参照系：仕訳を検索する

`search_journals` ツールを選択し、以下の JSON を入力：

```json
{
  "query": "Amazon"
}
```

IndexedDB を検索し、Amazon 関連の仕訳が返ってきます。

```json
{
  "count": 6,
  "query": "Amazon",
  "fiscalYear": "全年度",
  "journals": [
    {
      "date": "2026-01-15",
      "description": "USBケーブル購入",
      "vendor": "Amazon",
      "lines": [
        { "type": "debit", "accountName": "消耗品費", "amount": 3980 },
        { "type": "credit", "accountName": "普通預金", "amount": 3980 }
      ]
    }
  ]
}
```

年度と勘定科目で絞り込むことも可能です。スペース区切りで AND 検索になります。

```json
{
  "query": "消耗品費",
  "fiscalYear": 2026
}
```

### 参照系：損益計算書を生成する

`generate_profit_loss` で会計レポートも一発生成。

```json
{
  "fiscalYear": 2025
}
```

```json
{
  "fiscalYear": 2025,
  "salesRevenue": 6600000,
  "totalRevenue": 6600000,
  "operatingExpenses": 1234567,
  "grossProfit": 6600000,
  "operatingIncome": 5365433,
  "netIncome": 5365433
}
```

他にも `generate_trial_balance`（試算表）、`generate_balance_sheet`（貸借対照表）、`calculate_consumption_tax`（消費税集計）など帳簿系ツールが揃っています。

### 作成系：仕訳を登録する

`create_journal` ツールで仕訳を作成できます。

**シンプルな経費仕訳**（タクシー代を現金で支払い）：

```json
{
  "date": "2026-02-20",
  "description": "打ち合わせ移動 タクシー代",
  "vendor": "東京タクシー",
  "debitLines": [
    { "accountCode": "5005", "amount": 3200, "taxCategory": "purchase_10" }
  ],
  "creditLines": [
    { "accountCode": "1001", "amount": 3200, "taxCategory": "na" }
  ]
}
```

借方合計と貸方合計が一致しないとバリデーションエラーになります。

**複合仕訳**（売掛金の売上計上）：

```json
{
  "date": "2026-02-01",
  "description": "BIMツール開発支援 2月分",
  "vendor": "株式会社猫山",
  "debitLines": [
    { "accountCode": "1002", "amount": 550000, "taxCategory": "na" }
  ],
  "creditLines": [
    { "accountCode": "4001", "amount": 550000, "taxCategory": "sales_10" }
  ]
}
```

仕訳が作成されると、仕訳帳ページが**リロードなしで自動更新**されます（後述する CustomEvent の仕組み）。

### プロンプト入力欄（Gemini 経由）

Inspector にはプロンプト入力欄もあり、自然言語で指示を送ることもできます。内部的には Gemini 2.5 Flash が呼び出され、登録済みツールの中から適切なものを選んで実行してくれます。

ただし、Gemini 2.5 Flash の無料枠は **1日20リクエスト** と少なく、すぐに上限に達します。筆者はプロンプト入力欄でも JSON 形式で指示を送るようにしていますが、それでもリクエスト消費は避けられません。

:::message
**Tools タブでの JSON 直接実行が最も確実で API 消費もゼロ**です。開発中の動作確認には Tools タブがおすすめです。
:::

### 公開しているツール一覧

| カテゴリ | ツール名 | 機能 |
|---------|---------|------|
| 仕訳管理 | `search_journals` | 全年度横断検索（摘要・取引先・科目・金額・日付） |
| | `get_journals_by_year` | 年度別仕訳一覧 |
| | `create_journal` | 仕訳作成（複合仕訳対応） |
| | `delete_journal` | 仕訳削除 |
| マスタ参照 | `list_accounts` | 勘定科目一覧（カテゴリフィルタ） |
| | `list_vendors` | 取引先一覧（名前検索） |
| 帳簿生成 | `generate_ledger` | 総勘定元帳 |
| | `generate_trial_balance` | 試算表 |
| | `generate_profit_loss` | 損益計算書 |
| | `generate_balance_sheet` | 貸借対照表 |
| 税務 | `calculate_consumption_tax` | 消費税集計 |
| ユーティリティ | `get_available_years` | 年度一覧 |

## 実装

ここからは「どう作ったか」を見ていきます。

### ディレクトリ構成

WebMCP 関連のコードは `src/lib/webmcp/` に集約しています。

```
src/lib/webmcp/
├── index.ts      # 初期化・登録・破棄
├── tools.ts      # 12ツールの定義
├── types.ts      # 型定義（navigator.modelContext の型拡張）
├── validate.ts   # 入力バリデーションヘルパー
└── events.ts     # CustomEvent（UI自動更新用）
```

### 1. 型定義（types.ts）

まず `navigator.modelContext` の型を定義します。Chrome の実験的 API なので、TypeScript の型は自分で書く必要があります。

```typescript
// ツール定義
export interface WebMCPToolDefinition {
  name: string;
  description: string;
  inputSchema?: ToolInputSchema;
  execute: (input: Record<string, unknown>) => Promise<ToolExecutionResult>;
}

// ツール実行結果
export interface ToolExecutionResult {
  content: ContentBlock[];
}

// ツール登録結果（unregister で解除可能）
export interface ToolRegistration {
  unregister: () => void;
}

// navigator 拡張
export interface ModelContextAPI {
  registerTool: (tool: WebMCPToolDefinition) => ToolRegistration;
}

declare global {
  interface Navigator {
    modelContext?: ModelContextAPI;
  }
}
```

MCP の Tool 定義とほぼ同じ構造です。`inputSchema` は JSON Schema v7 のサブセットで、AI エージェントに引数の型と説明を伝えます。

### 2. ツール登録（index.ts）

アプリの `onMount` 時に呼び出す初期化関数です。

```typescript
import { webmcpTools } from './tools';

let registrations: ToolRegistration[] = [];

export function isWebMCPAvailable(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'modelContext' in navigator &&
    navigator.modelContext !== undefined
  );
}

export function initWebMCP(): number {
  if (!isWebMCPAvailable()) {
    console.info('[e-shiwake WebMCP] WebMCP は無効です。');
    return 0;
  }

  destroyWebMCP(); // 既存登録をクリーンアップ

  const mc = navigator.modelContext!;

  for (const tool of webmcpTools) {
    try {
      const registration = mc.registerTool(tool);
      registrations.push(registration);
    } catch (e) {
      console.error(`ツール登録失敗: ${tool.name}`, e);
    }
  }

  return registrations.length;
}

export function destroyWebMCP(): void {
  for (const reg of registrations) {
    try { reg.unregister(); } catch { /* ignore */ }
  }
  registrations = [];
}
```

`isWebMCPAvailable()` でフラグチェックしているので、Chrome Canary 以外のブラウザでは何も起きません。既存ユーザーに影響ゼロです。

### 3. ツール定義（tools.ts）

仕訳検索ツールの例を見てみましょう。

```typescript
const searchJournalsTool: WebMCPToolDefinition = {
  name: 'search_journals',
  description:
    '仕訳を全年度横断で検索する。キーワード（摘要・取引先）、' +
    '勘定科目名、金額、日付で検索可能。スペース区切りでAND検索。',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          '検索クエリ。例: "Amazon", "消耗品費", "10000", "2025-01"'
      },
      fiscalYear: {
        type: 'number',
        description: '年度を指定する場合（例: 2025）。省略時は全年度'
      }
    },
    required: ['query']
  },
  execute: async (input) => {
    const query = requireString(input, 'query');
    const fiscalYear = optionalNumber(input, 'fiscalYear');

    // IndexedDB から仕訳を取得
    let journals = fiscalYear
      ? await getJournalsByYear(fiscalYear)
      : await getAllJournals();

    const accounts = await getAllAccounts();
    const parsedQuery = parseSearchQuery(query, accounts);
    const results = filterJournals(journals, parsedQuery);

    return ok({ count: results.length, journals: results });
  }
};
```

**設計のポイント**: アプリ内で既に使っている検索ロジック（`parseSearchQuery` + `filterJournals`）をそのまま再利用しています。WebMCP 用に新しいロジックを書く必要はありません。

### 4. 入力バリデーション（validate.ts）

AI エージェントからの入力は信頼できません。軽量なバリデーションヘルパーを用意しました。

```typescript
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function requireString(input: Input, key: string): string {
  const value = input[key];
  if (value === undefined || value === null) {
    throw new ValidationError(`${key} は必須です`);
  }
  if (typeof value !== 'string') {
    throw new ValidationError(
      `${key} は文字列である必要があります（受信: ${typeof value}）`
    );
  }
  return value;
}
```

Zod のような外部ライブラリは使わず、シンプルな関数で済ませています。WebMCP のツール入力は JSON Schema で制約がかかるため、複雑なバリデーションは不要という判断です。

## ハマりポイント：IndexedDB 直接操作と UI 同期

WebMCP で一番ハマったポイントがこれです。

### 問題

WebMCP のツール（`create_journal` など）は IndexedDB を**直接操作**します。一方、Svelte の UI は `$state()` で管理されたリアクティブ状態を参照しています。

```
Inspector → create_journal → IndexedDB に保存 ✅
                                  ↓
                            Svelte の $state() は更新されない ❌
                                  ↓
                            画面に反映されない 😢
```

IndexedDB にはデータが入っているのに、画面をリロードしないと表示されない、という状態になります。

### 解決策：CustomEvent で橋渡し

WebMCP のツール実行後に `CustomEvent` を発火し、Svelte 側でリッスンする方式にしました。

**events.ts**（イベント定義）:

```typescript
export const WEBMCP_JOURNAL_CHANGE = 'webmcp:journal-change' as const;

export function dispatchJournalChange(
  action: 'create' | 'delete',
  journalId: string
): void {
  if (typeof window === 'undefined') return; // SSR/テスト環境ガード

  window.dispatchEvent(
    new CustomEvent(WEBMCP_JOURNAL_CHANGE, {
      detail: { action, journalId }
    })
  );
}
```

**tools.ts**（ツール側で発火）:

```typescript
// create_journal の execute 内
const id = await addJournal(journal);
dispatchJournalChange('create', id); // ← ここ
```

**+page.svelte**（仕訳帳ページでリッスン）:

```svelte
<script lang="ts">
  import { WEBMCP_JOURNAL_CHANGE } from '$lib/webmcp/events';

  $effect(() => {
    if (!isInitialized) return;

    const handleWebMCPChange = () => {
      refreshAvailableYears();
      loadData(fiscalYear.selectedYear);
    };
    window.addEventListener(WEBMCP_JOURNAL_CHANGE, handleWebMCPChange);

    return () => {
      window.removeEventListener(WEBMCP_JOURNAL_CHANGE, handleWebMCPChange);
    };
  });
</script>
```

これにより、Inspector からツールを実行すると、仕訳帳の画面がリアルタイムに更新されます。

### なぜ `onMount` ではなく `$effect` なのか

最初は `onMount` 内でリスナーを登録しようとしました。

```typescript
// ❌ これは動かない
onMount(async () => {
  await loadData();

  const handler = () => loadData();
  window.addEventListener(WEBMCP_JOURNAL_CHANGE, handler);

  return () => window.removeEventListener(WEBMCP_JOURNAL_CHANGE, handler);
});
```

Svelte の `onMount` は `async` にすると、クリーンアップ関数を返せません。`async` 関数の戻り値は `Promise` になるため、`return () => ...` がクリーンアップとして認識されないのです。

`$effect` は同期的にクリーンアップ関数を返せるので、イベントリスナーの管理に適しています。

### `typeof window === 'undefined'` ガード

もう一つのハマりポイント。WebMCP のテスト（Vitest）はサーバー環境で実行されるため、`window` が存在しません。

```typescript
export function dispatchJournalChange(...): void {
  if (typeof window === 'undefined') return; // ← これが必要
  // ...
}
```

このガードがないと、テスト実行時に `ReferenceError: window is not defined` で落ちます。

## 所感と今後

### WebMCP の可能性

ローカルファーストのアプリにとって、WebMCP は非常に相性が良いと感じました。

- **MCP サーバー不要**: ブラウザ内で完結する。インフラの追加コストがゼロ
- **既存ロジックの再利用**: アプリ内のユーティリティ関数をそのまま `execute` に渡せる
- **段階的導入**: `isWebMCPAvailable()` で判定するだけで、既存機能に一切影響しない

### 現時点の制約

- **Chrome 146+ 限定**（2026年2月時点）。Safari や Firefox は未対応
- `chrome://flags` で有効化が必要（一般ユーザーにはまだ届かない）
- Inspector のプロンプト入力は Gemini API に依存（無料枠 1日20リクエスト）
- 現実的には Tools タブでの JSON 直接実行がメインの使い方

### 今後やりたいこと

- `update_journal`（仕訳更新）ツールの追加
- 帳簿生成結果の Markdown フォーマット対応
- API 制限の緩和や他のブラウザ内 AI エージェント対応に期待

## まとめ

WebMCP を使うことで、ブラウザ拡張からWeb アプリのデータと機能を直接操作できます。

実装のステップは：

1. `navigator.modelContext` の型を定義する
2. ツールを `registerTool()` で登録する
3. IndexedDB 等のデータ操作は既存ロジックを再利用
4. UI 同期が必要なら `CustomEvent` で橋渡し
5. `isWebMCPAvailable()` でフィーチャーフラグ的に分離

現時点では Inspector の Tools タブで JSON を直接実行するのが現実的な使い方ですが、**サーバー不要、既存コードへの影響ゼロ**で外部からのツール実行基盤を仕込めるのは、ローカルファーストなアプリにとって大きな魅力です。

WebMCP はまだ実験段階ですが、「ブラウザの中の AI が、アプリのデータを理解して操作する」という未来に向けた一歩を踏み出せました。

---

**e-shiwake**（電子仕訳）：
https://github.com/shuji-bonji/e-shiwake

WebMCP 仕様：
https://webmachinelearning.github.io/webmcp/

Chrome ブログ（Early Preview）：
https://developer.chrome.com/blog/webmcp-epp
