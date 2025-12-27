<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Plus } from '@lucide/svelte';

	// ダミーデータ（後で IndexedDB から取得）
	const journals: Array<{
		id: string;
		date: string;
		description: string;
		vendor: string;
		evidenceStatus: 'none' | 'paper' | 'digital';
		debitAccount: string;
		debitAmount: number;
		creditAccount: string;
		creditAmount: number;
	}> = [];
</script>

<div class="space-y-4">
	<!-- ヘッダー -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold">仕訳帳</h1>
			<p class="text-sm text-muted-foreground">2024年度</p>
		</div>
		<Button>
			<Plus class="mr-2 size-4" />
			新規仕訳
		</Button>
	</div>

	<!-- 検索・フィルター -->
	<div class="flex items-center gap-2">
		<input
			type="text"
			placeholder="検索..."
			class="h-9 w-full max-w-sm rounded-md border border-input bg-background px-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
		/>
	</div>

	<!-- 仕訳リスト -->
	{#if journals.length === 0}
		<div
			class="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center"
		>
			<div class="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
				<div
					class="flex size-20 items-center justify-center rounded-full bg-muted"
					aria-hidden="true"
				>
					<Plus class="size-10 text-muted-foreground" />
				</div>
				<h3 class="mt-4 text-lg font-semibold">仕訳がありません</h3>
				<p class="mb-4 mt-2 text-sm text-muted-foreground">
					「新規仕訳」ボタンから最初の仕訳を追加しましょう
				</p>
				<Button>
					<Plus class="mr-2 size-4" />
					新規仕訳を追加
				</Button>
			</div>
		</div>
	{:else}
		<div class="space-y-2">
			{#each journals as journal (journal.id)}
				<div class="rounded-lg border p-4">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<span class="text-sm text-muted-foreground">{journal.date}</span>
							<span class="font-medium">{journal.description}</span>
							<span class="text-sm text-muted-foreground">{journal.vendor}</span>
						</div>
						<button class="text-muted-foreground hover:text-destructive">
							<span class="sr-only">削除</span>
							&times;
						</button>
					</div>
					<div class="mt-2 flex items-center gap-4 text-sm">
						<div class="flex items-center gap-2">
							<span class="text-muted-foreground">借方:</span>
							<span>{journal.debitAccount}</span>
							<span class="font-medium">{journal.debitAmount.toLocaleString()}円</span>
						</div>
						<div class="flex items-center gap-2">
							<span class="text-muted-foreground">貸方:</span>
							<span>{journal.creditAccount}</span>
							<span class="font-medium">{journal.creditAmount.toLocaleString()}円</span>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
