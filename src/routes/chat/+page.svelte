<script lang="ts">
	import ChatInput from '$lib/components/chat/ChatInput.svelte';
	import ChatMessages from '$lib/components/chat/ChatMessages.svelte';
	import { initChat, useChat } from '$lib/llm/chat.svelte';
	import { Bot } from '@lucide/svelte';
	import { onMount } from 'svelte';

	const chat = useChat();

	onMount(() => {
		initChat();
	});
</script>

<svelte:head>
	<title>AI アシスタント | e-shiwake</title>
	<meta
		name="description"
		content="ローカル LLM・クラウド LLM で帳簿を自然言語で参照・操作できる AI アシスタント"
	/>
</svelte:head>

<div class="flex h-[calc(100dvh-6rem)] flex-col">
	<div class="border-b pb-3">
		<h1 class="flex items-center gap-2 text-2xl font-bold">
			<Bot class="size-6" />
			AI アシスタント
		</h1>
		<p class="text-sm text-muted-foreground">
			{#if chat.activeProvider}
				接続先: {chat.activeProvider.label}（{chat.activeProvider.model}）
			{:else}
				帳簿データを自然言語で参照・操作できます
			{/if}
		</p>
	</div>

	<ChatMessages />
	<ChatInput />
</div>
