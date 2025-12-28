<script lang="ts">
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import {
		Circle,
		FileText,
		Paperclip,
		Trash2,
		Plus,
		ArrowUp,
		ArrowDown,
		Check
	} from '@lucide/svelte';
	import AccountSelect from './AccountSelect.svelte';
	import VendorInput from './VendorInput.svelte';
	import PdfDropZone from './PdfDropZone.svelte';
	import AttachmentDialog from './AttachmentDialog.svelte';
	import AttachmentEditDialog from './AttachmentEditDialog.svelte';
	import SafariStorageDialog from '$lib/components/SafariStorageDialog.svelte';
	import type {
		JournalEntry,
		JournalLine,
		Account,
		AccountType,
		EvidenceStatus,
		Vendor,
		Attachment,
		DocumentType
	} from '$lib/types';
	import {
		validateJournal,
		addAttachmentToJournal,
		removeAttachmentFromJournal,
		getAttachmentBlob,
		suggestDocumentType,
		updateAttachment,
		syncAttachmentsWithJournal
	} from '$lib/db';
	import { supportsFileSystemAccess } from '$lib/utils/filesystem';
	import { cn } from '$lib/utils.js';

	interface Props {
		journal: JournalEntry;
		accounts: Account[];
		vendors: Vendor[];
		directoryHandle?: FileSystemDirectoryHandle | null;
		isEditing?: boolean;
		isFlashing?: boolean;
		onupdate: (journal: JournalEntry) => void;
		ondelete: (id: string) => void;
		onconfirm?: (id: string) => void;
	}

	let {
		journal,
		accounts,
		vendors,
		directoryHandle = null,
		isEditing = false,
		isFlashing = false,
		onupdate,
		ondelete,
		onconfirm
	}: Props = $props();

	// バリデーション
	const validation = $derived(validateJournal(journal));
	const debitLines = $derived(journal.lines.filter((l) => l.type === 'debit'));
	const creditLines = $derived(journal.lines.filter((l) => l.type === 'credit'));

	// 添付ダイアログの状態
	let attachmentDialogOpen = $state(false);
	let pendingFile = $state<File | null>(null);

	// Safari向け警告ダイアログの状態
	let safariDialogOpen = $state(false);

	// 証憑編集ダイアログの状態
	let editDialogOpen = $state(false);
	let editingAttachment = $state<Attachment | null>(null);

	// ダイアログ用の派生値
	const mainDebitLine = $derived(journal.lines.find((l) => l.type === 'debit' && l.accountCode));
	const mainAccountType = $derived(
		mainDebitLine
			? (accounts.find((a) => a.code === mainDebitLine.accountCode)?.type ?? null)
			: null
	);
	const mainAmount = $derived(mainDebitLine?.amount ?? 0);
	const suggestedDocType = $derived(suggestDocumentType(mainAccountType));

	// 勘定科目のタイプを取得
	function getAccountType(code: string): AccountType | null {
		return accounts.find((a) => a.code === code)?.type ?? null;
	}

	/**
	 * 借方/貸方と勘定科目タイプから増減アイコン情報を取得
	 *
	 * | 種別   | 増加 | 減少 |
	 * |--------|------|------|
	 * | 資産   | 借方 | 貸方 |
	 * | 負債   | 貸方 | 借方 |
	 * | 純資産 | 貸方 | 借方 |
	 * | 収益   | 貸方 | ―   |
	 * | 費用   | 借方 | ―   |
	 */
	function getLineIndicator(
		side: 'debit' | 'credit',
		accountType: AccountType | null
	): { icon: 'up' | 'down' | null; label: string; color: string } {
		if (!accountType) {
			return { icon: null, label: '', color: '' };
		}

		// 借方側のルール
		if (side === 'debit') {
			switch (accountType) {
				case 'asset':
					return { icon: 'up', label: '資産', color: 'text-blue-500' };
				case 'expense':
					return { icon: 'up', label: '費用', color: 'text-red-500' };
				case 'liability':
					return { icon: 'down', label: '負債', color: 'text-purple-500' };
				case 'equity':
					return { icon: 'down', label: '純資産', color: 'text-purple-500' };
				case 'revenue':
					// 収益が借方に来るのは取消・戻しの場合（稀）
					return { icon: 'down', label: '収益', color: 'text-green-500' };
			}
		}

		// 貸方側のルール
		if (side === 'credit') {
			switch (accountType) {
				case 'asset':
					return { icon: 'down', label: '資産', color: 'text-blue-500' };
				case 'liability':
					return { icon: 'up', label: '負債', color: 'text-purple-500' };
				case 'equity':
					return { icon: 'up', label: '純資産', color: 'text-purple-500' };
				case 'revenue':
					return { icon: 'up', label: '収益', color: 'text-green-500' };
				case 'expense':
					// 費用が貸方に来るのは取消・戻しの場合（稀）
					return { icon: 'down', label: '費用', color: 'text-red-500' };
			}
		}

		return { icon: null, label: '', color: '' };
	}

	// 証跡ステータスのサイクル
	function cycleEvidenceStatus() {
		const statusOrder: EvidenceStatus[] = ['none', 'paper', 'digital'];
		const currentIndex = statusOrder.indexOf(journal.evidenceStatus);
		const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];
		onupdate({ ...journal, evidenceStatus: nextStatus });
	}

	// フィールド更新（即時、証憑同期なし）
	function updateField<K extends keyof JournalEntry>(field: K, value: JournalEntry[K]) {
		onupdate({ ...journal, [field]: value });
	}

	// 証憑同期（blurタイミングで呼ばれる）
	async function syncAttachmentsOnBlur() {
		if (journal.attachments.length === 0) return;

		// メイン借方行の金額を取得
		const mainDebitAmount =
			journal.lines.find((l) => l.type === 'debit' && l.accountCode)?.amount ?? 0;

		try {
			const syncedAttachments = await syncAttachmentsWithJournal(
				journal.attachments,
				{
					date: journal.date,
					description: journal.description,
					vendor: journal.vendor,
					amount: mainDebitAmount
				},
				directoryHandle
			);
			// ファイル名が変わった場合のみ更新
			if (syncedAttachments.length > 0) {
				const hasChanges = syncedAttachments.some(
					(synced, i) => synced.generatedName !== journal.attachments[i]?.generatedName
				);
				if (hasChanges) {
					onupdate({ ...journal, attachments: syncedAttachments });
				}
			}
		} catch (error) {
			console.error('証憑の同期に失敗:', error);
		}
	}

	// 仕訳行の更新（即時、証憑同期はblurで実行）
	function updateLine(lineId: string, field: keyof JournalLine, value: string | number) {
		const newLines = journal.lines.map((line) =>
			line.id === lineId ? { ...line, [field]: value } : line
		);
		onupdate({ ...journal, lines: newLines });
	}

	// 仕訳行の追加
	function addLine(type: 'debit' | 'credit') {
		const newLine: JournalLine = {
			id: crypto.randomUUID(),
			type,
			accountCode: '',
			amount: 0
		};
		onupdate({ ...journal, lines: [...journal.lines, newLine] });
	}

	// 仕訳行の削除
	function removeLine(lineId: string) {
		if (journal.lines.length <= 2) return; // 最低2行は維持
		onupdate({ ...journal, lines: journal.lines.filter((l) => l.id !== lineId) });
	}

	// Safari判定
	function isSafari(): boolean {
		if (typeof navigator === 'undefined') return false;
		const ua = navigator.userAgent;
		// Safari判定: Safariを含み、ChromeやEdgeを含まない
		return /Safari/.test(ua) && !/Chrome|CriOS|Edg/.test(ua);
	}

	// Safari向け警告が必要かチェック
	function shouldShowSafariWarning(): boolean {
		// File System Access API非対応、またはSafariの場合は警告対象
		const needsWarning = !supportsFileSystemAccess() || isSafari();
		if (!needsWarning) {
			return false;
		}
		// 既に表示済みなら警告不要
		if (
			typeof localStorage !== 'undefined' &&
			localStorage.getItem('shownStorageWarning') === 'true'
		) {
			return false;
		}
		return true;
	}

	// 添付ファイルのドロップ → ダイアログを開く
	function handleFileDrop(file: File) {
		pendingFile = file;

		// Safari向け：初回のみ警告ダイアログを表示
		if (shouldShowSafariWarning()) {
			safariDialogOpen = true;
		} else {
			attachmentDialogOpen = true;
		}
	}

	// Safari警告ダイアログでOKした後、添付ダイアログを開く
	function handleSafariDialogConfirm() {
		attachmentDialogOpen = true;
	}

	// ダイアログで確定 → 実際に添付
	async function handleAttachmentConfirm(
		documentDate: string,
		documentType: DocumentType,
		generatedName: string,
		updatedVendor: string
	) {
		if (!pendingFile) return;

		try {
			// 仕訳の日付から年度を取得
			const year = parseInt(journal.date.substring(0, 4), 10);

			const attachment = await addAttachmentToJournal(
				journal.id,
				{
					file: pendingFile,
					documentDate,
					documentType,
					generatedName,
					year,
					description: journal.description,
					amount: mainAmount,
					vendor: updatedVendor
				},
				directoryHandle
			);
			// ローカル状態を更新（取引先も更新）
			onupdate({
				...journal,
				vendor: updatedVendor,
				attachments: [...journal.attachments, attachment],
				evidenceStatus: 'digital'
			});
		} catch (error) {
			console.error('添付ファイルの追加に失敗しました:', error);
			alert('添付ファイルの追加に失敗しました');
		} finally {
			pendingFile = null;
		}
	}

	// ダイアログでキャンセル
	function handleAttachmentCancel() {
		pendingFile = null;
	}

	// 添付ファイルの削除
	async function handleRemoveAttachment(attachmentId: string) {
		try {
			await removeAttachmentFromJournal(journal.id, attachmentId, directoryHandle);
			const updatedAttachments = journal.attachments.filter((a) => a.id !== attachmentId);
			onupdate({
				...journal,
				attachments: updatedAttachments,
				evidenceStatus: updatedAttachments.length > 0 ? 'digital' : 'none'
			});
		} catch (error) {
			console.error('添付ファイルの削除に失敗しました:', error);
		}
	}

	// 添付ファイルのプレビュー
	async function handlePreviewAttachment(attachment: Attachment) {
		const blob = await getAttachmentBlob(journal.id, attachment.id, directoryHandle);
		if (blob) {
			const url = URL.createObjectURL(blob);
			window.open(url, '_blank');
			// メモリリーク防止のため少し遅延してURLを解放
			setTimeout(() => URL.revokeObjectURL(url), 1000);
		}
	}

	// 添付ファイルの編集ダイアログを開く
	function handleEditAttachment(attachment: Attachment) {
		editingAttachment = attachment;
		editDialogOpen = true;
	}

	// 添付ファイルの編集を確定
	async function handleEditConfirm(updates: {
		documentDate: string;
		documentType: DocumentType;
		description: string;
		amount: number;
		vendor: string;
	}) {
		if (!editingAttachment) return;

		try {
			const updatedAttachment = await updateAttachment(
				journal.id,
				editingAttachment.id,
				updates,
				directoryHandle
			);

			// ローカル状態を更新
			const updatedAttachments = journal.attachments.map((a) =>
				a.id === updatedAttachment.id ? updatedAttachment : a
			);
			onupdate({
				...journal,
				attachments: updatedAttachments
			});
		} catch (error) {
			console.error('添付ファイルの更新に失敗しました:', error);
			alert('添付ファイルの更新に失敗しました');
		} finally {
			editingAttachment = null;
		}
	}

	// 添付ファイルの編集をキャンセル
	function handleEditCancel() {
		editingAttachment = null;
	}
