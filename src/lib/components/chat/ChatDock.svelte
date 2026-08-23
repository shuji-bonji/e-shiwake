<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import ChatInput from '$lib/components/chat/ChatInput.svelte';
	import ChatMessages from '$lib/components/chat/ChatMessages.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { isDesktop, setChatReturnPath, toggleChatPanel, useChat } from '$lib/llm/chat.svelte';
	import { Bot, Expand, X } from '@lucide/svelte';

	const chat = useChat();

	// /chat ページではドックを出さない
	const isChatRoute = $derived(page.route.id?.startsWith('/chat') ?? false);

	function openFullPage() {
		setChatReturnPath(page.url.pathname + page.url.search);
		toggleChatPanel(false);
		goto(`${base}/chat`);
	}
</script>

<!--
	デスクトップ用ドッキングパネル。
	main の横に並び、開くと本体コンテンツが横に縮小する（オーバーレイしない）。
	これにより AI が開いた仕訳フォーム等の確定ボタンをチャットと並行して操作できる。
-->
{#if !isChatRoute && chat.isPanelOpen && isDesktop.current}
	<aside
		class="sticky top-14 z-10 flex h-[calc(100dvh-3.5rem)] w-96 shrink-0 flex-col border-l bg-background group-has-data-[collapsible=icon]/sidebar-wrapper:top-12 group-has-data-[collapsible=icon]/sidebar-wrapper:h-[calc(100dvh-3rem)] print:hidden"
		aria-label="AI アシスタント"
	>
		<div class="flex items-center justify-between border-b p-3">
			<span class="flex items-center gap-2 text-base font-medium">
				<Bot class="size-5" />
				AI アシスタント
			</span>
			<div class="flex gap-1">
				<Button variant="ghost" size="icon" onclick={openFullPage} title="全画面で開く">
					<Expand class="size-4" />
					<span class="sr-only">全画面で開く</span>
				</Button>
				<Button variant="ghost" size="icon" onclick={() => toggleChatPanel(false)} title="閉じる">
					<X class="size-4" />
					<span class="sr-only">閉じる</span>
				</Button>
			</div>
		</div>
		<ChatMessages />
		<ChatInput />
	</aside>
{/if}
