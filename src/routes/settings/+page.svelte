<script lang="ts">
	import BusinessInfoCard from '$lib/components/data/BusinessInfoCard.svelte';
	import CapacityCard from '$lib/components/data/CapacityCard.svelte';
	import StorageSettingsCard from '$lib/components/data/StorageSettingsCard.svelte';
	import {
		getAutoPurgeBlobSetting,
		getAvailableYears,
		getBlobRetentionDays,
		getStorageMode,
		getUnexportedAttachmentCount,
		initializeDatabase
	} from '$lib/db';
	import type { StorageType, StorageUsage } from '$lib/types';
	import {
		getDirectoryDisplayName,
		getSavedDirectoryHandle,
		supportsFileSystemAccess
	} from '$lib/utils/filesystem';
	import { getStorageUsage } from '$lib/utils/storage';
	import { Settings2 } from '@lucide/svelte';
	import { onMount } from 'svelte';

	// === 共有状態 ===
	let storageMode = $state<StorageType>('indexeddb');
	let directoryHandle = $state<FileSystemDirectoryHandle | null>(null);
	let directoryName = $state<string | null>(null);
	let isFileSystemSupported = $state(false);
	let availableYears = $state<number[]>([]);
	let unexportedCount = $state(0);
	let storageUsage = $state<StorageUsage>({ used: 0, quota: 0, percentage: 0 });
	let autoPurgeEnabled = $state(true);
	let retentionDays = $state(30);

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
	});

	// === コールバック ===
	function handleDirectoryChange(handle: FileSystemDirectoryHandle | null, name: string | null) {
		directoryHandle = handle;
		directoryName = name;
	}

	async function handleStorageUsageChange() {
		storageUsage = await getStorageUsage();
	}
</script>

<div class="space-y-6">
	<div
		class="sticky top-14 z-10 -mx-4 border-b bg-background px-4 pt-4 pb-3 group-has-data-[collapsible=icon]/sidebar-wrapper:top-12"
	>
		<h1 class="flex items-center gap-2 text-2xl font-bold">
			<Settings2 class="size-6" />
			設定
		</h1>
		<p class="text-sm text-muted-foreground">事業者情報と証憑保存の設定</p>
	</div>

	<!-- 事業者情報 -->
	<BusinessInfoCard />

	<!-- 証憑保存先設定 -->
	<StorageSettingsCard
		bind:directoryHandle
		bind:directoryName
		{isFileSystemSupported}
		{unexportedCount}
		{availableYears}
		ondirectorychange={handleDirectoryChange}
		onstorageusagechange={handleStorageUsageChange}
	/>

	<!-- ストレージ使用量 -->
	<CapacityCard
		{storageMode}
		{isFileSystemSupported}
		bind:storageUsage
		bind:autoPurgeEnabled
		{retentionDays}
		{availableYears}
		bind:unexportedCount
	/>
</div>
