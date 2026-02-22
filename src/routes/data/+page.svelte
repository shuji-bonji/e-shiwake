<script lang="ts">
	import BusinessInfoCard from '$lib/components/data/BusinessInfoCard.svelte';
	import CapacityCard from '$lib/components/data/CapacityCard.svelte';
	import ExportCard from '$lib/components/data/ExportCard.svelte';
	import ImportCard from '$lib/components/data/ImportCard.svelte';
	import StorageSettingsCard from '$lib/components/data/StorageSettingsCard.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import {
		getAutoPurgeBlobSetting,
		getAvailableYears,
		getBlobRetentionDays,
		getStorageMode,
		getUnexportedAttachmentCount,
		initializeDatabase,
		seedTestData2024
	} from '$lib/db';
	import { setAvailableYears } from '$lib/stores/fiscalYear.svelte.js';
	import type { StorageType, StorageUsage } from '$lib/types';
	import {
		getDirectoryDisplayName,
		getSavedDirectoryHandle,
		supportsFileSystemAccess
	} from '$lib/utils/filesystem';
	import { getStorageUsage } from '$lib/utils/storage';
	import { Settings } from '@lucide/svelte';
	import { onMount } from 'svelte';

	// === 共有状態 ===
	let storageMode = $state<StorageType>('indexeddb');
	let directoryHandle = $state<FileSystemDirectoryHandle | null>(null);
	let directoryName = $state<string | null>(null);
	let isFileSystemSupported = $state(false);
	let availableYears = $state<number[]>([]);
	let isLoading = $state(true);
	let unexportedCount = $state(0);
	let storageUsage = $state<StorageUsage>({ used: 0, quota: 0, percentage: 0 });
	let autoPurgeEnabled = $state(true);
	let retentionDays = $state(30);

	// === 開発用ツール ===
	let isSeeding = $state(false);
	let seedResult = $state<string | null>(null);

	// 初期化
	onMount(async () => {
		await initializeDatabase();

		isFileSystemSupported = supportsFileSystemAccess();

		storageMode = await getStorageMode();

		if (isFileSystemSupported) {
			directoryHandle = await getSavedDirectoryHandle();
			if (directoryHandle) {
				directoryName = getDirectoryDisplayName(directoryHandle);
			}
		}

		unexportedCount = await getUnexportedAttachmentCount();
		storageUsage = await getStorageUsage();
		autoPurgeEnabled = await getAutoPurgeBlobSetting();
		retentionDays = await getBlobRetentionDays();
		availableYears = await getAvailableYears();

		isLoading = false;
	});

	// === コールバック ===
	function handleYearsChange(years: number[]) {
		availableYears = years;
	}

	function handleUnexportedCountChange(count: number) {
		unexportedCount = count;
	}

	function handleStorageModeChange(mode: StorageType) {
		storageMode = mode;
	}

	function handleDirectoryChange(handle: FileSystemDirectoryHandle | null, name: string | null) {
		directoryHandle = handle;
		directoryName = name;
	}

	async function handleStorageUsageChange() {
		storageUsage = await getStorageUsage();
	}

	// === 開発用ツール ===
	async function handleSeedData() {
		isSeeding = true;
		seedResult = null;
		try {
			await initializeDatabase();
			const count = await seedTestData2024();
			seedResult = `${count}件の仕訳を追加しました`;
			const years = await getAvailableYears();
			setAvailableYears(years);
			availableYears = years;
		} catch (error) {
			seedResult = `エラー: ${error instanceof Error ? error.message : '不明なエラー'}`;
		} finally {
			isSeeding = false;
		}
	}
</script>

<div class="space-y-6">
	<div
		class="sticky top-14 z-10 -mx-4 border-b bg-background px-4 pt-4 pb-3 group-has-data-[collapsible=icon]/sidebar-wrapper:top-12"
	>
		<h1 class="flex items-center gap-2 text-2xl font-bold">
			<Settings class="size-6" />
			設定・データ管理
		</h1>
		<p class="text-sm text-muted-foreground">証憑の保存設定とデータのエクスポート・インポート</p>
	</div>

	<!-- 事業者情報 -->
	<BusinessInfoCard />

	<!-- 証憑保存先設定 + 証憑確認設定 + マイグレーションダイアログ群 -->
	<StorageSettingsCard
		bind:storageMode
		bind:directoryHandle
		bind:directoryName
		{isFileSystemSupported}
		{unexportedCount}
		onstoragemodechange={handleStorageModeChange}
		ondirectorychange={handleDirectoryChange}
		onstorageusagechange={handleStorageUsageChange}
	/>

	<!-- ストレージ使用量 + パージ + Safari ダイアログ -->
	<CapacityCard
		{storageMode}
		{isFileSystemSupported}
		bind:storageUsage
		bind:autoPurgeEnabled
		{retentionDays}
	/>

	<!-- エクスポート + 年度削除ダイアログ -->
	<ExportCard
		{availableYears}
		{isLoading}
		{storageMode}
		{directoryHandle}
		bind:unexportedCount
		{autoPurgeEnabled}
		{retentionDays}
		onyearschange={handleYearsChange}
		onunexportedcountchange={handleUnexportedCountChange}
	/>

	<!-- インポート -->
	<ImportCard {storageMode} {directoryHandle} onyearschange={handleYearsChange} />

	<!-- データ形式について -->
	<Card.Root>
		<Card.Header>
			<Card.Title class="text-base">データ形式について</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-3 text-sm text-muted-foreground">
			<div>
				<p class="font-medium text-foreground">JSON</p>
				<p>
					仕訳・勘定科目・取引先・設定を含む完全なデータ。バックアップや他端末への移行に使用します。
				</p>
			</div>
			<div>
				<p class="font-medium text-foreground">CSV</p>
				<p>仕訳データのみをフラット形式で出力。Excel等での確認や他ソフトへの連携に使用します。</p>
			</div>
			<div>
				<p class="font-medium text-foreground">証憑ダウンロード</p>
				<p>ブラウザに保存されている証憑PDFを個別にダウンロードします（iPad向け）。</p>
			</div>
			<div>
				<p class="font-medium text-foreground">ZIP（完全バックアップ）</p>
				<p>JSON + 証憑PDFをZIPにまとめてダウンロード。年次アーカイブに最適です。</p>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- 開発用ツール -->
	<Card.Root>
		<Card.Header>
			<Card.Title>開発用ツール</Card.Title>
			<Card.Description>テスト用のデータ操作</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class="flex items-center justify-between">
				<div>
					<p class="font-medium">2024年ダミーデータ</p>
					<p class="text-sm text-muted-foreground">テスト用に2024年の仕訳データ14件を追加します</p>
				</div>
				<Button onclick={handleSeedData} disabled={isSeeding}>
					{isSeeding ? '追加中...' : 'データを追加'}
				</Button>
			</div>
			{#if seedResult}
				<p class="text-sm text-muted-foreground">{seedResult}</p>
			{/if}
		</Card.Content>
	</Card.Root>

	<p class="text-sm text-muted-foreground">
		電子帳簿保存法により、証憑は7年間の保存が必要です。定期的にバックアップを行ってください。
	</p>
</div>
