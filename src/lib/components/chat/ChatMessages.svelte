<script lang="ts">
	import ChatMarkdown from '$lib/components/chat/ChatMarkdown.svelte';
	import ToolCallCard from '$lib/components/chat/ToolCallCard.svelte';
	import { resendMessage, setDraft, useChat } from '$lib/llm/chat.svelte';
	import type { ChatMessage } from '$lib/llm/types';
	import { Bot, Copy, Loader2, Pencil, RotateCcw } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { SvelteMap } from 'svelte/reactivity';

	const chat = useChat();

	async function copyMessage(text: string) {
		try {
			await navigator.clipboard.writeText(text);
			toast.success('コピーしました');
		} catch {
			toast.error('コピーに失敗しました');
		}
	}

	/** tool_call_id → tool メッセージ本文 */
	const toolResults = $derived.by(() => {
		const map = new SvelteMap<string, string>();
		for (const m of chat.messages) {
			if (m.role === 'tool' && m.tool_call_id) {
				map.set(m.tool_call_id, m.content ?? '');
			}
		}
		return map;
	});

	/** 自動スクロール（メッセージ・状態の変化で再実行される attachment） */
	function autoscroll(el: HTMLElement) {
		void chat.messages.length;
		void chat.status;
		el.scrollTop = el.scrollHeight;
	}

	function hasContent(m: ChatMessage): boolean {
		return !!m.content && m.content.trim().length > 0;
	}
</script>

<div {@attach autoscroll} class="flex-1 space-y-3 overflow-y-auto p-3">
	{#if chat.messages.length === 0}
		<div class="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
			<Bot class="size-10" />
			<p class="text-sm">帳簿について質問したり、仕訳の起票を依頼できます。</p>
			<p class="text-xs">例: 「今月の経費トップ5は？」「サーバー代 3,300円を計上して」</p>
		</div>
	{/if}

	{#each chat.messages as message, i (i)}
		{#if message.role === 'user'}
			<div class="flex flex-col items-end gap-0.5">
				<div
					class="max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm whitespace-pre-wrap text-primary-foreground"
				>
					{message.content}
				</div>
				<!-- メッセージアクション（再実行 / コピー / 編集して再送信） -->
				<div class="flex gap-0.5 text-muted-foreground">
					<button
						type="button"
						class="rounded p-1 hover:bg-muted hover:text-foreground disabled:opacity-40"
						title="再実行"
						disabled={chat.status === 'running'}
						onclick={() => resendMessage(message.content ?? '')}
					>
						<RotateCcw class="size-3.5" />
						<span class="sr-only">再実行</span>
					</button>
					<button
						type="button"
						class="rounded p-1 hover:bg-muted hover:text-foreground"
						title="コピー"
						onclick={() => copyMessage(message.content ?? '')}
					>
						<Copy class="size-3.5" />
						<span class="sr-only">コピー</span>
					</button>
					<button
						type="button"
						class="rounded p-1 hover:bg-muted hover:text-foreground disabled:opacity-40"
						title="編集して再送信"
						disabled={chat.status === 'running'}
						onclick={() => setDraft(message.content ?? '')}
					>
						<Pencil class="size-3.5" />
						<span class="sr-only">編集して再送信</span>
					</button>
				</div>
			</div>
		{:else if message.role === 'assistant'}
			<div class="space-y-2">
				{#if hasContent(message)}
					<div class="flex justify-start">
						<div class="max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm">
							<ChatMarkdown content={message.content ?? ''} />
						</div>
					</div>
				{/if}
				{#if message.tool_calls?.length}
					<div class="space-y-1.5">
						{#each message.tool_calls as call (call.id)}
							<ToolCallCard {call} result={toolResults.get(call.id)} />
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	{/each}

	{#if chat.status === 'running'}
		<div class="flex items-center gap-2 text-sm text-muted-foreground">
			<Loader2 class="size-4 animate-spin" />
			考え中…
		</div>
	{/if}

	{#if chat.errorMessage}
		<div
			class="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm whitespace-pre-wrap text-destructive"
		>
			{chat.errorMessage}
		</div>
	{/if}
</div>
