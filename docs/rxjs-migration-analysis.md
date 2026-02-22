# RxJS → ネイティブ非同期処理 移行分析

## 現状

RxJS は3ファイルのみで使用。すべて同一パターン。

### 使用ファイル

| ファイル                     | 用途                       | 使用オペレーター                                    |
| ---------------------------- | -------------------------- | --------------------------------------------------- |
| `stores/migration.svelte.ts` | ストレージマイグレーション | `from`, `mergeMap`, `tap`, `catchError`, `finalize` |
| `utils/zip-export.ts`        | ZIP エクスポート           | `from`, `mergeMap`, `catchError`, `finalize`        |
| `utils/zip-import.ts`        | ZIP インポート             | `from`, `mergeMap`, `catchError`, `finalize`        |

### 共通パターン

```typescript
from(items)
	.pipe(
		mergeMap(
			(item) =>
				from(asyncWork(item)).pipe(
					catchError((err) => of(null)), // エラーでも継続
					finalize(() => {
						progress++;
					}) // 進捗更新
				),
			CONCURRENCY // 同時処理数制限（4〜5）
		),
		finalize(() => resolve()) // 全件完了
	)
	.subscribe();
```

### 利用している RxJS の機能

1. **並列度制限付き並行実行** (`mergeMap` + `CONCURRENCY`)
2. **個別エラーリカバリ** (`catchError` → `of(null)`)
3. **進捗トラッキング** (`tap` / `finalize`)
4. **キャンセル** (`subscription.unsubscribe()` - migration のみ)

## ネイティブ代替案

### ユーティリティ関数

```typescript
// $lib/utils/concurrent.ts
interface ConcurrentOptions<T> {
	concurrency: number;
	onItemComplete?: (item: T) => void;
	signal?: AbortSignal;
}

async function processConcurrently<T>(
	items: T[],
	processor: (item: T) => Promise<void>,
	options: ConcurrentOptions<T>
): Promise<void> {
	const { concurrency, onItemComplete, signal } = options;
	const executing = new Set<Promise<void>>();

	for (const item of items) {
		if (signal?.aborted) break;

		const p = processor(item)
			.catch(() => {}) // 個別エラーは processor 内で処理
			.finally(() => {
				executing.delete(p);
				onItemComplete?.(item);
			});

		executing.add(p);

		if (executing.size >= concurrency) {
			await Promise.race(executing);
		}
	}

	await Promise.all(executing);
}
```

### 移行後のコードイメージ（zip-export）

```typescript
// Before (RxJS)
await new Promise<void>((resolve) => {
  from(attachments).pipe(
    mergeMap(({ journalId, attachment }) =>
      from(processAttachment(journalId, attachment)).pipe(
        catchError((error) => { recordFailure(...); return of(null); }),
        finalize(() => { completed++; onProgress?.(...); })
      ),
      CONCURRENCY
    ),
    finalize(() => resolve())
  ).subscribe();
});

// After (Native)
await processConcurrently(
  attachments,
  async ({ journalId, attachment }) => {
    try {
      await processAttachment(journalId, attachment);
    } catch (error) {
      recordFailure(journalId, attachment.generatedName, ...);
    }
  },
  {
    concurrency: CONCURRENCY,
    onItemComplete: () => { completed++; onProgress?.(...); }
  }
);
```

## 評価

### メリット

| 項目               | 詳細                                       |
| ------------------ | ------------------------------------------ |
| バンドルサイズ削減 | rxjs（minified ~40KB）を除去可能           |
| 依存関係の削減     | package.json から rxjs を削除              |
| コードの可読性     | async/await の方がチーム全体で馴染みやすい |
| デバッグ性         | スタックトレースが追いやすい               |

### デメリット

| 項目            | 詳細                                                       |
| --------------- | ---------------------------------------------------------- |
| キャンセル処理  | AbortController への書き換えが必要（migration.svelte.ts）  |
| テスト工数      | 3ファイルの動作検証が必要                                  |
| RxJS の学習価値 | shuji さんは業務で RxJS を使用中。実践コードとして価値あり |

### バンドルへの影響

```
rxjs 使用量: from, of, mergeMap, tap, catchError, finalize のみ
Tree-shaking 後の実サイズ: 推定 8〜15KB（gzip後）
```

## 結論・推奨

**優先度: 低**

- 3ファイルのみの限定的な使用で、パターンも統一されている
- 現在のコードは正しく動作しており、移行のリスクに対するリターンが小さい
- shuji さんの RxJS スキルを活かした実装として合理的
- **将来の検討ポイント**: PWA の Service Worker 連携や WebSocket 対応を行う際に、RxJS の活用範囲が広がるなら維持、そうでなければ移行を検討

### 移行する場合のステップ

1. `$lib/utils/concurrent.ts` ユーティリティを作成
2. `zip-export.ts` → `zip-import.ts` → `migration.svelte.ts` の順に移行
3. migration はキャンセル処理のテストを重点的に
4. `package.json` から `rxjs` を削除
