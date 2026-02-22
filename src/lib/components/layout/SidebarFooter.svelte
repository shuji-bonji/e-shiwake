<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { CircleHelp, BookMarked, ExternalLink, AlertTriangle } from '@lucide/svelte';
	import { base } from '$app/paths';

	interface Props {
		pathname: string;
		selectedYear: number;
		showReminder: boolean;
		unexportedCount: number;
	}

	let { pathname, selectedYear, showReminder, unexportedCount }: Props = $props();
</script>

<Sidebar.Footer class="border-t border-sidebar-border">
	<Sidebar.Menu>
		<!-- ヘルプ -->
		<Sidebar.MenuItem>
			<Sidebar.MenuButton isActive={pathname.startsWith('/help')}>
				{#snippet child({ props })}
					<a href="{base}/help" {...props}>
						<CircleHelp class="size-4" />
						<span>ヘルプ</span>
					</a>
				{/snippet}
			</Sidebar.MenuButton>
		</Sidebar.MenuItem>
		<!-- 簿記ガイド（外部リンク） -->
		<Sidebar.MenuItem>
			<Sidebar.MenuButton>
				{#snippet child({ props })}
					<a
						href="https://github.com/shuji-bonji/Note-on-bookkeeping"
						target="_blank"
						rel="noopener noreferrer"
						class="flex items-center gap-2"
						{...props}
					>
						<BookMarked class="size-4" />
						<span>簿記ガイド</span>
						<ExternalLink class="ml-auto size-3 opacity-50" />
					</a>
				{/snippet}
			</Sidebar.MenuButton>
		</Sidebar.MenuItem>
		<!-- 未エクスポートリマインダー -->
		{#if showReminder}
			<Sidebar.MenuItem>
				<Sidebar.MenuButton isActive={pathname === '/data'}>
					{#snippet child({ props })}
						<a
							href="{base}/data"
							{...props}
							class="flex items-center gap-2 text-amber-600 dark:text-amber-400"
						>
							<AlertTriangle class="size-4" />
							<span class="text-xs">未エクスポート: {unexportedCount}件</span>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		{/if}
		<Sidebar.MenuItem>
			<div class="p-2 text-xs text-muted-foreground">
				<span>選択中: {selectedYear}年度</span>
			</div>
		</Sidebar.MenuItem>
	</Sidebar.Menu>
</Sidebar.Footer>
