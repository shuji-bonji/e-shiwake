<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Progress } from '$lib/components/ui/progress/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import {
		getFilesystemAttachmentCount,
		getSuppressRenameConfirm,
		migrateAttachmentToNewFolder,
		getAttachmentsForFolderMigration,
		setSuppressRenameConfirm,
		getStorageModeByYear,
		setStorageModeForYear
	} from '$lib/db';
	import { useMigrationStore } from '$lib/stores/migration.svelte.js';
	import type { StorageType } from '$lib/types';
	import {
		clearDirectoryHandle,
		getDirectoryDisplayName,
		pickDirectory,
		saveDirectoryHandle
	} from '$lib/utils/filesystem';
	import { AlertTriangle, FileCheck, Folder, FolderOpen, HardDrive, Loader2 } from '@lucide/svelte';
	import { onMount } from 'svelte';

	interface Props {
		directoryHandle: FileSystemDirectoryHandle | null;
		directoryName: string | null;
		isFileSystemSupported: boolean;
		unexportedCount: number;
		availableYears: number[];
		ondirectorychange: (handle: FileSystemDirectoryHandle | null, name: string | null) => void;
		onstorageusagechange: () => void;
	}

	let {
		directoryHandle = $bindable(),
		directoryName = $bindable(),
		isFileSystemSupported,
		unexportedCount,
		availableYears,
		ondirectorychange,
		onstorageusagechange
	}: Props = $props();

	// === 年度別ストレージモード ===
	let storageModeByYear = $state<Record<string, StorageType>>({});

	$effect(() => {
		// availableYears が変わったら年度別モードを再取得
		if (availableYears.length > 0) {
			getStorageModeByYear().then((modes) => {
				storageModeByYear = modes;
			});
		}
	});

	function getEffectiveMode(year: number): StorageType {
		const yearMode = storageModeByYear[String(year)];
		if (yearMode === 'filesystem' || yearMode === 'indexeddb') {
			return yearMode;
		}
		// デフォルト: File System Access API対応なら filesystem、非対応なら indexeddb
		return isFileSystemSupported ? 'filesystem' : 'indexeddb';
	}

	// いずれかの年度がfilesystemを使用しているか
	const hasFilesystemYear = $derived(
		availableYears.some((year) => getEffectiveMode(year) === 'filesystem')
	);

	// フォルダ未設定警告: filesystemの年度があるのにハンドルがない
	const isDirectoryMissing = $derived(
		hasFilesystemYear && isFileSystemSupported && !directoryHandle
	);

	// === マイグレーション ===
	const migration = useMigrationStore();
	let migrationDialogOpen = $state(false);
	let pendingMigrationYear = $state<number | null>(null);
	let pendingMigrationMode = $state<StorageType | null>(null);
	let migrationTargetCount = $state(0);

	async function handleYearStorageModeChange(year: number, mode: StorageType) {
		if (mode === 'filesystem' && !directoryHandle) {
			// フォルダ未選択の場合は選択を促す
			const handle = await pickDirectory();
			if (!handle) return;
			directoryHandle = handle;
			directoryName = getDirectoryDisplayName(handle);
			await saveDirectoryHandle(handle);
			ondirectorychange(handle, directoryName);
		}

		// マイグレーション対象があるか確認
		const targetCount = await migration.getTargetCount(mode, year);
		if (targetCount > 0) {
			migration.reset();
			pendingMigrationYear = year;
			pendingMigrationMode = mode;
			migrationTargetCount = targetCount;
			migrationDialogOpen = true;
			return;
		}

		// 対象がなければ設定だけ変更
		await setStorageModeForYear(year, mode);
		storageModeByYear = { ...storageModeByYear, [String(year)]: mode };
	}

	async function handleStartMigration() {
		if (!pendingMigrationMode || pendingMigrationYear === null || !directoryHandle) return;

		const success = await migration.startMigration(
			pendingMigrationMode,
			directoryHandle,
			pendingMigrationYear
		);

		if (success) {
			storageModeByYear = {
				...storageModeByYear,
				[String(pendingMigrationYear)]: pendingMigrationMode
			};
			migrationDialogOpen = false;
			pendingMigrationYear = null;
			pendingMigrationMode = null;
			migrationTargetCount = 0;
			onstorageusagechange();
		}
	}

	function handleCancelMigration() {
		migration.cancel();
		migration.reset();
		migrationDialogOpen = false;
		pendingMigrationYear = null;
		pendingMigrationMode = null;
		migrationTargetCount = 0;
	}

	function handleCloseMigrationDialog() {
		if (migration.isRunning) return;
		migration.reset();
		migrationDialogOpen = false;
		pendingMigrationYear = null;
		pendingMigrationMode = null;
		migrationTargetCount = 0;
	}

	// === フォルダクリア確認 ===
	let clearDirectoryDialogOpen = $state(false);
	let clearDirectoryAttachmentCount = $state(0);

	// === フォルダ変更時のPDF移行 ===
	let folderMigrationDialogOpen = $state(false);
	let oldDirectoryHandle = $state<FileSystemDirectoryHandle | null>(null);
	let newDirectoryHandle = $state<FileSystemDirectoryHandle | null>(null);
	let folderMigrationCount = $state(0);
	let isFolderMigrating = $state(false);
	let folderMigrationProgress = $state(0);
	let folderMigrationError = $state<string | null>(null);

	// === 証憑確認設定 ===
	let suppressRenameConfirm = $state(false);

	onMount(async () => {
		suppressRenameConfirm = await getSuppressRenameConfirm();
	});

	// === フォルダ関連 ===
	async function handleSelectDirectory() {
		const handle = await pickDirectory();
		if (!handle) return;

		if (directoryHandle && hasFilesystemYear) {
			const count = await getFilesystemAttachmentCount();
			if (count > 0) {
				oldDirectoryHandle = directoryHandle;
				newDirectoryHandle = handle;
				folderMigrationCount = count;
				folderMigrationDialogOpen = true;
				return;
			}
		}

		directoryHandle = handle;
		directoryName = getDirectoryDisplayName(handle);
		await saveDirectoryHandle(handle);
		ondirectorychange(handle, directoryName);
	}

	async function handleClearDirectory() {
		const count = await getFilesystemAttachmentCount();
		if (count > 0) {
			clearDirectoryAttachmentCount = count;
			clearDirectoryDialogOpen = true;
			return;
		}

		await performClearDirectory();
	}

	async function performClearDirectory() {
		await clearDirectoryHandle();
		directoryHandle = null;
		directoryName = null;
		ondirectorychange(null, null);
	}

	function handleCancelClearDirectory() {
		clearDirectoryDialogOpen = false;
		clearDirectoryAttachmentCount = 0;
	}

	async function handleConfirmClearDirectory() {
		clearDirectoryDialogOpen = false;
		clearDirectoryAttachmentCount = 0;
		await performClearDirectory();
	}

	// === フォルダ変更時のPDF移行 ===
	async function handleStartFolderMigration() {
		if (!oldDirectoryHandle || !newDirectoryHandle) return;

		isFolderMigrating = true;
		folderMigrationProgress = 0;
		folderMigrationError = null;

		try {
			const items = await getAttachmentsForFolderMigration();
			const total = items.length;

			for (let i = 0; i < items.length; i++) {
				await migrateAttachmentToNewFolder(items[i], oldDirectoryHandle, newDirectoryHandle);
				folderMigrationProgress = (i + 1) / total;
			}

			directoryHandle = newDirectoryHandle;
			directoryName = getDirectoryDisplayName(newDirectoryHandle);
			await saveDirectoryHandle(newDirectoryHandle);
			ondirectorychange(newDirectoryHandle, directoryName);

			folderMigrationDialogOpen = false;
			oldDirectoryHandle = null;
			newDirectoryHandle = null;
			folderMigrationCount = 0;
			onstorageusagechange();
		} catch (err) {
			folderMigrationError = err instanceof Error ? err.message : '不明なエラー';
		} finally {
			isFolderMigrating = false;
		}
	}

	function handleCancelFolderMigration() {
		folderMigrationDialogOpen = false;
		oldDirectoryHandle = null;
		newDirectoryHandle = null;
		folderMigrationCount = 0;
		folderMigrationProgress = 0;
		folderMigrationError = null;
	}

	// === 証憑確認設定関連 ===
	async function handleSuppressRenameConfirmChange(suppress: boolean) {
		suppressRenameConfirm = suppress;
		await setSuppressRenameConfirm(suppress);
	}
