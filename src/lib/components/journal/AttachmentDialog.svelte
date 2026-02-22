<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { FileText, AlertTriangle } from '@lucide/svelte';
	import type { DocumentType, Vendor } from '$lib/types';
	import { DocumentTypeLabels } from '$lib/types';
	import { generateAttachmentName } from '$lib/db';
	import VendorInput from './VendorInput.svelte';

	interface Props {
		open: boolean;
		file: File | null;
		journalDate: string;
		vendor: string;
		vendors: Vendor[];
		description: string;
		amount: number;
		suggestedDocumentType: DocumentType;
		onconfirm: (
			documentDate: string,
			documentType: DocumentType,
			generatedName: string,
			updatedVendor: string
		) => void;
		oncancel: () => void;
	}

	let {
		open,
		file,
		journalDate,
		vendor,
		vendors,
		description,
		amount,
		suggestedDocumentType,
		onconfirm,
		oncancel
	}: Props = $props();

	// ダイアログの状態（ダイアログ内で編集可能）
	let documentDate = $state('');
	let documentType = $state<DocumentType>('receipt');
	let editableVendor = $state('');

	// ダイアログが開いたときに親の値で初期化
	$effect(() => {
		if (open) {
			documentDate = journalDate;
			documentType = suggestedDocumentType;
			editableVendor = vendor;
		}
	});

	// 取引先が未入力かどうか
	const vendorMissing = $derived(!editableVendor.trim());

	// 生成されるファイル名のプレビュー
	const generatedName = $derived(
		generateAttachmentName(documentDate, documentType, description, amount, editableVendor)
	);

	// 書類種類のオプション
	const documentTypeOptions = Object.entries(DocumentTypeLabels).map(([value, label]) => ({
		value: value as DocumentType,
		label
	}));

	function handleConfirm() {
		onconfirm(documentDate, documentType, generatedName, editableVendor);
	}

	function handleCancel() {
		oncancel();
	}

	function handleOpenChange(isOpen: boolean) {
		if (!isOpen) oncancel();
	}
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
	<Dialog.Content class="max-w-[calc(100vw-2rem)] overflow-hidden sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>証憑を添付</Dialog.Title>
			<Dialog.Description>書類の情報を入力してください</Dialog.Description>
		</Dialog.Header>

		<div class="min-w-0 space-y-4 py-4">
			<!-- 元のファイル名 -->
			{#if file}
				<div class="flex items-center gap-2 rounded-md bg-muted p-2 text-sm">
					<FileText class="size-4 text-red-500" />
					<span class="truncate">{file.name}</span>
					<span class="ml-auto text-muted-foreground">
						{(file.size / 1024).toFixed(1)} KB
					</span>
				</div>
			{/if}

			<!-- 書類の日付 -->
			<div class="space-y-2">
				<Label for="documentDate">書類の日付</Label>
				<Input id="documentDate" type="date" bind:value={documentDate} class="w-full" />
				<p class="text-xs text-muted-foreground">書類に記載された日付（電帳法の取引年月日）</p>
			</div>

			<!-- 書類の種類 -->
			<div class="space-y-2">
				<Label>書類の種類</Label>
				<Select.Root type="single" bind:value={documentType}>
					<Select.Trigger class="w-full">
						{DocumentTypeLabels[documentType]}
					</Select.Trigger>
					<Select.Content>
						{#each documentTypeOptions as option (option.value)}
							<Select.Item value={option.value}>{option.label}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>

			<!-- 取引先 -->
			<div class="space-y-2">
				<Label for="vendor">取引先</Label>
				<VendorInput
					{vendors}
					value={editableVendor}
					onchange={(name) => (editableVendor = name)}
					placeholder="取引先名を入力"
					class="w-full"
				/>
				{#if vendorMissing}
					<p class="flex items-center gap-1 text-xs text-amber-600">
						<AlertTriangle class="size-3" />
						取引先を入力するとファイル名に反映されます
					</p>
				{/if}
			</div>

			<!-- 生成されるファイル名 -->
			<div class="space-y-2">
				<Label>保存されるファイル名</Label>
				<div class="rounded-md border bg-muted/50 px-3 py-2 font-mono text-sm break-all">
					{generatedName}
				</div>
			</div>
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={handleCancel}>キャンセル</Button>
			<Button onclick={handleConfirm}>添付</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
