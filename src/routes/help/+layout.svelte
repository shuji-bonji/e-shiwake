<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { Button } from '$lib/components/ui/button/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import {
		ArrowLeft,
		BookOpen,
		BookText,
		Scale,
		FileText,
		Receipt,
		Paperclip,
		FolderCog,
		Package,
		ClipboardList,
		Database,
		Smartphone,
		Keyboard,
		BookA,
		FileCode2
	} from '@lucide/svelte';
	import { cn } from '$lib/utils.js';
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();

	const currentPath = $derived($page.url.pathname);

	// llms.txt リンクを表示するページかどうか（/help 以外の個別ページ）
	// 末尾スラッシュを正規化してから比較
	const normalizedPath = $derived(currentPath.replace(/\/$/, ''));
	const hasLlmsTxt = $derived(
		normalizedPath !== `${base}/help` && normalizedPath.startsWith(`${base}/help/`)
	);

	// 現在のページの llms.txt URL（末尾スラッシュを除去）
	const llmsTxtUrl = $derived(`${currentPath.replace(/\/$/, '')}/llms.txt`);

	const navItems = [
		{ href: `${base}/help/getting-started`, label: 'はじめに', icon: BookOpen },
		{ href: `${base}/help/journal`, label: '仕訳入力', icon: FileText },
		{ href: `${base}/help/ledger`, label: '総勘定元帳', icon: BookText },
		{ href: `${base}/help/trial-balance`, label: '試算表', icon: Scale },
		{ href: `${base}/help/tax-category`, label: '消費税区分', icon: Receipt },
		{ href: `${base}/help/evidence`, label: '証憑管理', icon: Paperclip },
		{ href: `${base}/help/accounts`, label: '勘定科目管理', icon: FolderCog },
		{ href: `${base}/help/fixed-assets`, label: '固定資産台帳', icon: Package },
		{ href: `${base}/help/blue-return`, label: '青色申告決算書', icon: ClipboardList },
		{ href: `${base}/help/data-management`, label: '設定・データ管理', icon: Database },
		{ href: `${base}/help/pwa`, label: 'PWA・オフライン', icon: Smartphone },
		{ href: `${base}/help/shortcuts`, label: 'ショートカット', icon: Keyboard },
		{ href: `${base}/help/glossary`, label: '用語集', icon: BookA }
	];
</script>

<div class="flex h-screen flex-col">
	<!-- ヘッダー -->
	<header class="sticky top-0 z-10 flex items-center gap-4 border-b bg-background px-4 py-3">
		<Button variant="ghost" size="icon" href="{base}/">
			<ArrowLeft class="size-5" />
		</Button>
		<span class="text-lg font-semibold">e-shiwake ヘルプ</span>
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
					<option value="{base}/help">目次</option>
					{#each navItems as item (item.href)}
						<option value={item.href}>{item.label}</option>
					{/each}
				</select>
			</div>

			<!-- コンテンツ -->
			<main class="flex-1 overflow-y-auto">
				<div class="mx-auto max-w-3xl px-6 py-8">
					{#if hasLlmsTxt}
						<div class="mb-4 flex justify-end">
							<a
								href={llmsTxtUrl}
								class="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
								title="LLM用プレーンテキスト版"
							>
								<FileCode2 class="size-3.5" />
								llms.txt
							</a>
						</div>
					{/if}
					{@render children()}
				</div>
			</main>
		</div>
	</div>
</div>
