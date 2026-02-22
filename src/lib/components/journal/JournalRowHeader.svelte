<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import type { JournalEntry, Vendor } from '$lib/types';
	import { Check, Circle, Copy, FileText, Paperclip, Trash2 } from '@lucide/svelte';
	import VendorInput from './VendorInput.svelte';

	interface ValidationResult {
		isValid: boolean;
		hasEmptyAccounts: boolean;
		debitTotal: number;
		creditTotal: number;
	}

	interface Props {
		journal: JournalEntry;
		vendors: Vendor[];
		localDate: string;
		validation: ValidationResult;
		isEditing: boolean;
		// ハンドラー
		onupdatefield: <K extends keyof JournalEntry>(field: K, value: JournalEntry[K]) => void;
		ondatechange: (value: string) => void;
		ondateblur: () => void;
		onvendorblur: () => void;
		onsyncblur: () => void;
		oncyclestatus: () => void;
		onconfirm?: (id: string) => void;
		oncopy?: (journal: JournalEntry) => void;
		ondelete: (id: string) => void;
		onvendorkeydown: (e: KeyboardEvent) => void;
		// Ref バインド
		dateInputRef?: HTMLInputElement;
		vendorInputRef?: { focus: () => void };
	}

	let {
		journal,
		vendors,
		localDate,
		validation,
		isEditing,
		onupdatefield,
		ondatechange,
		ondateblur,
		onvendorblur,
		onsyncblur,
		oncyclestatus,
		onconfirm,
		oncopy,
		ondelete,
		onvendorkeydown,
		dateInputRef = $bindable(),
		vendorInputRef = $bindable()
	}: Props = $props();
</script>

<div class="mb-3 flex flex-col gap-2 journal:flex-row journal:items-center journal:gap-3">
	<!-- 証跡ステータス + 日付 + 摘要 -->
	<div class="flex min-w-0 flex-1 items-center gap-2">
		<!-- 証跡ステータス -->
		<Tooltip.Provider>
			<Tooltip.Root>
				<Tooltip.Trigger>
					<button type="button" class="p-1" onclick={oncyclestatus} tabindex={-1}>
						{#if journal.evidenceStatus === 'none'}
							<Circle class="size-5 text-muted-foreground" />
						{:else if journal.evidenceStatus === 'paper'}
							<FileText class="size-5 text-amber-500" />
						{:else}
							<Paperclip class="size-5 text-green-500" />
						{/if}
					</button>
				</Tooltip.Trigger>
				<Tooltip.Content>
					{#if journal.evidenceStatus === 'none'}
						証跡なし（クリックで変更）
					{:else if journal.evidenceStatus === 'paper'}
						紙で保管（クリックで変更）
					{:else}
						電子データ紐付け済み（クリックで変更）
					{/if}
				</Tooltip.Content>
			</Tooltip.Root>
		</Tooltip.Provider>

		<!-- 日付 -->
		<Input
			bind:ref={dateInputRef}
			type="date"
			value={localDate}
			oninput={(e) => ondatechange(e.currentTarget.value)}
			onblur={ondateblur}
			class="w-32 shrink-0"
		/>

		<!-- 摘要 -->
		<Input
			type="text"
			value={journal.description}
			oninput={(e) => onupdatefield('description', e.currentTarget.value)}
			onblur={onsyncblur}
			placeholder="摘要"
			class="min-w-0 flex-1"
		/>
	</div>

	<!-- 取引先 + ボタン類 -->
	<div class="flex items-center gap-2 pl-8 journal:pl-0">
		<VendorInput
			bind:this={vendorInputRef}
			{vendors}
			value={journal.vendor}
			onchange={(name) => onupdatefield('vendor', name)}
			onblur={onvendorblur}
			onkeydown={onvendorkeydown}
			placeholder="取引先"
			class="w-40 shrink-0"
			tabindex={-1}
		/>

		<!-- 確定ボタン（編集中のみ表示） -->
		{#if isEditing && onconfirm}
			<Tooltip.Provider>
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<Button
								{...props}
								variant="default"
								size="sm"
								class="shrink-0 gap-1"
								disabled={!validation.isValid}
								onclick={() => onconfirm(journal.id)}
								tabindex={-1}
							>
								<Check class="size-4" />
								確定
							</Button>
						{/snippet}
					</Tooltip.Trigger>
					{#if !validation.isValid}
						<Tooltip.Content>
							{#if validation.hasEmptyAccounts}
								勘定科目を選択してください
							{:else if validation.debitTotal === 0 && validation.creditTotal === 0}
								金額を入力してください
							{:else}
								借方・貸方の合計が一致しません
							{/if}
						</Tooltip.Content>
					{/if}
				</Tooltip.Root>
			</Tooltip.Provider>
		{/if}

		<!-- コピーボタン（編集中でない場合のみ表示） -->
		{#if !isEditing && oncopy}
			<Tooltip.Provider>
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<Button
								{...props}
								variant="ghost"
								size="icon"
								class="shrink-0"
								onclick={() => oncopy(journal)}
								tabindex={-1}
							>
								<Copy class="size-4" />
							</Button>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content>この仕訳をコピーして新規作成</Tooltip.Content>
				</Tooltip.Root>
			</Tooltip.Provider>
		{/if}

		<!-- 削除ボタン -->
		<Button
			variant="ghost"
			size="icon"
			class="shrink-0 text-destructive"
			onclick={() => ondelete(journal.id)}
			tabindex={-1}
		>
			<Trash2 class="size-4" />
		</Button>
	</div>
</div>
