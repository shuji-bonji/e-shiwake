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

	function getTitle(pathname: string): string {
		if (pageTitles[pathname]) return pageTitles[pathname];
		if (pathname.startsWith('/help')) return 'ヘルプ';
		return 'e-shiwake';
	}

	const currentTitle = $derived(getTitle(page.url.pathname));
</script>

<header
	class="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12"
>
	<Sidebar.Trigger class="-ml-1" />
	<Separator orientation="vertical" class="mr-2 data-[orientation=vertical]:h-4" />
	<div class="flex flex-1 items-center gap-2">
		<span class="font-medium">{currentTitle}</span>
	</div>
	<ThemeToggle />
</header>
