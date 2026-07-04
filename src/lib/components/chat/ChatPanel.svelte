<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import ApprovalDialog from '$lib/components/chat/ApprovalDialog.svelte';
	import ChatInput from '$lib/components/chat/ChatInput.svelte';
	import ChatMessages from '$lib/components/chat/ChatMessages.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import { initChat, isDesktop, toggleChatPanel, useChat } from '$lib/llm/chat.svelte';
	import { Bot, Expand } from '@lucide/svelte';
	import { onMount } from 'svelte';

	const chat = useChat();

	// /chat ページではフローティング UI を出さない
	const isChatRoute = $derived(page.route.id?.startsWith('/chat') ?? false);

	onMount(() => {
		initChat();
	});

	function openFullPage() {
		toggleChatPanel(false);
		goto(`${base}/chat`);
	}
</script>

{#if !isChatRoute}
	<!-- フローティングボタン（パネルが開いている間は非表示） -->
	{#if !chat.isPanelOpen}
		<Button
			class="fixed right-4 bottom-4 z-40 size-12 rounded-full shadow-lg print:hidden"
			size="icon"
			onclick={() => toggleChatPanel(true)}
			title="AI アシスタント"
		>
			<Bot class="size-6" />
			<span class="sr-only">AI アシスタントを開く</span>
		</Button>
	{/if}

	<!-- モバイル用オーバーレイ（Sheet）。デスクトップは ChatDock（+layout.svelte 側）が担当 -->
	{#if !isDesktop.current}
		<Sheet.Root open={chat.isPanelOpen} onOpenChange={(open) => toggleChatPanel(open)}>
			<Sheet.Content side="right" class="flex w-full flex-col gap-0 p-0 sm:max-w-md">
				<Sheet.Header class="border-b p-3">
					<div class="flex items-center justify-between pr-8">
						<Sheet.Title class="flex items-center gap-2 text-base">
							<Bot class="size-5" />
							AI アシスタント
						</Sheet.Title>
						<Button variant="ghost" size="icon" onclick={openFullPage} title="全画面で開く">
							<Expand class="size-4" />
							<span class="sr-only">全画面で開く</span>
						</Button>
					</div>
				</Sheet.Header>
				<ChatMessages />
				<ChatInput />
			</Sheet.Content>
		</Sheet.Root>
	{/if}
{/if}

<ApprovalDialog />
