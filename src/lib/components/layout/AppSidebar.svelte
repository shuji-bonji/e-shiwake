<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Calendar, BookOpen, FileSpreadsheet, Settings, Download, List } from '@lucide/svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import {
		useFiscalYear,
		setSelectedYear,
		setAvailableYears
	} from '$lib/stores/fiscalYear.svelte.js';
	import { getAvailableYears, initializeDatabase } from '$lib/db';
	import { onMount } from 'svelte';

	// 年度ストア
	const fiscalYear = useFiscalYear();

	// パス比較用のヘルパー
	const pathname = $derived(page.url.pathname as string);

	// 年度リストを読み込み
	onMount(async () => {
		await initializeDatabase();
		const years = await getAvailableYears();
		setAvailableYears(years);
	});

	// 年度を選択して仕訳帳に遷移
	function handleYearSelect(year: number) {
		setSelectedYear(year);
		// 仕訳帳ページ以外にいる場合は遷移
		if (pathname !== '/') {
			goto('/');
		}
	}
</script>

<Sidebar.Root>
	<Sidebar.Header class="border-b border-sidebar-border">
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton size="lg" class="cursor-default hover:bg-transparent">
					<div
						class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"
					>
						<BookOpen class="size-4" />
					</div>
					<div class="flex flex-col gap-0.5 leading-none">
						<span class="font-semibold">e-shiwake</span>
						<span class="text-xs text-muted-foreground">電子仕訳</span>
					</div>
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Header>

	<Sidebar.Content>
		<!-- 年度セクション -->
		<Sidebar.Group>
			<Sidebar.GroupLabel>
				<Calendar class="size-4" />
				年度
			</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#each fiscalYear.availableYears as year (year)}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton
								isActive={fiscalYear.selectedYear === year}
								onclick={() => handleYearSelect(year)}
							>
								<span>{year}</span>
								{#if fiscalYear.selectedYear === year}
									<span class="ml-auto text-xs text-muted-foreground">選択中</span>
								{/if}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					{/each}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>

		<Sidebar.Separator />

		<!-- 帳簿セクション -->
		<Sidebar.Group>
			<Sidebar.GroupLabel>
				<BookOpen class="size-4" />
				帳簿
			</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton isActive={pathname === '/'}>
							{#snippet child({ props })}
								<a href="/" {...props}>
									<BookOpen class="size-4" />
									<span>仕訳帳</span>
								</a>
							{/snippet}
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>
					<!-- Phase 2 -->
					<Sidebar.MenuItem>
						<Sidebar.MenuButton class="pointer-events-none opacity-50">
							<List class="size-4" />
							<span>総勘定元帳</span>
							<span class="ml-auto text-xs">Phase 2</span>
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton class="pointer-events-none opacity-50">
							<FileSpreadsheet class="size-4" />
							<span>試算表</span>
							<span class="ml-auto text-xs">Phase 2</span>
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>

		<Sidebar.Separator />

		<!-- 管理セクション -->
		<Sidebar.Group>
			<Sidebar.GroupLabel>
				<Settings class="size-4" />
				管理
			</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton isActive={pathname === '/accounts'}>
							{#snippet child({ props })}
								<a href="/accounts" {...props}>
									<List class="size-4" />
									<span>勘定科目</span>
								</a>
							{/snippet}
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton isActive={pathname === '/settings'}>
							{#snippet child({ props })}
								<a href="/settings" {...props}>
									<Settings class="size-4" />
									<span>設定</span>
								</a>
							{/snippet}
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton isActive={pathname === '/export'}>
							{#snippet child({ props })}
								<a href="/export" {...props}>
									<Download class="size-4" />
									<span>エクスポート</span>
								</a>
							{/snippet}
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>

	<Sidebar.Footer class="border-t border-sidebar-border">
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<div class="p-2 text-xs text-muted-foreground">
					<span>選択中: {fiscalYear.selectedYear}年度</span>
				</div>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Footer>

	<Sidebar.Rail />
</Sidebar.Root>
