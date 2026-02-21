<script lang="ts">
	import SafariStorageDialog from '$lib/components/SafariStorageDialog.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { suggestDocumentType, validateJournal } from '$lib/db';
	import type {
		Account,
		AccountType,
		Attachment,
		DocumentType,
		EvidenceStatus,
		JournalEntry,
		JournalLine,
		TaxCategory,
		Vendor
	} from '$lib/types';
	import {
		addJournalAttachment,
		confirmEvidenceStatusChange as confirmEvidenceStatusChangeUseCase,
		previewJournalAttachment,
		removeJournalAttachment,
		saveVendorIfNeeded,
		syncAttachmentsOnBlur as syncAttachmentsOnBlurUseCase,
		updateJournalAttachment
	} from '$lib/usecases/journal-attachments';
	import { cn } from '$lib/utils.js';
	import {
		applyBusinessRatio,
		getAppliedBusinessRatio,
		getBusinessRatioTargetLine,
		hasBusinessRatioApplied,
		removeBusinessRatio
	} from '$lib/utils/business-ratio';
	import { supportsFileSystemAccess } from '$lib/utils/filesystem';
	import {
		ArrowDown,
		ArrowUp,
		Check,
		Circle,
		Copy,
		FileText,
		Paperclip,
		Percent,
		Plus,
		Trash2,
		X
	} from '@lucide/svelte';
	import AccountSelect from './AccountSelect.svelte';
	import AttachmentDialog from './AttachmentDialog.svelte';
	import AttachmentEditDialog from './AttachmentEditDialog.svelte';
	import PdfDropZone from './PdfDropZone.svelte';
	import TaxCategorySelect from './TaxCategorySelect.svelte';
	import VendorInput from './VendorInput.svelte';

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
		oncopy?: (journal: JournalEntry) => void;
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
		onconfirm,
		oncopy
	}: Props = $props();

	// バリデーション
	const validation = $derived(validateJournal(journal));
	const debitLines = $derived(journal.lines.filter((l) => l.type === 'debit'));
	const creditLines = $derived(journal.lines.filter((l) => l.type === 'credit'));

	// 家事按分の状態
	const businessRatioTarget = $derived(getBusinessRatioTargetLine(journal.lines, accounts));
	const isBusinessRatioApplied = $derived(hasBusinessRatioApplied(journal.lines));
	const appliedBusinessRatio = $derived(getAppliedBusinessRatio(journal.lines));

	// 添付ダイアログの状態
	let attachmentDialogOpen = $state(false);
	let pendingFile = $state<File | null>(null);

	// Safari向け警告ダイアログの状態
	let safariDialogOpen = $state(false);

	// 証憑編集ダイアログの状態
	let editDialogOpen = $state(false);
	let editingAttachment = $state<Attachment | null>(null);

	// 証跡ステータス変更確認ダイアログの状態
	let evidenceChangeDialogOpen = $state(false);
	let pendingEvidenceStatus = $state<EvidenceStatus | null>(null);

	// タブ順序制御用の参照
	let vendorInputRef: { focus: () => void } | undefined = $state();
	let pdfDropZoneRef: { focus: () => void } | undefined = $state();
	let dateInputRef = $state<HTMLInputElement>(null!);

	// 日付のローカル状態（blurタイミングでのみ親に伝播）
	// propsから同期しつつローカル編集も可能にするため、$state + $effect を使用
	let localDate = $state(journal.date);
	$effect(() => {
		localDate = journal.date;
	});

	// ダイアログ用の派生値
	const mainDebitLine = $derived(journal.lines.find((l) => l.type === 'debit' && l.accountCode));
	const mainAccountType = $derived(
		mainDebitLine
			? (accounts.find((a) => a.code === mainDebitLine.accountCode)?.type ?? null)
			: null
	);
	const mainAmount = $derived(mainDebitLine?.amount ?? 0);
	const mainAccountCode = $derived(mainDebitLine?.accountCode);
	const suggestedDocType = $derived(suggestDocumentType(mainAccountType, mainAccountCode));

	// 勘定科目のタイプを取得
	function getAccountType(code: string): AccountType | null {
		return accounts.find((a) => a.code === code)?.type ?? null;
	}

	// 勘定科目のデフォルト税区分を取得
	function getAccountDefaultTaxCategory(code: string): TaxCategory | undefined {
		return accounts.find((a) => a.code === code)?.defaultTaxCategory;
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

		// 電子証憑から他に切り替える場合、添付ファイルがあれば確認ダイアログを表示
		if (journal.evidenceStatus === 'digital' && journal.attachments.length > 0) {
			pendingEvidenceStatus = nextStatus;
			evidenceChangeDialogOpen = true;
			return;
		}

		onupdate({ ...journal, evidenceStatus: nextStatus });
	}

	// 証跡ステータス変更を確定（添付ファイルを削除）
	async function confirmEvidenceStatusChange() {
		if (pendingEvidenceStatus === null) return;

		try {
			const updatedJournal = await confirmEvidenceStatusChangeUseCase({
				journal,
				nextStatus: pendingEvidenceStatus,
				directoryHandle
			});
			onupdate(updatedJournal);
		} catch (error) {
			console.error('添付ファイルの削除に失敗しました:', error);
		} finally {
			pendingEvidenceStatus = null;
			evidenceChangeDialogOpen = false;
		}
	}

	// 証跡ステータス変更をキャンセル
	function cancelEvidenceStatusChange() {
		pendingEvidenceStatus = null;
	}

	// フィールド更新（即時、証憑同期なし）
	function updateField<K extends keyof JournalEntry>(field: K, value: JournalEntry[K]) {
		onupdate({ ...journal, [field]: value });
	}

	// 日付のblurハンドラ（日付が変更された場合のみ親に伝播）
	async function handleDateBlur() {
		if (localDate !== journal.date) {
			updateField('date', localDate);
		}
		// 証憑同期
		await syncAttachmentsOnBlur();
	}

	// 取引先保存と証憑同期（blurタイミング）
	async function handleVendorBlur() {
		// 取引先を保存（入力完了時のみ）
		await saveVendorIfNeeded(journal.vendor);
		// 証憑同期
		await syncAttachmentsOnBlur();
	}

	// 証憑同期（blurタイミングで呼ばれる）
	async function syncAttachmentsOnBlur() {
		if (journal.attachments.length === 0) return;

		// メイン借方行の金額を取得
		const mainDebitAmount =
			journal.lines.find((l) => l.type === 'debit' && l.accountCode)?.amount ?? 0;

		try {
			const syncedAttachments = await syncAttachmentsOnBlurUseCase({
				journal,
				mainDebitAmount,
				directoryHandle
			});
			if (syncedAttachments) {
				onupdate({ ...journal, attachments: syncedAttachments });
			}
		} catch (error) {
			console.error('証憑の同期に失敗:', error);
		}
	}

	// 仕訳行の更新（即時、証憑同期はblurで実行）
	function updateLine(
		lineId: string,
		field: keyof JournalLine,
		value: string | number | TaxCategory | undefined
	) {
		const targetLine = journal.lines.find((l) => l.id === lineId);

		// 按分適用済みの行の金額変更 → 自動再計算
		if (
			field === 'amount' &&
			targetLine?._businessRatioApplied &&
			targetLine._businessRatio !== undefined
		) {
			const newTotal = Number(value);
			const ratio = targetLine._businessRatio;
			const businessAmount = Math.floor((newTotal * ratio) / 100);
			const personalAmount = newTotal - businessAmount;

			const newLines = journal.lines.map((line) => {
				if (line.id === lineId) {
					// 事業分を更新
					return { ...line, amount: businessAmount, _originalAmount: newTotal };
				} else if (line._businessRatioGenerated) {
					// 家事分（事業主貸）を更新
					return { ...line, amount: personalAmount };
				}
				return line;
			});
			onupdate({ ...journal, lines: newLines });
			return;
		}

		// 通常の更新
		const newLines = journal.lines.map((line) =>
			line.id === lineId ? { ...line, [field]: value } : line
		);
		onupdate({ ...journal, lines: newLines });
	}

	// 勘定科目変更時（デフォルト税区分も自動設定）
	function handleAccountChange(lineId: string, accountCode: string) {
		const defaultTaxCategory = getAccountDefaultTaxCategory(accountCode);
		const newLines = journal.lines.map((line) =>
			line.id === lineId
				? { ...line, accountCode, taxCategory: defaultTaxCategory ?? line.taxCategory }
				: line
		);
		onupdate({ ...journal, lines: newLines });
	}

	// 貸方金額でTabキー押下時、最後の行なら取引先にフォーカス移動
	function handleCreditAmountKeydown(e: KeyboardEvent, lineId: string) {
		if (e.key === 'Tab' && !e.shiftKey) {
			// 最後の貸方行かチェック
			const lastCreditLine = creditLines[creditLines.length - 1];
			if (lastCreditLine?.id === lineId) {
				e.preventDefault();
				vendorInputRef?.focus();
			}
		}
	}

	// 取引先でTabキー押下時、PDFドロップゾーンにフォーカス移動
	function handleVendorKeydown(e: KeyboardEvent) {
		if (e.key === 'Tab' && !e.shiftKey) {
			e.preventDefault();
			pdfDropZoneRef?.focus();
		}
	}

	// PDFドロップゾーンでTabキー押下時、日付にフォーカス移動（循環）
	function handlePdfKeydown(e: KeyboardEvent) {
		if (e.key === 'Tab' && !e.shiftKey) {
			e.preventDefault();
			dateInputRef?.focus();
		}
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
			const updatedJournal = await addJournalAttachment({
				journal,
				file: pendingFile,
				documentDate,
				documentType,
				generatedName,
				updatedVendor,
				mainAmount,
				directoryHandle
			});
			onupdate(updatedJournal);
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
			const updatedJournal = await removeJournalAttachment({
				journal,
				attachmentId,
				directoryHandle
			});
			onupdate(updatedJournal);
		} catch (error) {
			console.error('添付ファイルの削除に失敗しました:', error);
		}
	}

	// 添付ファイルのプレビュー
	async function handlePreviewAttachment(attachment: Attachment) {
		await previewJournalAttachment({ journal, attachment, directoryHandle });
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
			const updatedJournal = await updateJournalAttachment({
				journal,
				attachmentId: editingAttachment.id,
				updates,
				directoryHandle
			});
			onupdate(updatedJournal);
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

	// 家事按分を適用
	function handleApplyBusinessRatio(targetLineIndex: number, businessRatio: number) {
		const result = applyBusinessRatio({
			lines: journal.lines,
			targetLineIndex,
			businessRatio
		});
		onupdate({ ...journal, lines: result.lines });
	}

	// 家事按分を解除
	function handleRemoveBusinessRatio() {
		const restoredLines = removeBusinessRatio(journal.lines);
		onupdate({ ...journal, lines: restoredLines });
	}
</script>

<div
	class={cn(
		'flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-sm transition-all journal:flex-row',
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
		<div class="mb-3 flex flex-col gap-2 journal:flex-row journal:items-center journal:gap-3">
			<!-- 証跡ステータス + 日付 + 摘要 -->
			<div class="flex min-w-0 flex-1 items-center gap-2">
				<!-- 証跡ステータス -->
				<Tooltip.Provider>
					<Tooltip.Root>
						<Tooltip.Trigger>
							<button type="button" class="p-1" onclick={cycleEvidenceStatus} tabindex={-1}>
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

				<!-- 日付（blurタイミングでのみ保存、入力中の自動ソートを防止） -->
				<Input
					bind:ref={dateInputRef}
					type="date"
					value={localDate}
					oninput={(e) => (localDate = e.currentTarget.value)}
					onblur={handleDateBlur}
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
			<div class="flex items-center gap-2 pl-8 journal:pl-0">
				<!-- 取引先 -->
				<VendorInput
					bind:this={vendorInputRef}
					{vendors}
					value={journal.vendor}
					onchange={(name) => updateField('vendor', name)}
					onblur={handleVendorBlur}
					onkeydown={handleVendorKeydown}
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

		<!-- 仕訳行 -->
		<div class="grid grid-cols-2 gap-4">
			<!-- 借方 -->
			<div class="space-y-3">
				<div class="flex items-center gap-2 text-sm font-medium text-muted-foreground">
					借方

					<!-- 家事按分ボタン（インライン） -->
					{#if isBusinessRatioApplied}
						<button
							type="button"
							class="flex items-center gap-1 rounded-full border border-amber-500/50 bg-amber-50 px-2 py-0.5 text-xs text-amber-700 transition-colors hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50"
							onclick={handleRemoveBusinessRatio}
							tabindex={-1}
						>
							<Percent class="size-3" />
							{appliedBusinessRatio}%
							<X class="size-3" />
						</button>
					{:else if businessRatioTarget}
						<button
							type="button"
							class="flex items-center gap-1 rounded-full border border-amber-500/50 bg-amber-50 px-2 py-0.5 text-xs text-amber-700 transition-colors hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50"
							onclick={() =>
								handleApplyBusinessRatio(
									businessRatioTarget.index,
									businessRatioTarget.account.defaultBusinessRatio ?? 50
								)}
							tabindex={-1}
						>
							<Percent class="size-3" />
							按分適用
						</button>
					{/if}

					<span class="ml-auto font-mono">{validation.debitTotal.toLocaleString('ja-JP')}円</span>
					<Tooltip.Provider>
						<Tooltip.Root>
							<Tooltip.Trigger>
								<Button
									variant="ghost"
									size="icon"
									class="size-6 text-foreground"
									onclick={() => addLine('debit')}
									tabindex={-1}
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
					<div class="flex flex-col gap-1 journal:flex-row journal:items-center journal:gap-2">
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
								onchange={(code) => handleAccountChange(line.id, code)}
								class="min-w-0 flex-1"
							/>
						</div>
						<!-- 税区分 + 金額 + 削除ボタン -->
						<div class="flex items-center gap-1 pl-9 journal:pl-0">
							<TaxCategorySelect
								value={line.taxCategory}
								onchange={(cat) => updateLine(line.id, 'taxCategory', cat)}
								tabindex={-1}
							/>
							<Input
								type="number"
								value={line.amount}
								onchange={(e) => updateLine(line.id, 'amount', Number(e.currentTarget.value))}
								onblur={syncAttachmentsOnBlur}
								onfocus={(e) => e.currentTarget.select()}
								placeholder="金額"
								class={cn(
									'w-full text-right font-mono journal:w-24',
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
									tabindex={-1}
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
									tabindex={-1}
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
					<div class="flex flex-col gap-1 journal:flex-row journal:items-center journal:gap-2">
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
								onchange={(code) => handleAccountChange(line.id, code)}
								class="min-w-0 flex-1"
							/>
						</div>
						<!-- 税区分 + 金額 + 削除ボタン -->
						<div class="flex items-center gap-1 pl-9 journal:pl-0">
							<TaxCategorySelect
								value={line.taxCategory}
								onchange={(cat) => updateLine(line.id, 'taxCategory', cat)}
								tabindex={-1}
							/>
							<Input
								type="number"
								value={line.amount}
								onchange={(e) => updateLine(line.id, 'amount', Number(e.currentTarget.value))}
								onblur={syncAttachmentsOnBlur}
								onfocus={(e) => e.currentTarget.select()}
								onkeydown={(e) => handleCreditAmountKeydown(e, line.id)}
								placeholder="金額"
								class={cn(
									'w-full text-right font-mono journal:w-24',
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
									tabindex={-1}
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
				{#if validation.hasEmptyAccounts}
					勘定科目が選択されていない行があります
				{:else if validation.debitTotal !== validation.creditTotal}
					借方合計と貸方合計が一致しません（差額: {Math.abs(
						validation.debitTotal - validation.creditTotal
					).toLocaleString()}円）
				{/if}
			</div>
		{/if}
	</div>

	<!-- PDF添付エリア（デスクトップ: 右側、モバイル: 下部） -->
	<div class="w-full journal:w-24 journal:shrink-0">
		<PdfDropZone
			bind:this={pdfDropZoneRef}
			attachments={journal.attachments}
			onattach={handleFileDrop}
			onremove={handleRemoveAttachment}
			onpreview={handlePreviewAttachment}
			onedit={handleEditAttachment}
			vendorMissing={!journal.vendor.trim()}
			vertical
			tabindex={-1}
			onkeydown={handlePdfKeydown}
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

<!-- 証跡ステータス変更確認ダイアログ -->
<AlertDialog.Root bind:open={evidenceChangeDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>添付ファイルを削除しますか？</AlertDialog.Title>
			<AlertDialog.Description>
				電子証憑から他のステータスに変更すると、紐付けられている添付ファイル（{journal.attachments
					.length}件）が削除されます。この操作は取り消せません。
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel onclick={cancelEvidenceStatusChange}>キャンセル</AlertDialog.Cancel>
			<AlertDialog.Action
				class="bg-destructive/80 text-white hover:bg-destructive/70"
				onclick={confirmEvidenceStatusChange}
			>
				削除して変更
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
