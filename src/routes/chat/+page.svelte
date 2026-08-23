<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import ChatInput from '$lib/components/chat/ChatInput.svelte';
	import ChatMessages from '$lib/components/chat/ChatMessages.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { initChat, isDesktop, toggleChatPanel, useChat } from '$lib/llm/chat.svelte';
	import { Bot, PanelRight } from '@lucide/svelte';
	import { onMount } from 'svelte';

	const chat = useChat();

	onMount(() => {
		initChat();
	});

	/**
	 * 全画面表示をやめ、元のページ上のパネル表示に戻す。
	 * 全画面で開く前のパスが記録されていればそこへ、なければホームへ遷移する。
	 */
	async function backToPanel() {
		toggleChatPanel(true);
		await goto(chat.returnPath ?? `${base}/`);
	}
</script>

<svelte:head>
	<title>AI アシスタント | e-shiwake</title>
	<meta
		name="description"
		content="ローカル LLM・クラウド LLM で帳簿を自然言語で参照・操作できる AI アシスタント"
	/>
</svelte:head>

<div class="flex h-[calc(100dvh-6rem)] flex-col">
	<div class="flex items-start justify-between gap-2 border-b pb-3">
		<div>
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
		<Button
			variant="outline"
			size="sm"
			onclick={backToPanel}
			title={isDesktop.current ? 'サイドパネルに戻す' : 'パネル表示に戻す'}
		>
			<PanelRight class="size-4" />
			<span class="hidden sm:inline">
				{isDesktop.current ? 'サイドパネルに戻す' : 'パネル表示に戻す'}
			</span>
			<span class="sr-only sm:hidden">パネル表示に戻す</span>
		</Button>
	</div>

	<ChatMessages />
	<ChatInput />
</div>
