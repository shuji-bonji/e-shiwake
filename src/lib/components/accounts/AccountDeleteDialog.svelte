<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { deleteAccount, isAccountInUse } from '$lib/db';
	import type { Account } from '$lib/types';

	interface Props {
		open: boolean;
		account: Account | null;
		ondelete: () => void;
	}

	let { open = $bindable(), account, ondelete }: Props = $props();

	let isUsed = $state(false);

	// ダイアログが開いた時に使用状況をチェック
	$effect(() => {
		if (open && account) {
			isAccountInUse(account.code).then((result) => (isUsed = result));
		}
	});

	async function handleDelete() {
		if (!account) return;

		try {
			await deleteAccount(account.code);
			open = false;
			ondelete();
		} catch (error) {
			console.error('Delete failed:', error);
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>勘定科目を削除</Dialog.Title>
			<Dialog.Description>
				{#if account}
					「{account.name}」を削除しますか？
				{/if}
			</Dialog.Description>
		</Dialog.Header>
		{#if isUsed}
			<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
				この勘定科目は仕訳で使用されているため削除できません。
			</div>
		{/if}
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)}>キャンセル</Button>
			<Button variant="destructive" onclick={handleDelete} disabled={isUsed}>削除</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
