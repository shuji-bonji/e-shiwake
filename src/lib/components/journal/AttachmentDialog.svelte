<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { FileText } from '@lucide/svelte';
	import type { DocumentType } from '$lib/types';
	import { DocumentTypeLabels } from '$lib/types';
	import { generateAttachmentName } from '$lib/db';

	interface Props {
		open: boolean;
		file: File | null;
		journalDate: string;
		vendor: string;
		accountName: string;
		amount: number;
		suggestedDocumentType: DocumentType;
		onconfirm: (documentDate: string, documentType: DocumentType, generatedName: string) => void;
		oncancel: () => void;
	}

	let {
		open = $bindable(),
		file,
		journalDate,
		vendor,
		accountName,
		amount,
		suggestedDocumentType,
		onconfirm,
		oncancel
	}: Props = $props();

	// ダイアログの状態（親から渡される値で初期化、ダイアログ内で編集可能）
	let documentDate = $state(journalDate);
	let documentType = $state<DocumentType>(suggestedDocumentType);

	// propsが変更されたら同期（ダイアログが開くタイミングで親が値を更新する想定）
	$effect(() => {
		documentDate = journalDate;
	});

	$effect(() => {
		documentType = suggestedDocumentType;
	});

	// 生成されるファイル名のプレビュー
	const generatedName = $derived(
		generateAttachmentName(documentDate, documentType, accountName, amount, vendor)
	);

	// 書類種類のオプション
	const documentTypeOptions = Object.entries(DocumentTypeLabels).map(([value, label]) => ({
		value: value as DocumentType,
		label
	}));

	function handleConfirm() {
		onconfirm(documentDate, documentType, generatedName);
		open = false;
	}

	function handleCancel() {
		oncancel();
		open = false;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>証憑を添付</Dialog.Title>
			<Dialog.Description>
				書類の情報を入力してください
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4 py-4">
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
				<Input
					id="documentDate"
					type="date"
					bind:value={documentDate}
				/>
				<p class="text-xs text-muted-foreground">
					書類に記載された日付（電帳法の取引年月日）
				</p>
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

			<!-- 取引先（表示のみ） -->
			<div class="space-y-2">
				<Label>取引先</Label>
				<div class="rounded-md border bg-muted/50 px-3 py-2 text-sm">
					{vendor || '（未入力）'}
				</div>
			</div>

			<!-- 生成されるファイル名 -->
			<div class="space-y-2">
				<Label>保存されるファイル名</Label>
				<div class="rounded-md border bg-muted/50 px-3 py-2 text-sm font-mono break-all">
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
