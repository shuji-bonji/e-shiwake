<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import {
		ArrowLeft,
		BookOpen,
		FileText,
		Receipt,
		Paperclip,
		FolderCog,
		Database,
		Smartphone,
		Keyboard
	} from '@lucide/svelte';
	import { cn } from '$lib/utils.js';
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();

	const navItems = [
		{ href: '/help/getting-started', label: 'はじめに', icon: BookOpen },
		{ href: '/help/journal', label: '仕訳入力', icon: FileText },
		{ href: '/help/tax-category', label: '消費税区分', icon: Receipt },
		{ href: '/help/evidence', label: '証憑管理', icon: Paperclip },
		{ href: '/help/accounts', label: '勘定科目管理', icon: FolderCog },
		{ href: '/help/data-management', label: 'データ管理', icon: Database },
		{ href: '/help/pwa', label: 'PWA・オフライン', icon: Smartphone },
		{ href: '/help/shortcuts', label: 'ショートカット', icon: Keyboard }
	];

	const currentPath = $derived($page.url.pathname);
</script>

<div class="flex h-screen flex-col">
	<!-- ヘッダー -->
	<header class="sticky top-0 z-10 flex items-center gap-4 border-b bg-background px-4 py-3">
		<Button variant="ghost" size="icon" href="/">
			<ArrowLeft class="size-5" />
		</Button>
		<h1 class="text-lg font-semibold">e-shiwake ヘルプ</h1>
	</header>

	<div class="flex flex-1 overflow-hidden">
		<!-- サイドバー（PC） -->
		<aside class="hidden w-64 border-r md:block">
			<ScrollArea class="h-full">
				<nav class="space-y-1 px-2 py-4">
					{#each navItems as item (item.href)}
						<a
							href={item.href}
							class={cn(
								'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
								currentPath === item.href ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
							)}
						>
							<item.icon class="size-4" />
							{item.label}
						</a>
					{/each}
				</nav>
			</ScrollArea>
		</aside>

		<!-- メインコンテンツエリア -->
		<div class="flex flex-1 flex-col overflow-hidden">
			<!-- モバイルナビ -->
			<div class="border-b p-2 md:hidden">
				<select
					class="w-full rounded-md border bg-background px-3 py-2"
					value={currentPath}
					onchange={(e) => goto(e.currentTarget.value)}
				>
					<option value="/help">目次</option>
					{#each navItems as item (item.href)}
						<option value={item.href}>{item.label}</option>
					{/each}
				</select>
			</div>

			<!-- コンテンツ -->
			<main class="flex-1 overflow-y-auto">
				<div class="mx-auto max-w-3xl px-6 py-8">
					{@render children()}
				</div>
			</main>
		</div>
	</div>
</div>
