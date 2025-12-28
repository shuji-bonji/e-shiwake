<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { page } from '$app/state';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';

	// ページタイトルのマッピング
	const pageTitles: Record<string, string> = {
		'/': '仕訳帳',
		'/accounts': '勘定科目',
		'/settings': '設定',
		'/data': 'データ管理'
	};

	const currentTitle = $derived(pageTitles[page.url.pathname] || 'e-shiwake');
</script>

<header
	class="flex h-14 shrink-0 items-center gap-2 border-b px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12"
>
	<Sidebar.Trigger class="-ml-1" />
	<Separator orientation="vertical" class="mr-2 data-[orientation=vertical]:h-4" />
	<div class="flex flex-1 items-center gap-2">
		<span class="font-medium">{currentTitle}</span>
	</div>
	<ThemeToggle />
</header>
