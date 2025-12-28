<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import favicon from '$lib/assets/favicon.svg';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { AlertTriangle } from '@lucide/svelte';
	import AppSidebar from '$lib/components/layout/AppSidebar.svelte';
	import AppHeader from '$lib/components/layout/AppHeader.svelte';
	import { getStorageMode } from '$lib/db';
	import {
		getStorageUsage,
		formatBytes,
		getRecommendedUsagePercentage,
		WARNING_THRESHOLD
	} from '$lib/utils/storage';
	import { supportsFileSystemAccess } from '$lib/utils/filesystem';
	import { initializeTheme } from '$lib/stores/theme.svelte.js';
	import { pwaInfo } from 'virtual:pwa-info';

	let { children } = $props();

	// 容量警告ダイアログの状態
	let showStorageWarning = $state(false);
	let storageUsedBytes = $state(0);

	// PWA webmanifest link
	const webManifest = $derived(pwaInfo ? pwaInfo.webManifest.linkTag : '');

	onMount(async () => {
		// テーマを初期化
		initializeTheme();

		// Service Workerを登録（本番ビルド時のみ有効）
		if (pwaInfo) {
			const { registerSW } = await import('virtual:pwa-register');
			registerSW({
				immediate: true,
				onRegistered(r) {
					console.log('SW Registered:', r);
				},
				onRegisterError(error) {
					console.error('SW registration error:', error);
				}
			});
		}
		// File System Access API対応ならチェック不要
		if (supportsFileSystemAccess()) {
			const storageMode = await getStorageMode();
			if (storageMode === 'filesystem') {
				return;
			}
		}

		// ストレージ使用量をチェック
		const usage = await getStorageUsage();
		const percentage = getRecommendedUsagePercentage(usage.used);

		if (percentage >= WARNING_THRESHOLD) {
			storageUsedBytes = usage.used;
			showStorageWarning = true;
		}
	});

	function handleOpenSettings() {
		showStorageWarning = false;
		goto('/settings');
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>e-shiwake - 電子仕訳</title>
	<!-- PWA manifest（ビルド時に挿入） -->
	{@html webManifest}
</svelte:head>

<Sidebar.Provider>
	<AppSidebar />
	<Sidebar.Inset>
		<AppHeader />
		<main class="flex-1 p-4">
			{@render children()}
		</main>
	</Sidebar.Inset>
</Sidebar.Provider>

<!-- ストレージ容量警告ダイアログ -->
<AlertDialog.Root bind:open={showStorageWarning}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title class="flex items-center gap-2">
				<AlertTriangle class="size-5 text-amber-500" />
				ストレージ使用量が多くなっています
			</AlertDialog.Title>
			<AlertDialog.Description>
				現在 {formatBytes(storageUsedBytes)} のデータが保存されています。<br /><br />
				エクスポートしてから古いデータを削除すると容量を確保できます。
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>後で</AlertDialog.Cancel>
			<AlertDialog.Action onclick={handleOpenSettings}>設定を開く</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