</script>

<!-- 証憑保存先設定 -->
<Card.Root>
	<Card.Header>
		<Card.Title>証憑（PDF）の保存先</Card.Title>
		<Card.Description>
			年度ごとに証憑PDFの保存先を設定できます。リストア時に選択した保存先もここに反映されます。
		</Card.Description>
	</Card.Header>
	<Card.Content class="space-y-6">
		<!-- フォルダ選択セクション（File System Access API対応時のみ） -->
		{#if isFileSystemSupported}
			<div class="rounded-lg border p-4">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-3">
						{#if directoryHandle}
							<FolderOpen class="size-5 text-green-500" />
							<div>
								<p class="font-medium">{directoryName}</p>
								<p class="text-sm text-muted-foreground">ローカル保存先フォルダ</p>
							</div>
						{:else}
							<Folder class="size-5 text-muted-foreground" />
							<div>
								<p class="font-medium text-muted-foreground">未設定</p>
								<p class="text-sm text-muted-foreground">
									「ローカル」保存を使うにはフォルダを選択してください
								</p>
							</div>
						{/if}
					</div>
					<div class="flex gap-2">
						<Button variant="outline" onclick={handleSelectDirectory}>
							{directoryHandle ? '変更' : '選択'}
						</Button>
						{#if directoryHandle}
							<Button variant="ghost" onclick={handleClearDirectory}>クリア</Button>
						{/if}
					</div>
				</div>
			</div>

			{#if isDirectoryMissing}
				<div
					class="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950"
				>
					<AlertTriangle class="size-5 shrink-0 text-amber-500" />
					<div>
						<p class="font-medium text-amber-800 dark:text-amber-200">
							ローカルフォルダが未設定です
						</p>
						<p class="text-sm text-amber-700 dark:text-amber-300">
							「ローカル」保存の年度がありますが、フォルダが指定されていません。フォルダを選択するか、該当年度を「ブラウザ」に切り替えてください。
						</p>
					</div>
				</div>
			{/if}
		{:else}
			<div class="rounded-lg border p-4">
				<div class="flex items-start gap-3">
					<Folder class="size-5 text-muted-foreground" />
					<div>
						<p class="font-medium">ブラウザに保存</p>
						<p class="text-sm text-muted-foreground">
							このブラウザではローカルフォルダへの保存に対応していないため、すべての証憑はブラウザ内に保存されます。
						</p>
					</div>
				</div>
			</div>
		{/if}

		{#if unexportedCount > 0}
			<div
				class="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950"
			>
				<AlertTriangle class="size-5 shrink-0 text-amber-500" />
				<div>
					<p class="font-medium text-amber-800 dark:text-amber-200">
						{unexportedCount}件の証憑が未エクスポートです
					</p>
					<p class="text-sm text-amber-700 dark:text-amber-300">
						ブラウザのデータは予期せず消える可能性があります。定期的にバックアップしてください。
					</p>
				</div>
			</div>
		{/if}

		<!-- 年度別の保存先一覧 -->
		{#if availableYears.length > 0}
			<div class="space-y-3">
				{#each availableYears as year (year)}
					{@const effectiveMode = getEffectiveMode(year)}
					<div class="flex items-center justify-between rounded-lg border p-3">
						<div class="flex items-center gap-3">
							<span class="font-medium">{year}年度</span>
							{#if effectiveMode === 'filesystem'}
								<span class="flex items-center gap-1 text-sm text-green-600">
									<FolderOpen class="size-3.5" />
									ローカルフォルダ
								</span>
							{:else}
								<span class="flex items-center gap-1 text-sm text-blue-600">
									<HardDrive class="size-3.5" />
									ブラウザ内
								</span>
							{/if}
						</div>
						{#if isFileSystemSupported}
							<div class="flex gap-1">
								<Button
									variant={effectiveMode === 'filesystem' ? 'default' : 'outline'}
									size="sm"
									class="h-7 text-xs"
									onclick={() => handleYearStorageModeChange(year, 'filesystem')}
									disabled={effectiveMode === 'filesystem'}
								>
									ローカル
								</Button>
								<Button
									variant={effectiveMode === 'indexeddb' ? 'default' : 'outline'}
									size="sm"
									class="h-7 text-xs"
									onclick={() => handleYearStorageModeChange(year, 'indexeddb')}
									disabled={effectiveMode === 'indexeddb'}
								>
									ブラウザ
								</Button>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{:else}
			<p class="text-sm text-muted-foreground">
				仕訳データがまだありません。仕訳を登録すると年度別の保存先が表示されます。
			</p>
		{/if}
	</Card.Content>
</Card.Root>

<!-- 証憑確認設定 -->
<Card.Root>
	<Card.Header>
		<Card.Title class="flex items-center gap-2">
			<FileCheck class="size-5" />
			証憑の確認設定
		</Card.Title>
		<Card.Description>証憑ファイルのリネーム確認に関する設定です</Card.Description>
	</Card.Header>
	<Card.Content class="space-y-4">
		<div class="flex items-center justify-between rounded-lg border p-4">
			<div class="space-y-0.5">
				<Label for="suppress-rename" class="font-medium">
					仕訳変更時のリネーム確認を表示しない
				</Label>
				<p class="text-sm text-muted-foreground">
					日付・摘要・金額・取引先の変更時に、証憑ファイル名の自動変更を確認せず即実行します
				</p>
			</div>
			<Switch
				id="suppress-rename"
				checked={suppressRenameConfirm}
				onCheckedChange={handleSuppressRenameConfirmChange}
			/>
		</div>
	</Card.Content>
</Card.Root>

<!-- フォルダ移行ダイアログ -->
<AlertDialog.Root bind:open={folderMigrationDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title class="flex items-center gap-2">
				{#if isFolderMigrating}
					<Loader2 class="size-5 animate-spin" />
				{:else}
					<Folder class="size-5" />
				{/if}
				証憑PDFの移行
			</AlertDialog.Title>
			<AlertDialog.Description class="space-y-3">
				{#if !isFolderMigrating && !folderMigrationError}
					<p>
						既存のPDFファイル（<strong>{folderMigrationCount}件</strong
						>）を新しいフォルダに移動しますか？
					</p>
					<p class="text-sm text-muted-foreground">
						移行しない場合、証憑PDFへのアクセスができなくなります。
					</p>
				{:else if isFolderMigrating}
					<p>PDFファイルを移行中です。しばらくお待ちください...</p>
				{:else if folderMigrationError}
					<p class="text-destructive">移行中にエラーが発生しました: {folderMigrationError}</p>
				{/if}
			</AlertDialog.Description>
		</AlertDialog.Header>

		{#if isFolderMigrating || folderMigrationProgress > 0}
			<div class="space-y-4 py-4">
				<Progress value={folderMigrationProgress * 100} class="w-full" />
				<p class="text-center text-sm text-muted-foreground">
					{Math.round(folderMigrationProgress * 100)}% 完了
				</p>
			</div>
		{/if}

		<AlertDialog.Footer>
			{#if !isFolderMigrating && folderMigrationProgress === 0}
				<AlertDialog.Cancel onclick={handleCancelFolderMigration}>
					キャンセル（フォルダ変更を中止）
				</AlertDialog.Cancel>
				<Button onclick={handleStartFolderMigration}>移行を開始</Button>
			{:else if isFolderMigrating}
				<Button variant="outline" disabled>移行中...</Button>
			{:else}
				<Button onclick={handleCancelFolderMigration}>閉じる</Button>
			{/if}
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<!-- フォルダクリア確認ダイアログ -->
<AlertDialog.Root bind:open={clearDirectoryDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title class="flex items-center gap-2">
				<AlertTriangle class="size-5 text-amber-500" />
				フォルダ設定の解除
			</AlertDialog.Title>
			<AlertDialog.Description class="space-y-3">
				<p>
					ローカルフォルダに保存されている証憑が<strong>{clearDirectoryAttachmentCount}件</strong
					>あります。
				</p>
				<p class="text-sm text-muted-foreground">
					フォルダ設定を解除すると、これらの証憑PDFへのリンクが切れ、アプリから参照できなくなります。証憑ファイル自体はフォルダに残りますが、仕訳との紐付けが失われます。
				</p>
				<p class="text-sm text-muted-foreground">
					続行する場合は、事前にZIPエクスポートでバックアップすることを推奨します。
				</p>
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel onclick={handleCancelClearDirectory}>キャンセル</AlertDialog.Cancel>
			<AlertDialog.Action
				class="bg-destructive/80 text-white hover:bg-destructive/70"
				onclick={handleConfirmClearDirectory}
			>
				解除する
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<!-- 証憑マイグレーション確認ダイアログ -->
<AlertDialog.Root bind:open={migrationDialogOpen} onOpenChange={handleCloseMigrationDialog}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title class="flex items-center gap-2">
				{#if migration.isRunning}
					<Loader2 class="size-5 animate-spin" />
				{:else}
					<HardDrive class="size-5" />
				{/if}
				{pendingMigrationYear}年度の証憑データ移行
			</AlertDialog.Title>
			<AlertDialog.Description class="space-y-3">
				{#if !migration.isRunning && migration.errors.length === 0}
					<p>
						{pendingMigrationMode === 'filesystem'
							? 'ブラウザに保存されている'
							: 'ローカルフォルダに保存されている'}証憑データを移行しますか？
					</p>
					<p class="text-foreground">
						対象: <strong>{migrationTargetCount}件</strong>の添付ファイル
					</p>
					<p class="text-sm">
						{pendingMigrationMode === 'filesystem'
							? '移行すると、証憑PDFがブラウザ内からローカルフォルダに移動します。'
							: '移行すると、証憑PDFがローカルフォルダからブラウザ内に移動します。'}
					</p>
				{:else if migration.isRunning}
					<p>証憑データを移行中です。しばらくお待ちください...</p>
				{:else if migration.errors.length > 0}
					<p class="text-destructive">一部のファイルの移行に失敗しました。</p>
				{/if}
			</AlertDialog.Description>
		</AlertDialog.Header>

		{#if migration.isRunning || migration.progress > 0}
			<div class="space-y-4 py-4">
				<Progress value={migration.progress * 100} class="w-full" />
				<p class="text-center text-sm text-muted-foreground">
					{migration.completed} / {migration.total} 完了
					{#if migration.errors.length > 0}
						<span class="text-destructive">（{migration.errors.length}件のエラー）</span>
					{/if}
				</p>
			</div>
		{/if}

		{#if migration.errors.length > 0 && !migration.isRunning}
			<div
				class="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-destructive/50 bg-destructive/10 p-3"
			>
				<p class="text-sm font-medium text-destructive">エラー一覧:</p>
				{#each migration.errors as error (error.attachmentId)}
					<p class="text-xs text-destructive">
						{error.fileName}: {error.error}
					</p>
				{/each}
			</div>
		{/if}

		<AlertDialog.Footer>
			{#if !migration.isRunning && migration.progress === 0}
				<AlertDialog.Cancel onclick={handleCancelMigration}>キャンセル</AlertDialog.Cancel>
				<Button onclick={handleStartMigration}>移行を開始</Button>
			{:else if migration.isRunning}
				<Button variant="outline" onclick={handleCancelMigration}>中止</Button>
			{:else}
				<Button onclick={handleCloseMigrationDialog}>閉じる</Button>
			{/if}
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
