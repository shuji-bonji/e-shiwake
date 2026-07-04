<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import type { ChatToolCall } from '$lib/llm/types';
	import { ChevronDown, ChevronRight, Wrench } from '@lucide/svelte';

	interface Props {
		call: ChatToolCall;
		/** 対応する tool メッセージの本文（未実行時は undefined） */
		result?: string;
	}

	let { call, result }: Props = $props();

	let expanded = $state(false);

	const argsPreview = $derived.by(() => {
		try {
			const parsed = JSON.parse(call.function.arguments || '{}');
			return JSON.stringify(parsed, null, 2);
		} catch {
			return call.function.arguments;
		}
	});

	const isError = $derived(result?.startsWith('エラー') || result?.startsWith('ツール実行エラー'));
</script>

<div class="rounded-md border bg-muted/30 text-xs">
	<button
		type="button"
		class="flex w-full items-center gap-2 p-2 text-left"
		onclick={() => (expanded = !expanded)}
	>
		{#if expanded}
			<ChevronDown class="size-3.5 shrink-0" />
		{:else}
			<ChevronRight class="size-3.5 shrink-0" />
		{/if}
		<Wrench class="size-3.5 shrink-0 text-muted-foreground" />
		<code class="font-mono">{call.function.name}</code>
		{#if result === undefined}
			<Badge variant="outline" class="ml-auto">実行中…</Badge>
		{:else if isError}
			<Badge variant="outline" class="ml-auto border-destructive text-destructive">エラー</Badge>
		{:else}
			<Badge variant="outline" class="ml-auto border-emerald-400 text-emerald-600">完了</Badge>
		{/if}
	</button>
	{#if expanded}
		<div class="space-y-2 border-t p-2">
			<div>
				<p class="mb-1 font-medium text-muted-foreground">引数</p>
				<pre
					class="overflow-x-auto rounded bg-muted p-2 font-mono whitespace-pre-wrap">{argsPreview}</pre>
			</div>
			{#if result !== undefined}
				<div>
					<p class="mb-1 font-medium text-muted-foreground">結果</p>
					<pre
						class="max-h-48 overflow-auto rounded bg-muted p-2 font-mono whitespace-pre-wrap">{result}</pre>
				</div>
			{/if}
		</div>
	{/if}
</div>
