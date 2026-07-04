<script lang="ts" module>
	import { browser } from '$app/environment';
	import DOMPurify from 'dompurify';
	import { marked } from 'marked';

	// DOMPurify は window が必要（SSR/プリレンダー時は使えない）。
	// チャットメッセージはクライアントでのみ存在するため、SSR では空文字を返す。
	if (browser) {
		// リンクは新規タブで開き、opener を渡さない（LLM 出力は信頼できない入力として扱う）
		DOMPurify.addHook('afterSanitizeAttributes', (node) => {
			if (node.tagName === 'A') {
				node.setAttribute('target', '_blank');
				node.setAttribute('rel', 'noopener noreferrer');
			}
		});
	}

	function renderMarkdown(content: string): string {
		if (!browser) return '';
		const raw = marked.parse(content, { gfm: true, breaks: true, async: false }) as string;
		return DOMPurify.sanitize(raw);
	}
</script>

<script lang="ts">
	interface Props {
		content: string;
	}

	let { content }: Props = $props();

	const html = $derived(renderMarkdown(content));
</script>

<div
	class="prose prose-sm max-w-none dark:prose-invert prose-headings:my-2 prose-p:my-1.5 prose-pre:my-2 prose-pre:whitespace-pre-wrap prose-ol:my-1.5 prose-ul:my-1.5 prose-table:my-2"
>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- marked の出力を DOMPurify でサニタイズ済み -->
	{@html html}
</div>
