<script lang="ts">
	import BackupCard from '$lib/components/data/BackupCard.svelte';
	import ExportCard from '$lib/components/data/ExportCard.svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import {
		getAutoPurgeBlobSetting,
		getAvailableYears,
		getBlobRetentionDays,
		getStorageMode,
		getUnexportedAttachmentCount,
		initializeDatabase
	} from '$lib/db';
	import type { StorageType } from '$lib/types';
	import { getSavedDirectoryHandle, supportsFileSystemAccess } from '$lib/utils/filesystem';
	import { Database } from '@lucide/svelte';
	import { onMount } from 'svelte';

	// === 共有状態 ===
	let storageMode = $state<StorageType>('indexeddb');
	let directoryHandle = $state<FileSystemDirectoryHandle | null>(null);
	let isFileSystemSupported = $state(false);
	let availableYears = $state<number[]>([]);
	let isLoading = $state(true);
	let unexportedCount = $state(0);
	let autoPurgeEnabled = $state(true);
	let retentionDays = $state(30);

	onMount(async () => {
		await initializeDatabase();

		isFileSystemSupported = supportsFileSystemAccess();
		storageMode = await getStorageMode();

		if (isFileSystemSupported) {
			directoryHandle = await getSavedDirectoryHandle();
		}

		unexportedCount = await getUnexportedAttachmentCount();
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
</script>

<div class="space-y-6">
	<div
		class="sticky top-14 z-10 -mx-4 border-b bg-background px-4 pt-4 pb-3 group-has-data-[collapsible=icon]/sidebar-wrapper:top-12"
	>
		<h1 class="flex items-center gap-2 text-2xl font-bold">
			<Database class="size-6" />
			データ管理
		</h1>
		<p class="text-sm text-muted-foreground">データのバックアップ・リストアとエクスポート</p>
	</div>

	<!-- バックアップ・リストア -->
	<BackupCard
		{availableYears}
		{isLoading}
		{directoryHandle}
		bind:unexportedCount
		onyearschange={handleYearsChange}
		onunexportedcountchange={handleUnexportedCountChange}
	/>

	<!-- エクスポート（CSV / JSON） -->
	<ExportCard
		{availableYears}
		{isLoading}
		{storageMode}
		{autoPurgeEnabled}
		{retentionDays}
		onyearschange={handleYearsChange}
	/>

	<!-- データ形式の違い -->
	<Card.Root>
		<Card.Header>
			<Card.Title class="text-base">データ形式の違い</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-3 text-sm text-muted-foreground">
			<div>
				<p class="font-medium text-foreground">フルバックアップ（バックアップ・リストア）</p>
				<p>
					全年度の仕訳・証憑PDF・設定を含むフルスナップショット。端末移行や事故対策に。上書き復元のみ。
				</p>
			</div>
			<div>
				<p class="font-medium text-foreground">アーカイブ（アーカイブページ）</p>
				<p>
					年度別の仕訳・証憑パッケージ。確定申告後の年度締め・データ復活に。仕訳＋証憑のみマージ復元。
				</p>
			</div>
			<div>
				<p class="font-medium text-foreground">JSONエクスポート</p>
				<p>
					仕訳・勘定科目・取引先・固定資産・請求書・事業者情報を含む（証憑PDF除く）。データの外部保存に。
				</p>
			</div>
			<div>
				<p class="font-medium text-foreground">CSVエクスポート</p>
				<p>仕訳データのみをフラット形式で出力。Excelでの確認や他の会計ソフトへの連携に。</p>
			</div>
		</Card.Content>
	</Card.Root>

	<p class="text-sm text-muted-foreground">
		電子帳簿保存法により、証憑は7年間の保存が必要です。定期的にバックアップを行ってください。
	</p>
</div>
