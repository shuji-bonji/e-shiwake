---
paths:
  - 'src/lib/db/**/*.ts'
  - 'src/lib/components/**/*.svelte'
---

# IndexedDB と Svelte 5 プロキシの注意

Svelte 5 の `$state` はプロキシオブジェクトを生成する。
IndexedDB に保存する際は `JSON.parse(JSON.stringify(...))` でプレーンオブジェクトに変換すること。

- `structuredClone` は Svelte プロキシで `DataCloneError` になるため使用不可
- `$state.snapshot()` だけでは不十分な場合がある（ネストされた配列・オブジェクト）
- 安全なパターン: `JSON.parse(JSON.stringify($state.snapshot(value)))`
