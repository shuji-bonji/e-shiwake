<script lang="ts">
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { Circle, FileText, Paperclip, Trash2, Plus, ArrowUp, ArrowDown, Check } from '@lucide/svelte';
	import AccountSelect from './AccountSelect.svelte';
	import type { JournalEntry, JournalLine, Account, AccountType, EvidenceStatus } from '$lib/types';
	import { validateJournal } from '$lib/db';
	import { cn } from '$lib/utils.js';

	interface Props {
		journal: JournalEntry;
		accounts: Account[];
		isEditing?: boolean;
		isFlashing?: boolean;
		onupdate: (journal: JournalEntry) => void;
		ondelete: (id: string) => void;
		onconfirm?: (id: string) => void;
	}

	let { journal, accounts, isEditing = false, isFlashing = false, onupdate, ondelete, onconfirm }: Props = $props();

	// バリデーション
	const validation = $derived(validateJournal(journal));
	const debitLines = $derived(journal.lines.filter((l) => l.type === 'debit'));
	const creditLines = $derived(journal.lines.filter((l) => l.type === 'credit'));

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

	// フィールド更新
	function updateField<K extends keyof JournalEntry>(field: K, value: JournalEntry[K]) {
		onupdate({ ...journal, [field]: value });
	}

	// 仕訳行の更新
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
</script>

<div
	class={cn(
		'rounded-lg border bg-card p-4 shadow-sm transition-all',
		isEditing && 'border-primary ring-2 ring-primary/20',
		isFlashing && 'animate-flash',
		!isEditing && !validation.isValid && journal.lines.some((l) => l.amount > 0) && 'border-destructive'
	)}
>
	<!-- ヘッダー行: 証跡ステータス、日付、摘要、取引先、削除ボタン -->
	<div class="mb-3 flex items-center gap-3">
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
			class="w-36"
		/>

		<!-- 摘要 -->
		<Input
			type="text"
			value={journal.description}
			oninput={(e) => updateField('description', e.currentTarget.value)}
			placeholder="摘要"
			class="flex-1"
		/>

		<!-- 取引先 -->
		<Input
			type="text"
			value={journal.vendor}
			oninput={(e) => updateField('vendor', e.currentTarget.value)}
			placeholder="取引先"
			class="w-40"
		/>

		<!-- 確定ボタン（編集中のみ表示） -->
		{#if isEditing && onconfirm}
			<Button variant="default" size="sm" class="gap-1" onclick={() => onconfirm(journal.id)}>
				<Check class="size-4" />
				確定
			</Button>
		{/if}

		<!-- 削除ボタン -->
		<Button variant="ghost" size="icon" class="text-destructive" onclick={() => ondelete(journal.id)}>
			<Trash2 class="size-4" />
		</Button>
	</div>

	<!-- 仕訳行 -->
	<div class="grid grid-cols-2 gap-4">
		<!-- 借方 -->
		<div class="space-y-2">
			<div class="flex items-center gap-2 text-sm font-medium text-muted-foreground">
				借方
				<span class="ml-auto font-mono">{validation.debitTotal.toLocaleString()}円</span>
			</div>
			{#each debitLines as line (line.id)}
				{@const accountType = getAccountType(line.accountCode)}
				{@const indicator = getLineIndicator('debit', accountType)}
				<div class="flex items-center gap-2">
					<!-- 種別アイコン -->
					<Tooltip.Provider>
						<Tooltip.Root>
							<Tooltip.Trigger>
								<div class={cn('flex size-8 items-center justify-center rounded', indicator.color)}>
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
						class="flex-1"
					/>
					<Input
						type="number"
						value={line.amount}
						onchange={(e) => updateLine(line.id, 'amount', Number(e.currentTarget.value))}
						class="w-28 text-right font-mono"
						min="0"
					/>
					{#if debitLines.length > 1}
						<Button variant="ghost" size="icon" class="size-8" onclick={() => removeLine(line.id)}>
							<Trash2 class="size-3" />
						</Button>
					{/if}
				</div>
			{/each}
			<!-- 借方追加ボタン -->
			<Tooltip.Provider>
				<Tooltip.Root>
					<Tooltip.Trigger class="w-full">
						<Button variant="outline" size="sm" class="w-full" onclick={() => addLine('debit')}>
							<Plus class="mr-1 size-3" />
							借方行を追加
						</Button>
					</Tooltip.Trigger>
					<Tooltip.Content>
						<div class="text-xs">
							<div class="font-medium mb-1">借方に来る科目：</div>
							<div class="flex items-center gap-1"><ArrowUp class="size-3 text-blue-500" />資産の増加</div>
							<div class="flex items-center gap-1"><ArrowUp class="size-3 text-red-500" />費用の発生</div>
							<div class="flex items-center gap-1"><ArrowDown class="size-3 text-purple-500" />負債の減少</div>
						</div>
					</Tooltip.Content>
				</Tooltip.Root>
			</Tooltip.Provider>
		</div>

		<!-- 貸方 -->
		<div class="space-y-2">
			<div class="flex items-center gap-2 text-sm font-medium text-muted-foreground">
				貸方
				<span class="ml-auto font-mono">{validation.creditTotal.toLocaleString()}円</span>
			</div>
			{#each creditLines as line (line.id)}
				{@const accountType = getAccountType(line.accountCode)}
				{@const indicator = getLineIndicator('credit', accountType)}
				<div class="flex items-center gap-2">
					<!-- 種別アイコン -->
					<Tooltip.Provider>
						<Tooltip.Root>
							<Tooltip.Trigger>
								<div class={cn('flex size-8 items-center justify-center rounded', indicator.color)}>
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
						class="flex-1"
					/>
					<Input
						type="number"
						value={line.amount}
						onchange={(e) => updateLine(line.id, 'amount', Number(e.currentTarget.value))}
						class="w-28 text-right font-mono"
						min="0"
					/>
					{#if creditLines.length > 1}
						<Button variant="ghost" size="icon" class="size-8" onclick={() => removeLine(line.id)}>
							<Trash2 class="size-3" />
						</Button>
					{/if}
				</div>
			{/each}
			<!-- 貸方追加ボタン -->
			<Tooltip.Provider>
				<Tooltip.Root>
					<Tooltip.Trigger class="w-full">
						<Button variant="outline" size="sm" class="w-full" onclick={() => addLine('credit')}>
							<Plus class="mr-1 size-3" />
							貸方行を追加
						</Button>
					</Tooltip.Trigger>
					<Tooltip.Content>
						<div class="text-xs">
							<div class="font-medium mb-1">貸方に来る科目：</div>
							<div class="flex items-center gap-1"><ArrowDown class="size-3 text-blue-500" />資産の減少</div>
							<div class="flex items-center gap-1"><ArrowUp class="size-3 text-purple-500" />負債の増加</div>
							<div class="flex items-center gap-1"><ArrowUp class="size-3 text-green-500" />収益の発生</div>
						</div>
					</Tooltip.Content>
				</Tooltip.Root>
			</Tooltip.Provider>
		</div>
	</div>

	<!-- バリデーションエラー表示 -->
	{#if !validation.isValid && journal.lines.some((l) => l.amount > 0)}
		<div class="mt-3 text-sm text-destructive">
			借方合計と貸方合計が一致しません（差額: {Math.abs(validation.debitTotal - validation.creditTotal).toLocaleString()}円）
		</div>
	{/if}
</div>
