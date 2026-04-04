---
paths:
  - 'src/routes/**/+page.svelte'
  - 'src/lib/components/**/*.svelte'
  - 'src/lib/utils/**/*.ts'
  - 'src/lib/db/**/*.ts'
---

# ドキュメント同期ルール

ページの機能やUIを変更・改善した場合、**必ず以下のドキュメントも更新すること**。

## 対応表

| 変更対象                            | 更新すべきファイル                                       |
| ----------------------------------- | -------------------------------------------------------- |
| `src/routes/{slug}/+page.svelte`    | `src/routes/help/{slug}/content.md` + `+page.svelte`     |
| `src/lib/components/**`             | 関連するヘルプページの `content.md` + `+page.svelte`     |
| `src/lib/utils/**`, `src/lib/db/**` | 機能に影響がある場合、関連 `content.md` + `+page.svelte` |

## 更新手順

1. **`content.md`** を更新（Single Source of Truth）
2. **`+page.svelte`** を `content.md` と同じ内容に更新
3. 機能一覧に影響がある場合 → **`src/routes/llms.txt/+server.ts`** も更新

## 注意

- `content.md` と `+page.svelte` は必ずセットで更新する（片方だけ更新しない）
- 機能仕様の詳細は `content.md` に書く（CLAUDE.md には書かない）
