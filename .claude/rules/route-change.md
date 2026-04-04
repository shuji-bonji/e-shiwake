---
paths:
  - 'src/routes/**/+page.svelte'
  - 'src/routes/**/+server.ts'
  - 'svelte.config.js'
---

# ルート変更時チェックリスト

ページ（ルート）を追加・削除・変更した場合、以下も更新すること：

1. **`svelte.config.js`** — `prerender.entries` にルートを追加/削除
2. **`static/sitemap.xml`** — `<url>` エントリを追加/削除
3. **`CLAUDE.md`** — 「サイトマップ」セクションのルート一覧を更新
4. **`README.md`** — 「ページ構成」セクションのルート一覧を更新

ヘルプページの追加・削除の場合はさらに：

5. **`content.md`** + **`llms.txt/+server.ts`** を作成/削除
6. **`src/routes/llms.txt/+server.ts`** — ヘルプリンク一覧を更新
