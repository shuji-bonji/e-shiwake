<script lang="ts">
	import SafariStorageDialog from '$lib/components/SafariStorageDialog.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import type { Attachment, DocumentType, JournalEntry, Vendor } from '$lib/types';
	import AttachmentDialog from './AttachmentDialog.svelte';
	import AttachmentEditDialog from './AttachmentEditDialog.svelte';

	interface RenameInfo {
		oldNames: string[];
		newNames: string[];
		syncArgs: {
			journal: JournalEntry;
			mainDebitAmount: number;
			directoryHandle?: FileSystemDirectoryHandle | null;
		};
	}

	interface Props {
		journal: JournalEntry;
		vendors: Vendor[];
		// Safari警告
		safariDialogOpen: boolean;
		onsafaridialogconfirm: () => void;
		// 添付ダイアログ
		attachmentDialogOpen: boolean;
		pendingFile: File | null;
		mainAmount: number;
		suggestedDocType: DocumentType;
		onattachmentconfirm: (
			documentDate: string,
			documentType: DocumentType,
			generatedName: string,
			updatedVendor: string
		) => void;
		onattachmentcancel: () => void;
		// 添付編集
		editDialogOpen: boolean;
		editingAttachment: Attachment | null;
		oneditconfirm: (updates: {
			documentDate: string;
			documentType: DocumentType;
			description: string;
			amount: number;
			vendor: string;
			generatedName?: string;
		}) => void;
		oneditcancel: () => void;
		// 証跡ステータス変更
		evidenceChangeDialogOpen: boolean;
		attachmentCount: number;
		onconfirmstatuschange: () => void;
		oncancelstatuschange: () => void;
		// 添付削除
		removeAttachmentDialogOpen: boolean;
		pendingRemoveAttachmentId: string | null;
		onconfirmremoveattachment: () => void;
		oncancelremoveattachment: () => void;
		// リネーム確認
		renameConfirmDialogOpen: boolean;
		renameConfirmSuppressCheck: boolean;
		pendingRenameInfo: RenameInfo | null;
		onconfirmrename: () => void;
		oncancelrename: () => void;
		onsuppresschange: (checked: boolean) => void;
		// ファイル上書き確認
		overwriteDialogOpen: boolean;
		overwriteFileName: string;
		onconfirmoverwrite: () => void;
		oncanceloverwrite: () => void;
	}

	let {
		journal,
		vendors,
		safariDialogOpen = $bindable(),
		onsafaridialogconfirm,
		attachmentDialogOpen = $bindable(),
		pendingFile,
		mainAmount,
		suggestedDocType,
		onattachmentconfirm,
		onattachmentcancel,
		editDialogOpen = $bindable(),
		editingAttachment,
		oneditconfirm,
		oneditcancel,
		evidenceChangeDialogOpen = $bindable(),
		attachmentCount,
		onconfirmstatuschange,
		oncancelstatuschange,
		removeAttachmentDialogOpen = $bindable(),
		pendingRemoveAttachmentId,
		onconfirmremoveattachment,
		oncancelremoveattachment,
		renameConfirmDialogOpen = $bindable(),
		renameConfirmSuppressCheck,
		pendingRenameInfo,
		onconfirmrename,
		oncancelrename,
		onsuppresschange,
		overwriteDialogOpen = $bindable(),
		overwriteFileName,
		onconfirmoverwrite,
		oncanceloverwrite
	}: Props = $props();
</script>

<!-- Safari向け警告ダイアログ -->
<SafariStorageDialog bind:open={safariDialogOpen} onconfirm={onsafaridialogconfirm} />

<!-- 添付ダイアログ -->
<AttachmentDialog
	bind:open={attachmentDialogOpen}
	file={pendingFile}
	journalDate={journal.date}
	vendor={journal.vendor}
	{vendors}
	description={journal.description}
	amount={mainAmount}
	suggestedDocumentType={suggestedDocType}
	onconfirm={onattachmentconfirm}
	oncancel={onattachmentcancel}
