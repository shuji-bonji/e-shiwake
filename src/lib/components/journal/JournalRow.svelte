<script lang="ts">
	import {
		generateAttachmentName,
		getSuppressRenameConfirm,
		setSuppressRenameConfirm,
		suggestDocumentType,
		validateJournal
	} from '$lib/db';
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
	import { toast } from 'svelte-sonner';
	import { fileExistsInDirectory } from '$lib/utils/filesystem';
	import {
		applyBusinessRatio,
		getAppliedBusinessRatio,
		getBusinessRatioTargetLine,
		hasBusinessRatioApplied,
		removeBusinessRatio
	} from '$lib/utils/business-ratio';
	import { supportsFileSystemAccess } from '$lib/utils/filesystem';
	import JournalLineGroup from './JournalLineGroup.svelte';
	import JournalRowDialogs from './JournalRowDialogs.svelte';
	import JournalRowHeader from './JournalRowHeader.svelte';
	import PdfDropZone from './PdfDropZone.svelte';

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

	// 証憑削除確認ダイアログの状態
	let removeAttachmentDialogOpen = $state(false);
	let pendingRemoveAttachmentId = $state<string | null>(null);

	// ファイル上書き確認ダイアログの状態
	let overwriteDialogOpen = $state(false);
	let overwriteFileName = $state('');
	let overwriteCallback: (() => Promise<void>) | null = $state(null);

	// 証憑リネーム確認ダイアログの状態
	let renameConfirmDialogOpen = $state(false);
	let renameConfirmSuppressCheck = $state(false);
	let pendingRenameInfo = $state<{
		oldNames: string[];
		newNames: string[];
		syncArgs: {
			journal: JournalEntry;
			mainDebitAmount: number;
			directoryHandle?: FileSystemDirectoryHandle | null;
		};
	} | null>(null);

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
	 */
	function getLineIndicator(
		side: 'debit' | 'credit',
		accountType: AccountType | null
	): { icon: 'up' | 'down' | null; label: string; color: string } {
		if (!accountType) {
			return { icon: null, label: '', color: '' };
		}

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
					return { icon: 'down', label: '収益', color: 'text-green-500' };
			}
		}

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

	// 日付変更ハンドラ（ローカル状態のみ更新）
	function handleDateChange(value: string) {
		localDate = value;
	}

	// 日付のblurハンドラ（日付が変更された場合のみ親に伝播）
	async function handleDateBlur() {
		if (localDate !== journal.date) {
			updateField('date', localDate);
		}
		await syncAttachmentsOnBlur();
	}

	// 取引先保存と証憑同期（blurタイミング）
	async function handleVendorBlur() {
		await saveVendorIfNeeded(journal.vendor);
		await syncAttachmentsOnBlur();
	}

	// 証憑同期（blurタイミングで呼ばれる）
	async function syncAttachmentsOnBlur() {
		if (journal.attachments.length === 0) return;

		const mainDebitAmount =
			journal.lines.find((l) => l.type === 'debit' && l.accountCode)?.amount ?? 0;

		const newNames = journal.attachments.map((att) =>
			generateAttachmentName(
				journal.date,
				att.documentType,
				journal.description,
				mainDebitAmount || att.amount,
				journal.vendor
			)
		);
		const oldNames = journal.attachments.map((att) => att.generatedName);
		const hasNameChanges = oldNames.some((name, i) => name !== newNames[i]);

		if (!hasNameChanges) return;

		const suppress = await getSuppressRenameConfirm();

		if (!suppress) {
			pendingRenameInfo = {
				oldNames,
				newNames,
				syncArgs: { journal, mainDebitAmount, directoryHandle }
			};
			renameConfirmSuppressCheck = false;
			renameConfirmDialogOpen = true;
			return;
		}

		await executeSyncAttachments(mainDebitAmount);
	}

	// リネーム確認OKの処理
	async function handleConfirmRename() {
		if (!pendingRenameInfo) return;

		if (renameConfirmSuppressCheck) {
			await setSuppressRenameConfirm(true);
		}

		const { mainDebitAmount } = pendingRenameInfo.syncArgs;
		renameConfirmDialogOpen = false;
		pendingRenameInfo = null;

		await executeSyncAttachments(mainDebitAmount);
	}

	// リネームキャンセル
	function handleCancelRename() {
		renameConfirmDialogOpen = false;
		pendingRenameInfo = null;
	}

	// リネーム実行
	async function executeSyncAttachments(mainDebitAmount: number) {
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
	function updateLine(lineId: string, field: string, value: unknown) {
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
					return { ...line, amount: businessAmount, _originalAmount: newTotal };
				} else if (line._businessRatioGenerated) {
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
		if (journal.lines.length <= 2) return;
		onupdate({ ...journal, lines: journal.lines.filter((l) => l.id !== lineId) });
	}

	// Safari判定
	function isSafari(): boolean {
		if (typeof navigator === 'undefined') return false;
		const ua = navigator.userAgent;
		return /Safari/.test(ua) && !/Chrome|CriOS|Edg/.test(ua);
	}

	// Safari向け警告が必要かチェック
	function shouldShowSafariWarning(): boolean {
		const needsWarning = !supportsFileSystemAccess() || isSafari();
		if (!needsWarning) return false;
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

	// ダイアログで確定 → 同名チェック → 実際に添付
	async function handleAttachmentConfirm(
		documentDate: string,
		documentType: DocumentType,
		generatedName: string,
		updatedVendor: string
	) {
		if (!pendingFile) return;

		try {
			let fileExists = false;

			if (directoryHandle) {
				const year = new Date(documentDate).getFullYear();
				fileExists = await fileExistsInDirectory(directoryHandle, year, generatedName);
			} else {
				fileExists = journal.attachments.some((a) => a.generatedName === generatedName);
			}

			const doAdd = async () => {
				let targetJournal = journal;
				if (fileExists) {
					const existingAttachment = journal.attachments.find(
						(a) => a.generatedName === generatedName
					);
					if (existingAttachment) {
						targetJournal = await removeJournalAttachment({
							journal,
							attachmentId: existingAttachment.id,
							directoryHandle
						});
					}
				}

				const updatedJournal = await addJournalAttachment({
					journal: targetJournal,
					file: pendingFile!,
					documentDate,
					documentType,
					generatedName,
					updatedVendor,
					mainAmount,
					directoryHandle
				});
				onupdate(updatedJournal);
				pendingFile = null;
			};

			if (fileExists) {
				overwriteFileName = generatedName;
				overwriteCallback = doAdd;
				overwriteDialogOpen = true;
				return;
			}

			await doAdd();
		} catch (error) {
			console.error('添付ファイルの追加に失敗しました:', error);
			toast.error('添付ファイルの追加に失敗しました');
		} finally {
			pendingFile = null;
		}
	}

	// ダイアログでキャンセル
	function handleAttachmentCancel() {
		pendingFile = null;
	}

	// 添付ファイルの削除確認
	function handleRemoveAttachment(attachmentId: string) {
		pendingRemoveAttachmentId = attachmentId;
		removeAttachmentDialogOpen = true;
	}

	// 添付ファイルの削除実行
	async function handleConfirmRemoveAttachment() {
		if (!pendingRemoveAttachmentId) return;
		try {
			const updatedJournal = await removeJournalAttachment({
				journal,
				attachmentId: pendingRemoveAttachmentId,
				directoryHandle
			});
			onupdate(updatedJournal);
		} catch (error) {
			console.error('添付ファイルの削除に失敗しました:', error);
		} finally {
			removeAttachmentDialogOpen = false;
			pendingRemoveAttachmentId = null;
		}
	}

	// 添付ファイルの削除キャンセル
	function handleCancelRemoveAttachment() {
		removeAttachmentDialogOpen = false;
		pendingRemoveAttachmentId = null;
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
		generatedName?: string;
	}) {
		if (!editingAttachment) return;

		try {
			const newName =
				updates.generatedName ||
				generateAttachmentName(
					updates.documentDate,
					updates.documentType,
					updates.description,
					updates.amount,
					updates.vendor
				);
			if (newName !== editingAttachment.generatedName && directoryHandle) {
				const year = new Date(updates.documentDate).getFullYear();
				const exists = await fileExistsInDirectory(directoryHandle, year, newName);
				if (exists) {
					overwriteFileName = newName;
					overwriteCallback = async () => {
						try {
							const updatedJournal = await updateJournalAttachment({
								journal,
								attachmentId: editingAttachment!.id,
								updates,
								directoryHandle
							});
							onupdate(updatedJournal);
						} catch (error) {
							console.error('添付ファイルの更新に失敗しました:', error);
							toast.error('添付ファイルの更新に失敗しました');
						} finally {
							editingAttachment = null;
						}
					};
					overwriteDialogOpen = true;
					return;
				}
			}

			const updatedJournal = await updateJournalAttachment({
				journal,
				attachmentId: editingAttachment.id,
				updates,
				directoryHandle
			});
			onupdate(updatedJournal);
		} catch (error) {
			console.error('添付ファイルの更新に失敗しました:', error);
			toast.error('添付ファイルの更新に失敗しました');
		} finally {
			editingAttachment = null;
		}
	}

	// ファイル上書き確認ダイアログのハンドラー
	async function handleOverwriteConfirm() {
		overwriteDialogOpen = false;
		if (overwriteCallback) {
			await overwriteCallback();
			overwriteCallback = null;
		}
	}

	function handleOverwriteCancel() {
		overwriteDialogOpen = false;
		overwriteCallback = null;
		pendingFile = null;
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
		<!-- ヘッダー行 -->
		<JournalRowHeader
			{journal}
			{vendors}
			{localDate}
			{validation}
			{isEditing}
			onupdatefield={updateField}
			ondatechange={handleDateChange}
			ondateblur={handleDateBlur}
			onvendorblur={handleVendorBlur}
			onsyncblur={syncAttachmentsOnBlur}
			oncyclestatus={cycleEvidenceStatus}
			{onconfirm}
			{oncopy}
			{ondelete}
			onvendorkeydown={handleVendorKeydown}
			bind:dateInputRef
			bind:vendorInputRef
		/>

		<!-- 仕訳行 -->
		<div class="grid grid-cols-2 gap-4">
			<!-- 借方 -->
			<JournalLineGroup
				side="debit"
				lines={debitLines}
				{accounts}
				total={validation.debitTotal}
				{isEditing}
				isValid={validation.isValid}
				{businessRatioTarget}
				{isBusinessRatioApplied}
				{appliedBusinessRatio}
				getlineIndicator={getLineIndicator}
				getaccounttype={getAccountType}
				onaccountchange={handleAccountChange}
				onupdateline={updateLine}
				onremoveline={removeLine}
				onaddline={addLine}
				onsyncblur={syncAttachmentsOnBlur}
				onapplyratio={handleApplyBusinessRatio}
				onremoveratio={handleRemoveBusinessRatio}
			/>

			<!-- 貸方 -->
			<JournalLineGroup
				side="credit"
				lines={creditLines}
				{accounts}
				total={validation.creditTotal}
				{isEditing}
				isValid={validation.isValid}
				getlineIndicator={getLineIndicator}
				getaccounttype={getAccountType}
				onaccountchange={handleAccountChange}
				onupdateline={updateLine}
				onremoveline={removeLine}
				onaddline={addLine}
				onsyncblur={syncAttachmentsOnBlur}
				onkeydown={handleCreditAmountKeydown}
			/>
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

<!-- ダイアログ群 -->
<JournalRowDialogs
	{journal}
	{vendors}
	bind:safariDialogOpen
	onsafaridialogconfirm={handleSafariDialogConfirm}
	bind:attachmentDialogOpen
	{pendingFile}
	{mainAmount}
	{suggestedDocType}
	onattachmentconfirm={handleAttachmentConfirm}
	onattachmentcancel={handleAttachmentCancel}
	bind:editDialogOpen
	{editingAttachment}
	oneditconfirm={handleEditConfirm}
	oneditcancel={handleEditCancel}
	bind:evidenceChangeDialogOpen
	attachmentCount={journal.attachments.length}
	onconfirmstatuschange={confirmEvidenceStatusChange}
	oncancelstatuschange={cancelEvidenceStatusChange}
	bind:removeAttachmentDialogOpen
	{pendingRemoveAttachmentId}
	onconfirmremoveattachment={handleConfirmRemoveAttachment}
	oncancelremoveattachment={handleCancelRemoveAttachment}
	bind:renameConfirmDialogOpen
	{renameConfirmSuppressCheck}
	{pendingRenameInfo}
	onconfirmrename={handleConfirmRename}
	oncancelrename={handleCancelRename}
	onsuppresschange={(checked) => (renameConfirmSuppressCheck = checked)}
	bind:overwriteDialogOpen
	{overwriteFileName}
	onconfirmoverwrite={handleOverwriteConfirm}
	oncanceloverwrite={handleOverwriteCancel}
/>
