<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { abortChat, clearChat, sendMessage, useChat } from '$lib/llm/chat.svelte';
	import { AlertTriangle, Eraser, Send, Square } from '@lucide/svelte';

	const chat = useChat();

	async function handleSend() {
		const text = chat.draft;
		chat.draft = '';
		await sendMessage(text);
	}

	function handleKeydown(e: KeyboardEvent) {
		// Enter で送信、Shift+Enter で改行（IME 変換中は無視）
		if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
			e.preventDefault();
			handleSend();
		}
	}
</script>

<div class="space-y-2 border-t p-3">
	{#if chat.activeProvider?.isCloud}
		<p class="flex items-center gap-1 text-xs text-amber-600">
			<AlertTriangle class="size-3.5 shrink-0" />
			クラウド LLM（{chat.activeProvider.label}）使用中 — 帳簿データが外部送信されます
		</p>
	{:else if chat.activeProvider}
		<p class="text-xs text-muted-foreground">
			{chat.activeProvider.label}（{chat.activeProvider.model}）
		</p>
	{:else}
		<p class="text-xs text-destructive">
			LLM プロバイダ未設定 — 設定ページで接続先を追加してください
		</p>
	{/if}

	<div class="flex items-end gap-2">
		<Textarea
			bind:value={chat.draft}
			onkeydown={handleKeydown}
			placeholder="帳簿への質問や操作を入力…"
			rows={2}
			class="min-h-9 flex-1 resize-none"
			disabled={chat.status === 'running'}
		/>
		{#if chat.status === 'running'}
			<Button variant="outline" size="icon" onclick={abortChat} title="中断">
				<Square class="size-4" />
				<span class="sr-only">中断</span>
			</Button>
		{:else}
			<Button size="icon" onclick={handleSend} disabled={!chat.draft.trim()} title="送信">
				<Send class="size-4" />
				<span class="sr-only">送信</span>
			</Button>
		{/if}
		<Button
			variant="ghost"
			size="icon"
			onclick={() => clearChat()}
			disabled={chat.messages.length === 0}
			title="会話をクリア"
		>
			<Eraser class="size-4" />
			<span class="sr-only">会話をクリア</span>
		</Button>
	</div>
</div>