/>

<!-- 証憑編集ダイアログ -->
<AttachmentEditDialog
	bind:open={editDialogOpen}
	attachment={editingAttachment}
	{vendors}
	onconfirm={oneditconfirm}
	oncancel={oneditcancel}
/>

<!-- 証跡ステータス変更確認ダイアログ -->
<AlertDialog.Root bind:open={evidenceChangeDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>添付ファイルを削除しますか？</AlertDialog.Title>
			<AlertDialog.Description>
				電子証憑から他のステータスに変更すると、紐付けられている添付ファイル（{attachmentCount}件）が削除されます。この操作は取り消せません。
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel onclick={oncancelstatuschange}>キャンセル</AlertDialog.Cancel>
			<AlertDialog.Action
				class="bg-destructive/80 text-white hover:bg-destructive/70"
				onclick={onconfirmstatuschange}
			>
				削除して変更
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<!-- 証憑削除確認ダイアログ -->
<AlertDialog.Root bind:open={removeAttachmentDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>証憑を削除しますか？</AlertDialog.Title>
			<AlertDialog.Description>
				{#if pendingRemoveAttachmentId}
					{@const att = journal.attachments.find((a) => a.id === pendingRemoveAttachmentId)}
					{#if att}
						<span class="font-mono text-sm">{att.generatedName}</span> を削除します。
						{#if att.storageType === 'filesystem'}
							保存先フォルダのファイルも削除されます。
						{/if}
						この操作は取り消せません。
					{/if}
				{/if}
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel onclick={oncancelremoveattachment}>キャンセル</AlertDialog.Cancel>
			<AlertDialog.Action
				class="bg-destructive/80 text-white hover:bg-destructive/70"
				onclick={onconfirmremoveattachment}
			>
				削除
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<!-- 証憑リネーム確認ダイアログ -->
<AlertDialog.Root bind:open={renameConfirmDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>証憑のファイル名が変更されます</AlertDialog.Title>
			<AlertDialog.Description>
				仕訳の変更に伴い、紐付けられた証憑のファイル名が更新されます。
			</AlertDialog.Description>
		</AlertDialog.Header>

		{#if pendingRenameInfo}
			<div class="max-h-48 space-y-2 overflow-y-auto py-2">
				{#each pendingRenameInfo.oldNames as oldName, i (i)}
					{#if oldName !== pendingRenameInfo.newNames[i]}
						<div class="rounded-md border p-2 text-xs">
							<p class="text-muted-foreground line-through">{oldName}</p>
							<p class="font-medium">{pendingRenameInfo.newNames[i]}</p>
						</div>
					{/if}
				{/each}
			</div>
		{/if}

		<div class="flex items-center gap-2 py-2">
			<input
				type="checkbox"
				id="suppress-rename-check"
				checked={renameConfirmSuppressCheck}
				onchange={(e) => onsuppresschange(e.currentTarget.checked)}
				class="size-4 rounded border-gray-300"
			/>
			<label for="suppress-rename-check" class="text-sm text-muted-foreground">
				次回から表示しない
			</label>
		</div>

		<AlertDialog.Footer>
			<AlertDialog.Cancel onclick={oncancelrename}>キャンセル</AlertDialog.Cancel>
			<AlertDialog.Action onclick={onconfirmrename}>変更する</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<!-- ファイル上書き確認ダイアログ -->
<AlertDialog.Root bind:open={overwriteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>ファイルを上書きしますか？</AlertDialog.Title>
			<AlertDialog.Description>
				同じファイル名の証憑が既に存在します。上書きすると既存のPDFファイルが置き換えられます。
				<span class="mt-2 block font-mono text-sm">{overwriteFileName}</span>
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel onclick={oncanceloverwrite}>キャンセル</AlertDialog.Cancel>
			<AlertDialog.Action
				class="bg-destructive/80 text-white hover:bg-destructive/70"
				onclick={onconfirmoverwrite}
			>
				上書きする
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
