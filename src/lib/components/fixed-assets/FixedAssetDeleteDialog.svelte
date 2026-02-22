<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { deleteFixedAsset } from '$lib/db';
	import type { FixedAsset } from '$lib/types/blue-return-types';

	interface Props {
		open: boolean;
		asset: FixedAsset | null;
		ondelete: () => void;
	}

	let { open = $bindable(), asset, ondelete }: Props = $props();

	async function handleDelete() {
		if (!asset) return;

		try {
			await deleteFixedAsset(asset.id);
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
			<Dialog.Title>固定資産を削除</Dialog.Title>
			<Dialog.Description>
				{#if asset}
					「{asset.name}」を削除しますか？ この操作は取り消せません。
				{/if}
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)}>キャンセル</Button>
			<Button variant="destructive" onclick={handleDelete}>削除</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
