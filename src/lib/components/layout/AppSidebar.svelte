<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import {
		useFiscalYear,
		setSelectedYear,
		setAvailableYears
	} from '$lib/stores/fiscalYear.svelte.js';
	import {
		getAvailableYears,
		initializeDatabase,
		getUnexportedAttachmentCount,
		getStorageMode
	} from '$lib/db';
	import { supportsFileSystemAccess } from '$lib/utils/filesystem';
	import { onMount } from 'svelte';
	import { navGroups } from './sidebar-nav';
	import SidebarNavGroup from './SidebarNavGroup.svelte';
	import SidebarYearSelector from './SidebarYearSelector.svelte';
	import SidebarFooterComponent from './SidebarFooter.svelte';

	// 年度ストア
	const fiscalYear = useFiscalYear();

	// パス比較用のヘルパー（ベースパスを除去して比較）
	const pathname = $derived(page.url.pathname.replace(base, '') || '/');

	// 未エクスポート警告の状態
	let unexportedCount = $state(0);
	let showReminder = $state(false);

	// 年度リストを読み込み
	onMount(async () => {
		await initializeDatabase();
		const years = await getAvailableYears();
		setAvailableYears(years);

		// Safari（File System Access API非対応）の場合のみリマインダーを表示
		if (!supportsFileSystemAccess()) {
			unexportedCount = await getUnexportedAttachmentCount();
			showReminder = unexportedCount > 0;
		} else {
			// File System Access API対応でも、IndexedDBモードの場合はリマインダーを表示
			const storageMode = await getStorageMode();
			if (storageMode === 'indexeddb') {
				unexportedCount = await getUnexportedAttachmentCount();
				showReminder = unexportedCount > 0;
			}
		}
	});

	// 年度を選択して仕訳帳に遷移
	function handleYearSelect(year: number) {
		setSelectedYear(year);
		if (pathname !== '/') {
			goto(`${base}/`);
		}
	}
</script>

<Sidebar.Root>
	<Sidebar.Header class="border-b border-sidebar-border">
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton size="lg" class="cursor-default hover:bg-transparent">
					<img src="{base}/favicon.svg" alt="e-shiwake" class="size-8 rounded-lg" />
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
		<SidebarYearSelector
			availableYears={fiscalYear.availableYears}
			selectedYear={fiscalYear.selectedYear}
			onselect={handleYearSelect}
		/>

		{#each navGroups as group (group.label)}
			<Sidebar.Separator />
			<SidebarNavGroup {group} {pathname} />
		{/each}
	</Sidebar.Content>

	<SidebarFooterComponent
		{pathname}
		selectedYear={fiscalYear.selectedYear}
		{showReminder}
		{unexportedCount}
	/>

	<Sidebar.Rail />
</Sidebar.Root>
