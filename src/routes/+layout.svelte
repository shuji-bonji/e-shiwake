<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import favicon from '$lib/assets/favicon.svg';
	import AppHeader from '$lib/components/layout/AppHeader.svelte';
	import AppSidebar from '$lib/components/layout/AppSidebar.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
	import { getStorageMode, migrateGlobalStorageModeToPerYear } from '$lib/db';
	import { getSetting, setSetting } from '$lib/db/settings-repository';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { initializeTheme } from '$lib/stores/theme.svelte.js';
	import { supportsFileSystemAccess } from '$lib/utils/filesystem';
	import {
		formatBytes,
		getRecommendedUsagePercentage,
		getStorageUsage,
		WARNING_THRESHOLD
	} from '$lib/utils/storage';
	import { AlertTriangle, Info } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { initWebMCP, destroyWebMCP } from '$lib/webmcp';
	import { useUICommand, clearPendingCommand } from '$lib/stores/uiCommand.svelte';
	import { toast } from 'svelte-sonner';
	import { pwaInfo } from 'virtual:pwa-info';
	import './layout.css';

	let { children } = $props();

	// UICommand ストア（WebMCP UI操作型ツールからのコマンドを受信）
	const uiCommand = useUICommand();

	// 容量警告ダイアログの状態
	let showStorageWarning = $state(false);
	let storageUsedBytes = $state(0);

	// v0.4.0 アップグレード通知ダイアログの状態
	let showUpgradeNotice = $state(false);
	let suppressUpgradeNotice = $state(false);

	/** 現在のアプリバージョン */
	const CURRENT_VERSION = __APP_VERSION__;

	// PWA更新関数を保持
	let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;

	// PWA webmanifest link
	const webManifest = $derived(pwaInfo ? pwaInfo.webManifest.linkTag : '');

	// ヘルプページかどうか（ヘルプページは個別にdescriptionを設定するため除外）
	// route.id を使用することでプリレンダリング時も正しく判定できる
	const isHelpPage = $derived($page.route.id?.startsWith('/help') ?? false);

	onMount(() => {
		// テーマを初期化
		initializeTheme();

		// v0.4.0: グローバル保存モードを年度別設定にマイグレーション（初回のみ）
		migrateGlobalStorageModeToPerYear();

		// WebMCP ツールを登録（Chrome 146+ Early Preview）
		const webmcpToolCount = initWebMCP();
		if (webmcpToolCount > 0) {
			console.info(`[e-shiwake] WebMCP: ${webmcpToolCount} ツールをAIエージェントに公開しました`);
		}

		// オフライン/オンライン検知
		function handleOnline() {
			toast.success('オンラインに復帰しました');
		}
		function handleOffline() {
			toast.warning('オフラインです', {
				description: 'データはローカルに保存されます'
			});
		}
		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);

		// 非同期処理をIIFEで実行（クリーンアップを返すため）
		(async () => {
			// v0.4.0 アップグレード通知: 既存ユーザーにバックアップ仕様変更を通知
			try {
				const dismissed = await getSetting('dismissedUpgradeNotice');
				// 未表示、かつ現行バージョン以前の通知が dismiss されていない場合のみ表示
				if (!dismissed || dismissed < CURRENT_VERSION) {
					// 新規ユーザー（データがない場合）は通知不要 → 仕訳が1件以上あれば既存ユーザー
					const { db } = await import('$lib/db/database');
					const journalCount = await db.journals.count();
					if (journalCount > 0) {
						showUpgradeNotice = true;
					} else {
						// 新規ユーザーは通知済みとしてマーク
						await setSetting('dismissedUpgradeNotice', CURRENT_VERSION);
					}
				}
			} catch (e) {
				console.warn('[layout] アップグレード通知チェックに失敗:', e);
			}

			// Service Workerを登録（本番ビルド時のみ有効）
			if (pwaInfo) {
				const { registerSW } = await import('virtual:pwa-register');
				updateSW = registerSW({
					immediate: true,
					onRegistered(r) {
						console.log('SW Registered:', r);
					},
					onRegisterError(error) {
						console.error('SW registration error:', error);
					},
					onNeedRefresh() {
						// 新しいバージョンが利用可能
						toast.info('新しいバージョンが利用可能です', {
							description: 'クリックして更新',
							duration: Infinity,
							action: {
								label: '更新',
								onClick: () => {
									updateSW?.(true);
								}
							}
						});
					},
					onOfflineReady() {
						toast.success('オフラインで使用できます', {
							description: 'アプリがキャッシュされました'
						});
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
		})();

		// クリーンアップ関数を返す（HMR時のリスナー重複を防止）
		return () => {
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOffline);
			destroyWebMCP();
		};
	});

	// WebMCP UI操作: navigate_to コマンドを処理
	$effect(() => {
		const cmd = uiCommand.pending;
		if (cmd?.type === 'navigate_to') {
			const path = cmd.data.path;
			clearPendingCommand();
			goto(`${base}${path}`);
			console.info(`[e-shiwake UICommand] ナビゲーション実行: ${path}`);
		}
	});

	function handleOpenSettings() {
		showStorageWarning = false;
		goto(`${base}/data`);
	}

	async function handleDismissUpgradeNotice() {
		showUpgradeNotice = false;
		if (suppressUpgradeNotice) {
			await setSetting('dismissedUpgradeNotice', CURRENT_VERSION);
		}
	}

	async function handleGoToBackup() {
		showUpgradeNotice = false;
		// チェックが入っていれば非表示設定を保存
		if (suppressUpgradeNotice) {
			await setSetting('dismissedUpgradeNotice', CURRENT_VERSION);
		}
		goto(`${base}/data`);
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>e-shiwake（電子仕訳）- フリーランス・個人事業主のための無料青色申告会計アプリ</title>
	<!-- ヘルプページは個別にdescriptionを設定するため、ここでは除外 -->
	{#if !isHelpPage}
		<meta
			name="description"
			content="e-shiwake（電子仕訳）- フリーランス・個人事業主向けの無料青色申告会計アプリ。複式簿記、証憑管理、決算書作成をブラウザで完結。オフライン対応PWA。"
		/>
		<meta
			property="og:description"
			content="e-shiwake（電子仕訳）- フリーランス・個人事業主向けの無料青色申告会計アプリ。複式簿記、証憑管理、決算書作成をブラウザで完結。オフライン対応PWA。"
		/>
		<meta
			name="twitter:description"
			content="e-shiwake（電子仕訳）- フリーランス・個人事業主向けの無料青色申告会計アプリ。複式簿記、証憑管理、決算書作成をブラウザで完結。オフライン対応PWA。"
		/>
	{/if}
	<meta
		property="og:title"
		content="e-shiwake（電子仕訳）- フリーランス・個人事業主のための無料青色申告会計アプリ"
	/>
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://shuji-bonji.github.io/e-shiwake/" />
	<meta property="og:image" content="https://shuji-bonji.github.io/e-shiwake/ogimage.png" />
	<meta property="og:site_name" content="e-shiwake" />
	<meta property="og:locale" content="ja_JP" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta
		name="twitter:title"
		content="e-shiwake（電子仕訳）- フリーランス・個人事業主のための無料青色申告会計アプリ"
	/>
	<meta name="twitter:image" content="https://shuji-bonji.github.io/e-shiwake/ogimage.png" />
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

<!-- v0.4.0 アップグレード通知ダイアログ -->
<AlertDialog.Root bind:open={showUpgradeNotice}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title class="flex items-center gap-2">
				<Info class="size-5 text-blue-500" />
				バックアップ機能が変わりました (v{CURRENT_VERSION})
			</AlertDialog.Title>
			<AlertDialog.Description class="space-y-3">
				<p>
					バックアップが<strong>全年度一括のフルスナップショット</strong>方式に変わりました。
				</p>
				<p>
					<strong class="text-destructive"
						>v0.3.x以前のバックアップZIPからは仕訳データのみ復元</strong
					>されます。 事業者情報・勘定科目などの設定データは復元されません。
				</p>
				<p>
					まず最初に<strong>フルバックアップ</strong
					>を作成して、設定を含む完全なバックアップを確保してください。
				</p>
			</AlertDialog.Description>
		</AlertDialog.Header>
		<div class="flex items-center gap-2 py-2">
			<Checkbox
				id="suppress-upgrade-notice"
				checked={suppressUpgradeNotice}
				onCheckedChange={(v) => (suppressUpgradeNotice = v === true)}
			/>
			<label for="suppress-upgrade-notice" class="cursor-pointer text-sm text-muted-foreground">
				以降この通知を表示しない
			</label>
		</div>
		<AlertDialog.Footer>
			<AlertDialog.Cancel onclick={handleDismissUpgradeNotice}>後で</AlertDialog.Cancel>
			<AlertDialog.Action onclick={handleGoToBackup}>データ管理へ移動する</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

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

<!-- トースト通知 -->
<Toaster richColors position="top-right" />
