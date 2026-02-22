<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Progress } from '$lib/components/ui/progress/index.js';
	import * as RadioGroup from '$lib/components/ui/radio-group/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import {
		getFilesystemAttachmentCount,
		getSuppressRenameConfirm,
		migrateAttachmentToNewFolder,
		getAttachmentsForFolderMigration,
		setStorageMode,
		setSuppressRenameConfirm
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
		storageMode: StorageType;
		directoryHandle: FileSystemDirectoryHandle | null;
		directoryName: string | null;
		isFileSystemSupported: boolean;
		unexportedCount: number;
		onstoragemodechange: (mode: StorageType) => void;
		ondirectorychange: (handle: FileSystemDirectoryHandle | null, name: string | null) => void;
		onstorageusagechange: () => void;
	}

	let {
		storageMode = $bindable(),
		directoryHandle = $bindable(),
		directoryName = $bindable(),
		isFileSystemSupported,
		unexportedCount,
		onstoragemodechange,
		ondirectorychange,
		onstorageusagechange
	}: Props = $props();

	// === マイグレーション ===
	const migration = useMigrationStore();
	let migrationDialogOpen = $state(false);
	let pendingStorageMode = $state<StorageType | null>(null);
	let migrationTargetCount = $state(0);
	let radioGroupKey = $state(0);

	// === フォルダ確認ダイアログ ===
	let folderConfirmDialogOpen = $state(false);

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

	// === 保存モード関連 ===
	async function handleStorageModeChange(mode: StorageType) {
		if (mode === storageMode) return;

		if (mode === 'filesystem') {
			if (directoryHandle) {
				pendingStorageMode = mode;
				folderConfirmDialogOpen = true;
				return;
			} else {
				const handle = await pickDirectory();
				if (!handle) {
					radioGroupKey++;
					return;
				}
				directoryHandle = handle;
				directoryName = getDirectoryDisplayName(handle);
				await saveDirectoryHandle(handle);
				ondirectorychange(handle, directoryName);
			}
		}

		const targetCount = await migration.getTargetCount(mode);

		if (targetCount > 0) {
			migration.reset();
			pendingStorageMode = mode;
			migrationTargetCount = targetCount;
			migrationDialogOpen = true;
			return;
		}

		storageMode = mode;
		await setStorageMode(mode);
		onstoragemodechange(mode);
	}

	async function handleConfirmCurrentFolder() {
		folderConfirmDialogOpen = false;

		const targetCount = await migration.getTargetCount('filesystem');

		if (targetCount > 0) {
			migration.reset();
			pendingStorageMode = 'filesystem';
			migrationTargetCount = targetCount;
			migrationDialogOpen = true;
			return;
		}

		storageMode = 'filesystem';
		await setStorageMode('filesystem');
		onstoragemodechange('filesystem');
	}

	async function handleSelectDifferentFolder() {
		folderConfirmDialogOpen = false;

		const handle = await pickDirectory();
		if (!handle) {
			radioGroupKey++;
			pendingStorageMode = null;
			return;
		}

		if (directoryHandle && handle.name !== directoryHandle.name) {
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

		const targetCount = await migration.getTargetCount('filesystem');
		if (targetCount > 0) {
			migration.reset();
			pendingStorageMode = 'filesystem';
			migrationTargetCount = targetCount;
			migrationDialogOpen = true;
			return;
		}

		storageMode = 'filesystem';
		await setStorageMode('filesystem');
		onstoragemodechange('filesystem');
	}

	function handleCancelFolderConfirm() {
		folderConfirmDialogOpen = false;
		pendingStorageMode = null;
		radioGroupKey++;
	}

	// === マイグレーション関連 ===
	async function handleStartMigration() {
		if (!pendingStorageMode || !directoryHandle) return;

		const success = await migration.startMigration(pendingStorageMode, directoryHandle);

		if (success) {
			storageMode = pendingStorageMode;
			migrationDialogOpen = false;
			pendingStorageMode = null;
			migrationTargetCount = 0;
			onstoragemodechange(storageMode);
			onstorageusagechange();
		}
	}

	function handleCancelMigration() {
		migration.cancel();
		migration.reset();
		migrationDialogOpen = false;
		pendingStorageMode = null;
		migrationTargetCount = 0;
		radioGroupKey++;
	}

	function handleCloseMigrationDialog() {
		if (migration.isRunning) return;
		migration.reset();
		migrationDialogOpen = false;
		pendingStorageMode = null;
		migrationTargetCount = 0;
		radioGroupKey++;
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

			if (storageMode !== 'filesystem') {
				const targetCount = await migration.getTargetCount('filesystem');
				if (targetCount > 0) {
					migration.reset();
					pendingStorageMode = 'filesystem';
					migrationTargetCount = targetCount;
					migrationDialogOpen = true;
				} else {
					storageMode = 'filesystem';
					await setStorageMode('filesystem');
					onstoragemodechange('filesystem');
				}
			}
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
		radioGroupKey++;
	}

	async function handleSelectDirectory() {
		const handle = await pickDirectory();
		if (!handle) return;

		if (directoryHandle && storageMode === 'filesystem') {
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

		if (storageMode !== 'filesystem') {
			storageMode = 'filesystem';
			await setStorageMode('filesystem');
			onstoragemodechange('filesystem');
		}
	}

	async function handleClearDirectory() {
		await clearDirectoryHandle();
		directoryHandle = null;
		directoryName = null;
		storageMode = 'indexeddb';
		await setStorageMode('indexeddb');
		ondirectorychange(null, null);
		onstoragemodechange('indexeddb');
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
		<Card.Description>仕訳に紐付けるPDFファイルの保存方法を選択します</Card.Description>
	</Card.Header>
	<Card.Content class="space-y-6">
		{#if isFileSystemSupported}
			{#key radioGroupKey}
				<RadioGroup.Root
					value={storageMode}
					onValueChange={(v) => handleStorageModeChange(v as StorageType)}
				>
					<div class="flex items-start space-x-3">
						<RadioGroup.Item value="filesystem" id="storage-filesystem" />
						<div class="grid gap-1.5">
							<Label for="storage-filesystem" class="font-medium">
								ローカルフォルダに保存（推奨）
							</Label>
							<p class="text-sm text-muted-foreground">
								選択したフォルダに年度別で自動保存します。バックアップが容易で、他のソフトからもアクセス可能です。
							</p>
						</div>
					</div>
					<div class="flex items-start space-x-3">
						<RadioGroup.Item value="indexeddb" id="storage-indexeddb" />
						<div class="grid gap-1.5">
							<Label for="storage-indexeddb" class="font-medium">ブラウザに保存</Label>
							<p class="text-sm text-muted-foreground">
								ブラウザのIndexedDBに保存します。定期的にエクスポートしてバックアップしてください。
							</p>
						</div>
					</div>
				</RadioGroup.Root>
			{/key}

			{#if storageMode === 'filesystem'}
				<div class="rounded-lg border p-4">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-3">
							{#if directoryHandle}
								<FolderOpen class="size-5 text-green-500" />
								<div>
									<p class="font-medium">{directoryName}</p>
									<p class="text-sm text-muted-foreground">保存先フォルダ</p>
								</div>
							{:else}
								<Folder class="size-5 text-muted-foreground" />
								<div>
									<p class="font-medium text-muted-foreground">未設定</p>
									<p class="text-sm text-muted-foreground">保存先フォルダを選択してください</p>
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
			{/if}

			{#if storageMode === 'indexeddb' && unexportedCount > 0}
				<div
					class="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950"
				>
					<AlertTriangle class="size-5 shrink-0 text-amber-500" />
					<div>
						<p class="font-medium text-amber-800 dark:text-amber-200">
							{unexportedCount}件の証憑が未エクスポートです
						</p>
						<p class="text-sm text-amber-700 dark:text-amber-300">
							ブラウザのデータは予期せず消える可能性があります。エクスポートでバックアップしてください。
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
							このブラウザではローカルフォルダへの保存に対応していません。
							PDFはブラウザ内に保存されます。
						</p>
					</div>
				</div>
			</div>

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
							iPadやiPhoneではブラウザのデータが予期せず消える可能性があります。
							定期的にバックアップしてください。
						</p>
					</div>
				</div>
			{/if}
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

<!-- マイグレーション確認ダイアログ -->
<AlertDialog.Root bind:open={migrationDialogOpen} onOpenChange={handleCloseMigrationDialog}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title class="flex items-center gap-2">
				{#if migration.isRunning}
					<Loader2 class="size-5 animate-spin" />
				{:else}
					<HardDrive class="size-5" />
				{/if}
				証憑データの移行
			</AlertDialog.Title>
			<AlertDialog.Description class="space-y-3">
				{#if !migration.isRunning && migration.errors.length === 0}
					<p>
						{pendingStorageMode === 'filesystem'
							? 'ブラウザに保存されている'
							: 'フォルダに保存されている'}証憑データを移行しますか？
					</p>
					<p class="text-foreground">
						対象: <strong>{migrationTargetCount}件</strong>の添付ファイル
					</p>
					<p class="text-sm">
						{pendingStorageMode === 'filesystem'
							? '移行すると、証憑PDFがブラウザ内からフォルダに移動します。'
							: '移行すると、証憑PDFがフォルダからブラウザ内に移動します。'}
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

<!-- フォルダ確認ダイアログ -->
<AlertDialog.Root bind:open={folderConfirmDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title class="flex items-center gap-2">
				<Folder class="size-5" />
				保存先フォルダの確認
			</AlertDialog.Title>
			<AlertDialog.Description class="space-y-3">
				<p>以下のフォルダに証憑PDFを保存します。</p>
				<div class="flex items-center gap-2 rounded-lg border p-3">
					<FolderOpen class="size-5 text-green-500" />
					<span class="font-medium">{directoryName}</span>
				</div>
			</AlertDialog.Description>
		</AlertDialog.Header>

		<AlertDialog.Footer class="flex-col gap-2 sm:flex-row">
			<AlertDialog.Cancel onclick={handleCancelFolderConfirm}>キャンセル</AlertDialog.Cancel>
			<Button variant="outline" onclick={handleSelectDifferentFolder}>別のフォルダを選択</Button>
			<Button onclick={handleConfirmCurrentFolder}>このフォルダを使用</Button>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

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
