<script lang="ts">
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Info } from '@lucide/svelte';
	import { onMount } from 'svelte';

	let isMobile = $state(false);

	onMount(() => {
		const checkMobile = () => {
			isMobile = window.matchMedia('(max-width: 768px)').matches;
		};
		checkMobile();
		window.addEventListener('resize', checkMobile);
		return () => window.removeEventListener('resize', checkMobile);
	});
</script>

{#snippet helpContent()}
	<div class="space-y-3 text-sm">
		<p class="font-medium">検索のヒント</p>
		<p class="text-muted-foreground">全年度からAND検索（スペース区切り）</p>

		<div class="space-y-2">
			<div class="flex items-center gap-2">
				<span class="w-5 text-center text-muted-foreground">T</span>
				<span class="flex-1">摘要・取引先</span>
				<code class="rounded bg-muted px-1.5 py-0.5 text-xs">家賃</code>
			</div>
			<div class="flex items-center gap-2">
				<span class="w-5 text-center text-muted-foreground">K</span>
				<span class="flex-1">勘定科目</span>
				<code class="rounded bg-muted px-1.5 py-0.5 text-xs">消耗品費</code>
			</div>
			<div class="flex items-center gap-2">
				<span class="w-5 text-center text-muted-foreground">$</span>
				<span class="flex-1">金額</span>
				<code class="rounded bg-muted px-1.5 py-0.5 text-xs">10000</code>
			</div>
			<div class="flex items-center gap-2">
				<span class="w-5 text-center text-muted-foreground">D</span>
				<span class="flex-1">年月</span>
				<code class="rounded bg-muted px-1.5 py-0.5 text-xs">2025-01</code>
			</div>
			<div class="flex items-center gap-2">
				<span class="w-5 text-center text-muted-foreground">D</span>
				<span class="flex-1">月のみ</span>
				<code class="rounded bg-muted px-1.5 py-0.5 text-xs">12月</code>
			</div>
			<div class="flex items-center gap-2">
				<span class="w-5 text-center text-muted-foreground">D</span>
				<span class="flex-1">日付</span>
				<code class="rounded bg-muted px-1.5 py-0.5 text-xs">2025-01-15</code>
			</div>
			<div class="flex items-center gap-2">
				<span class="w-5 text-center text-muted-foreground">D</span>
				<span class="flex-1">月日</span>
				<code class="rounded bg-muted px-1.5 py-0.5 text-xs">10/13</code>
			</div>
		</div>

		<div class="border-t pt-2">
			<p class="text-muted-foreground">例:</p>
			<div class="mt-1 space-y-1">
				<p><code class="rounded bg-muted px-1.5 py-0.5 text-xs">Amazon 12月</code></p>
				<p><code class="rounded bg-muted px-1.5 py-0.5 text-xs">消耗品費 10000</code></p>
			</div>
		</div>
	</div>
{/snippet}

{#if isMobile}
	<!-- モバイル: Popover（タップで表示） -->
	<Popover.Root>
		<Popover.Trigger>
			{#snippet child({ props })}
				<Button variant="ghost" size="icon" class="size-8" {...props}>
					<Info class="size-4" />
					<span class="sr-only">検索ヘルプ</span>
				</Button>
			{/snippet}
		</Popover.Trigger>
		<Popover.Content class="w-72" align="end">
			{@render helpContent()}
		</Popover.Content>
	</Popover.Root>
{:else}
	<!-- PC: Popover（クリックで表示） -->
	<Popover.Root>
		<Popover.Trigger>
			{#snippet child({ props })}
				<Button variant="ghost" size="icon" class="size-8" {...props}>
					<Info class="size-4" />
					<span class="sr-only">検索ヘルプ</span>
				</Button>
			{/snippet}
		</Popover.Trigger>
		<Popover.Content class="w-72" side="bottom" align="end">
			{@render helpContent()}
		</Popover.Content>
	</Popover.Root>
{/if}
