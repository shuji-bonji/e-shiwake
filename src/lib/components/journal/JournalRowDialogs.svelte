<script lang="ts">
	import SafariStorageDialog from '$lib/components/SafariStorageDialog.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import type { DocumentType, JournalEntry, Vendor } from '$lib/types';
	import type { DialogState } from './dialog-state';
	import AttachmentDialog from './AttachmentDialog.svelte';
	import AttachmentEditDialog from './AttachmentEditDialog.svelte';

	interface Props {
		journal: JournalEntry;
		vendors: Vendor[];
		dialog: DialogState;
		mainAmount: number;
		suggestedDocType: DocumentType;
		ondialogclose: () => void;
		// Safari警告
		onsafaridialogconfirm: () => void;
		// 添付ダイアログ
		onattachmentconfirm: (
			documentDate: string,
			documentType: DocumentType,
			generatedName: string,
			updatedVendor: string
		) => void;
		onattachmentcancel: () => void;
		// 添付編集
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
		onconfirmstatuschange: () => void;
		oncancelstatuschange: () => void;
		// 添付削除
		onconfirmremoveattachment: () => void;
		oncancelremoveattachment: () => void;
		// リネーム確認
		onconfirmrename: () => void;
		oncancelrename: () => void;
		onsuppresschange: (checked: boolean) => void;
		// ファイル上書き確認
		onconfirmoverwrite: () => void;
		oncanceloverwrite: () => void;
	}

	let {
		journal,
		vendors,
		dialog,
		mainAmount,
		suggestedDocType,
		ondialogclose,
		onsafaridialogconfirm,
		onattachmentconfirm,
		onattachmentcancel,
		oneditconfirm,
		oneditcancel,
		onconfirmstatuschange,
		oncancelstatuschange,
		onconfirmremoveattachment,
		oncancelremoveattachment,
		onconfirmrename,
		oncancelrename,
		onsuppresschange,
		onconfirmoverwrite,
		oncanceloverwrite
	}: Props = $props();

	// DialogState から各ダイアログの open 状態を導出
	const safariDialogOpen = $derived(dialog.type === 'safari');
	const attachmentDialogOpen = $derived(dialog.type === 'attachment');
	const editDialogOpen = $derived(dialog.type === 'edit');
	const evidenceChangeDialogOpen = $derived(dialog.type === 'evidenceChange');
	const removeAttachmentDialogOpen = $derived(dialog.type === 'removeAttachment');
	const renameConfirmDialogOpen = $derived(dialog.type === 'rename');
	const overwriteDialogOpen = $derived(dialog.type === 'overwrite');

	// 各ダイアログ固有のデータを安全に取得
	const pendingFile = $derived(dialog.type === 'attachment' ? dialog.file : null);
	const editingAttachment = $derived(dialog.type === 'edit' ? dialog.attachment : null);
	const pendingRemoveAttachmentId = $derived(
		dialog.type === 'removeAttachment' ? dialog.attachmentId : null
	);
	const renameConfirmSuppressCheck = $derived(
		dialog.type === 'rename' ? dialog.suppressCheck : false
	);
	const pendingRenameInfo = $derived(dialog.type === 'rename' ? dialog.info : null);
	const overwriteFileName = $derived(dialog.type === 'overwrite' ? dialog.fileName : '');
</script>

<!-- Safari向け警告ダイアログ -->
<SafariStorageDialog
	open={safariDialogOpen}
	onclose={ondialogclose}
	onconfirm={onsafaridialogconfirm}
/>

<!-- 添付ダイアログ -->
<AttachmentDialog
	open={attachmentDialogOpen}
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
	open={editDialogOpen}
	attachment={editingAttachment}
	{vendors}
	onconfirm={oneditconfirm}
	oncancel={oneditcancel}
/>

<!-- 証跡ステータス変更確認ダイアログ -->
<AlertDialog.Root
	open={evidenceChangeDialogOpen}
	onOpenChange={(open) => {
		if (!open) oncancelstatuschange();
	}}
>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>添付ファイルを削除しますか？</AlertDialog.Title>
			<AlertDialog.Description>
				電子証憑から他のステータスに変更すると、紐付けられている添付ファイル（{journal.attachments
					.length}件）が削除されます。この操作は取り消せません。
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
<AlertDialog.Root
	open={removeAttachmentDialogOpen}
	onOpenChange={(open) => {
		if (!open) oncancelremoveattachment();
	}}
>
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
<AlertDialog.Root
	open={renameConfirmDialogOpen}
	onOpenChange={(open) => {
		if (!open) oncancelrename();
	}}
>
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
<AlertDialog.Root
	open={overwriteDialogOpen}
	onOpenChange={(open) => {
		if (!open) oncanceloverwrite();
	}}
>
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