</script>

<div
	class={cn(
		'flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-sm transition-all md:flex-row',
		isEditing && 'border-primary ring-2 ring-primary/20',
		isFlashing && 'animate-flash',
		!validation.isValid &&
			(!isEditing || journal.lines.some((l) => l.amount > 0)) &&
			'border-destructive'
	)}
>
	<!-- メインコンテンツ -->
	<div class="min-w-0 flex-1">
		<!-- ヘッダー行: モバイル2段、デスクトップ1行 -->
		<div class="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
			<!-- 証跡ステータス + 日付 + 摘要 -->
			<div class="flex min-w-0 flex-1 items-center gap-2">
				<!-- 証跡ステータス -->
				<Tooltip.Provider>
					<Tooltip.Root>
						<Tooltip.Trigger>
							<button type="button" class="p-1" onclick={cycleEvidenceStatus}>
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
					type="date"
					value={journal.date}
					onchange={(e) => updateField('date', e.currentTarget.value)}
					onblur={syncAttachmentsOnBlur}
					class="w-32 shrink-0"
				/>

				<!-- 摘要 -->
				<Input
					type="text"
					value={journal.description}
					oninput={(e) => updateField('description', e.currentTarget.value)}
					onblur={syncAttachmentsOnBlur}
					placeholder="摘要"
					class="min-w-0 flex-1"
				/>
			</div>

			<!-- 取引先 + ボタン類 -->
			<div class="flex items-center gap-2 pl-8 md:pl-0">
				<!-- 取引先 -->
				<VendorInput
					{vendors}
					value={journal.vendor}
					onchange={(name) => updateField('vendor', name)}
					onblur={syncAttachmentsOnBlur}
					placeholder="取引先"
					class="w-40 shrink-0"
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
									>
										<Check class="size-4" />
										確定
									</Button>
								{/snippet}
							</Tooltip.Trigger>
							{#if !validation.isValid}
								<Tooltip.Content>
									{#if validation.debitTotal === 0 && validation.creditTotal === 0}
										金額を入力してください
									{:else}
										借方・貸方の合計が一致しません
									{/if}
								</Tooltip.Content>
							{/if}
						</Tooltip.Root>
					</Tooltip.Provider>
				{/if}

				<!-- 削除ボタン -->
				<Button
					variant="ghost"
					size="icon"
					class="shrink-0 text-destructive"
					onclick={() => ondelete(journal.id)}
				>
					<Trash2 class="size-4" />
				</Button>
			</div>
		</div>

		<!-- 仕訳行 -->
		<div class="grid grid-cols-2 gap-4">
			<!-- 借方 -->
			<div class="space-y-3">
				<div class="flex items-center gap-2 text-sm font-medium text-muted-foreground">
					借方
					<span class="ml-auto font-mono">{validation.debitTotal.toLocaleString('ja-JP')}円</span>
					<Tooltip.Provider>
						<Tooltip.Root>
							<Tooltip.Trigger>
								<Button
									variant="ghost"
									size="icon"
									class="size-6 text-foreground"
									onclick={() => addLine('debit')}
								>
									<Plus class="size-4" strokeWidth={3} />
								</Button>
							</Tooltip.Trigger>
							<Tooltip.Content>
								<div class="text-xs">
									<div class="mb-1 font-medium">借方に来る科目：</div>
									<div class="flex items-center gap-1">
										<ArrowUp class="size-3 text-blue-500" />資産の増加
									</div>
									<div class="flex items-center gap-1">
										<ArrowUp class="size-3 text-red-500" />費用の発生
									</div>
									<div class="flex items-center gap-1">
										<ArrowDown class="size-3 text-purple-500" />負債の減少
									</div>
								</div>
							</Tooltip.Content>
						</Tooltip.Root>
					</Tooltip.Provider>
				</div>
				{#each debitLines as line (line.id)}
					{@const accountType = getAccountType(line.accountCode)}
					{@const indicator = getLineIndicator('debit', accountType)}
					<!-- モバイル: 2段、デスクトップ: 1行 -->
					<div class="flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
						<!-- 種別アイコン + 勘定科目 -->
						<div class="flex min-w-0 flex-1 items-center gap-2">
							<Tooltip.Provider>
								<Tooltip.Root>
									<Tooltip.Trigger>
										<div
											class={cn('flex size-7 items-center justify-center rounded', indicator.color)}
										>
											{#if indicator.icon === 'up'}
												<ArrowUp class="size-4" />
											{:else if indicator.icon === 'down'}
												<ArrowDown class="size-4" />
											{:else}
												<span class="size-4"></span>
											{/if}
										</div>
									</Tooltip.Trigger>
									{#if indicator.label}
										<Tooltip.Content>
											{indicator.icon === 'up' ? '増加' : '減少'}：{indicator.label}
										</Tooltip.Content>
									{/if}
								</Tooltip.Root>
							</Tooltip.Provider>
							<AccountSelect
								{accounts}
								value={line.accountCode}
								onchange={(code) => updateLine(line.id, 'accountCode', code)}
								class="min-w-0 flex-1"
							/>
						</div>
						<!-- 金額 + 削除ボタン -->
						<div class="flex items-center gap-2 pl-9 md:pl-0">
							<Input
								type="number"
								value={line.amount}
								onchange={(e) => updateLine(line.id, 'amount', Number(e.currentTarget.value))}
								onblur={syncAttachmentsOnBlur}
								placeholder="金額"
								class={cn(
									'w-full text-right font-mono md:w-28',
									!isEditing && line.amount === 0 && !validation.isValid && 'border-destructive'
								)}
								min="0"
							/>
							{#if debitLines.length > 1}
								<Button
									variant="ghost"
									size="icon"
									class="size-7 shrink-0"
									onclick={() => removeLine(line.id)}
								>
									<Trash2 class="size-3" />
								</Button>
							{/if}
						</div>
					</div>
				{/each}
			</div>

			<!-- 貸方 -->
			<div class="space-y-3">
				<div class="flex items-center gap-2 text-sm font-medium text-muted-foreground">
					貸方
					<span class="ml-auto font-mono">{validation.creditTotal.toLocaleString('ja-JP')}円</span>
					<Tooltip.Provider>
						<Tooltip.Root>
							<Tooltip.Trigger>
								<Button
									variant="ghost"
									size="icon"
									class="size-6 text-foreground"
									onclick={() => addLine('credit')}
								>
									<Plus class="size-4" strokeWidth={3} />
								</Button>
							</Tooltip.Trigger>
							<Tooltip.Content>
								<div class="text-xs">
									<div class="mb-1 font-medium">貸方に来る科目：</div>
									<div class="flex items-center gap-1">
										<ArrowDown class="size-3 text-blue-500" />資産の減少
									</div>
									<div class="flex items-center gap-1">
										<ArrowUp class="size-3 text-purple-500" />負債の増加
									</div>
									<div class="flex items-center gap-1">
										<ArrowUp class="size-3 text-green-500" />収益の発生
									</div>
								</div>
							</Tooltip.Content>
						</Tooltip.Root>
					</Tooltip.Provider>
				</div>
				{#each creditLines as line (line.id)}
					{@const accountType = getAccountType(line.accountCode)}
					{@const indicator = getLineIndicator('credit', accountType)}
					<!-- モバイル: 2段、デスクトップ: 1行 -->
					<div class="flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
						<!-- 種別アイコン + 勘定科目 -->
						<div class="flex min-w-0 flex-1 items-center gap-2">
							<Tooltip.Provider>
								<Tooltip.Root>
									<Tooltip.Trigger>
										<div
											class={cn('flex size-7 items-center justify-center rounded', indicator.color)}
										>
											{#if indicator.icon === 'up'}
												<ArrowUp class="size-4" />
											{:else if indicator.icon === 'down'}
												<ArrowDown class="size-4" />
											{:else}
												<span class="size-4"></span>
											{/if}
										</div>
									</Tooltip.Trigger>
									{#if indicator.label}
										<Tooltip.Content>
											{indicator.icon === 'up' ? '増加' : '減少'}：{indicator.label}
										</Tooltip.Content>
									{/if}
								</Tooltip.Root>
							</Tooltip.Provider>
							<AccountSelect
								{accounts}
								value={line.accountCode}
								onchange={(code) => updateLine(line.id, 'accountCode', code)}
								class="min-w-0 flex-1"
							/>
						</div>
						<!-- 金額 + 削除ボタン -->
						<div class="flex items-center gap-2 pl-9 md:pl-0">
							<Input
								type="number"
								value={line.amount}
								onchange={(e) => updateLine(line.id, 'amount', Number(e.currentTarget.value))}
								onblur={syncAttachmentsOnBlur}
								placeholder="金額"
								class={cn(
									'w-full text-right font-mono md:w-28',
									!isEditing && line.amount === 0 && !validation.isValid && 'border-destructive'
								)}
								min="0"
							/>
							{#if creditLines.length > 1}
								<Button
									variant="ghost"
									size="icon"
									class="size-7 shrink-0"
									onclick={() => removeLine(line.id)}
								>
									<Trash2 class="size-3" />
								</Button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- バリデーションエラー表示 -->
		{#if !validation.isValid && journal.lines.some((l) => l.amount > 0)}
			<div class="mt-3 text-sm text-destructive">
				借方合計と貸方合計が一致しません（差額: {Math.abs(
					validation.debitTotal - validation.creditTotal
				).toLocaleString()}円）
			</div>
		{/if}
	</div>

	<!-- PDF添付エリア（デスクトップ: 右側、モバイル: 下部） -->
	<div class="w-full md:w-36 md:shrink-0">
		<PdfDropZone
			attachments={journal.attachments}
			onattach={handleFileDrop}
			onremove={handleRemoveAttachment}
			onpreview={handlePreviewAttachment}
			onedit={handleEditAttachment}
			vendorMissing={!journal.vendor.trim()}
			vertical
		/>
	</div>
</div>

<!-- Safari向け警告ダイアログ -->
<SafariStorageDialog bind:open={safariDialogOpen} onconfirm={handleSafariDialogConfirm} />

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
	onconfirm={handleAttachmentConfirm}
	oncancel={handleAttachmentCancel}
/>

<!-- 証憑編集ダイアログ -->
<AttachmentEditDialog
	bind:open={editDialogOpen}
	attachment={editingAttachment}
	{vendors}
	onconfirm={handleEditConfirm}
	oncancel={handleEditCancel}
/>
