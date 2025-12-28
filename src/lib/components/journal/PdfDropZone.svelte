<script lang="ts">
	import { Upload, FileText, X, Pencil } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { cn } from '$lib/utils.js';
	import type { Attachment } from '$lib/types';

	interface Props {
		attachments: Attachment[];
		onattach: (file: File) => void;
		onremove: (attachmentId: string) => void;
		onpreview: (attachment: Attachment) => void;
		onedit?: (attachment: Attachment) => void;
		disabled?: boolean;
		vendorMissing?: boolean;
		vertical?: boolean;
	}

	let {
		attachments,
		onattach,
		onremove,
		onpreview,
		onedit = undefined,
		disabled = false,
		vendorMissing = false,
		vertical = false
	}: Props = $props();

	let isDragOver = $state(false);
	let fileInput = $state<HTMLInputElement | null>(null);

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		if (!disabled) {
			isDragOver = true;
		}
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		isDragOver = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragOver = false;

		if (disabled) return;

		const files = e.dataTransfer?.files;
		if (files && files.length > 0) {
			processFile(files[0]);
		}
	}

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			processFile(input.files[0]);
			input.value = ''; // リセット
		}
	}

	function processFile(file: File) {
		// PDFのみ許可
		if (file.type !== 'application/pdf') {
			alert('PDFファイルのみ添付できます');
			return;
		}
		onattach(file);
	}

	function handleClick() {
		if (!disabled) {
			fileInput?.click();
		}
	}
</script>

<div class={cn('flex h-full flex-col gap-2', vertical && 'w-full')}>
	<!-- ドロップゾーン -->
	<div
		role="button"
		tabindex="0"
		class={cn(
			'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors',
			vertical ? 'flex-1 p-2' : 'p-4',
			isDragOver && 'border-primary bg-primary/5',
			!isDragOver && 'border-muted-foreground/25 hover:border-muted-foreground/50',
			disabled && 'cursor-not-allowed opacity-50'
		)}
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
		ondrop={handleDrop}
		onclick={handleClick}
		onkeydown={(e) => e.key === 'Enter' && handleClick()}
	>
		<Upload class={cn('text-muted-foreground', vertical ? 'size-5' : 'mb-2 size-6')} />
		{#if !vertical}
			<p class="text-sm text-muted-foreground">
				{#if vendorMissing}
					<span class="text-amber-600">取引先を入力してからPDFを添付してください</span>
				{:else}
					PDFをドラッグ＆ドロップ
				{/if}
			</p>
			<p class="text-xs text-muted-foreground/70">またはクリックして選択</p>
		{:else}
			<p class="mt-1 text-center text-xs text-muted-foreground">
				{#if vendorMissing}
					<span class="text-amber-600">取引先を先に入力</span>
				{:else}
					PDF
				{/if}
			</p>
		{/if}
	</div>

	<input
		bind:this={fileInput}
		type="file"
		accept="application/pdf"
		class="hidden"
		onchange={handleFileSelect}
	/>

	<!-- 添付ファイル一覧 -->
	{#if attachments.length > 0}
		<div class="space-y-1">
			{#each attachments as attachment (attachment.id)}
				<div
					class={cn(
						'flex items-center gap-1 rounded-md bg-muted/50 text-sm',
						vertical ? 'p-1' : 'gap-2 p-2'
					)}
				>
					<FileText class="size-4 shrink-0 text-red-500" />
					<Tooltip.Provider>
						<Tooltip.Root>
							<Tooltip.Trigger>
								<button
									type="button"
									class={cn(
										'truncate text-left hover:underline',
										vertical ? 'max-w-16 text-xs' : 'flex-1'
									)}
									onclick={() => onpreview(attachment)}
								>
									{vertical ? 'PDF' : attachment.generatedName}
								</button>
							</Tooltip.Trigger>
							<Tooltip.Content>
								<p class="font-medium">{attachment.generatedName}</p>
								<p class="text-muted-foreground">元: {attachment.originalName}</p>
								<p class="text-muted-foreground">サイズ: {(attachment.size / 1024).toFixed(1)} KB</p>
							</Tooltip.Content>
						</Tooltip.Root>
					</Tooltip.Provider>
					{#if onedit}
						<Button
							variant="ghost"
							size="icon"
							class="size-5 shrink-0"
							onclick={() => onedit(attachment)}
						>
							<Pencil class="size-3" />
						</Button>
					{/if}
					<Button
						variant="ghost"
						size="icon"
						class="size-5 shrink-0"
						onclick={() => onremove(attachment.id)}
					>
						<X class="size-3" />
					</Button>
				</div>
			{/each}
		</div>
	{/if}
</div>
