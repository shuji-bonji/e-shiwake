<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Smartphone, AlertTriangle, Lightbulb } from '@lucide/svelte';

	interface Props {
		open: boolean;
		onclose?: () => void;
		onconfirm: () => void;
	}

	let { open, onclose, onconfirm }: Props = $props();

	let dontShowAgain = $state(false);

	function handleConfirm() {
		if (dontShowAgain) {
			localStorage.setItem('shownStorageWarning', 'true');
		}
		onconfirm();
	}

	function handleOpenChange(isOpen: boolean) {
		if (!isOpen) onclose?.();
	}
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				<Smartphone class="size-5" />
				お使いの環境について
			</Dialog.Title>
		</Dialog.Header>

		<div class="space-y-4 py-4">
			<p class="text-sm text-muted-foreground">
				Safari ではファイルへの直接保存に対応していないため、
				証憑は一時的にブラウザ内に保存されます。
			</p>

			<div
				class="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950"
			>
				<AlertTriangle class="mt-0.5 size-4 shrink-0 text-amber-500" />
				<p class="text-sm text-amber-800 dark:text-amber-200">
					電子帳簿保存法の要件を満たすため、<br />
					<strong>月1回のエクスポート</strong>をお願いします。
				</p>
			</div>

			<div class="flex items-start gap-3 rounded-lg border p-3">
				<Lightbulb class="mt-0.5 size-4 shrink-0 text-blue-500" />
				<p class="text-sm text-muted-foreground">
					Chrome / Edge をお使いいただくと、<br />
					ファイルとして直接保存できます。
				</p>
			</div>

			<div class="flex items-center space-x-2">
				<Checkbox id="dont-show" bind:checked={dontShowAgain} />
				<Label for="dont-show" class="text-sm font-normal">今後表示しない</Label>
			</div>
		</div>

		<Dialog.Footer>
			<Button onclick={handleConfirm}>OK</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
