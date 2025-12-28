<script lang="ts">
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { Circle, FileText, Paperclip, Trash2, Plus, ArrowUp, ArrowDown } from '@lucide/svelte';
	import AccountSelect from './AccountSelect.svelte';
	import type { JournalEntry, JournalLine, Account, EvidenceStatus } from '$lib/types';
	import { validateJournal } from '$lib/db';
	import { cn } from '$lib/utils.js';

	interface Props {
		journal: JournalEntry;
		accounts: Account[];
		onupdate: (journal: JournalEntry) => void;
		ondelete: (id: string) => void;
	}

	let { journal, accounts, onupdate, ondelete }: Props = $props();

	// バリデーション
	const validation = $derived(validateJournal(journal));
	const debitLines = $derived(journal.lines.filter((l) => l.type === 'debit'));
	const creditLines = $derived(journal.lines.filter((l) => l.type === 'credit'));

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

	// 勘定科目名を取得
	function getAccountName(code: string): string {
		return accounts.find((a) => a.code === code)?.name ?? '';
	}

	// 勘定科目のタイプを取得
	function getAccountType(code: string): string {
		const account = accounts.find((a) => a.code === code);
		if (!account) return '';
		const labels: Record<string, string> = {
			asset: '資産',
			liability: '負債',
			equity: '純資産',
			revenue: '収益',
			expense: '費用'
		};
		return labels[account.type] ?? '';
	}
</script>

<div
	class={cn(
		'rounded-lg border bg-card p-4 shadow-sm',
		!validation.isValid && journal.lines.some((l) => l.amount > 0) && 'border-destructive'
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
						証跡なし
					{:else if journal.evidenceStatus === 'paper'}
						紙で保管
					{:else}
						電子データ紐付け済み
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
				<ArrowUp class="size-4 text-blue-500" />
				借方
				<span class="ml-auto font-mono">{validation.debitTotal.toLocaleString()}円</span>
			</div>
			{#each debitLines as line (line.id)}
				<div class="flex items-center gap-2">
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
			<Button variant="outline" size="sm" class="w-full" onclick={() => addLine('debit')}>
				<Plus class="mr-1 size-3" />
				借方行を追加
			</Button>
		</div>

		<!-- 貸方 -->
		<div class="space-y-2">
			<div class="flex items-center gap-2 text-sm font-medium text-muted-foreground">
				<ArrowDown class="size-4 text-red-500" />
				貸方
				<span class="ml-auto font-mono">{validation.creditTotal.toLocaleString()}円</span>
			</div>
			{#each creditLines as line (line.id)}
				<div class="flex items-center gap-2">
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
			<Button variant="outline" size="sm" class="w-full" onclick={() => addLine('credit')}>
				<Plus class="mr-1 size-3" />
				貸方行を追加
			</Button>
		</div>
	</div>

	<!-- バリデーションエラー表示 -->
	{#if !validation.isValid && journal.lines.some((l) => l.amount > 0)}
		<div class="mt-3 text-sm text-destructive">
			借方合計と貸方合計が一致しません（差額: {Math.abs(validation.debitTotal - validation.creditTotal).toLocaleString()}円）
		</div>
	{/if}
</div>
