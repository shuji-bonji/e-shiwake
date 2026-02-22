<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import type { Invoice } from '$lib/types/invoice';
	import type { Vendor } from '$lib/types';
	import { toast } from 'svelte-sonner';
	import { addJournal, updateInvoice } from '$lib/db';
	import { generateSalesJournal, generateDepositJournal } from '$lib/utils/invoice-journal';

	interface Props {
		open: boolean;
		journalType: 'sales' | 'deposit';
		invoice: Invoice | null;
		invoiceId: string;
		vendor: Vendor | null;
		onsave: (journalId?: string) => void;
	}

	let { open = $bindable(), journalType, invoice, invoiceId, vendor, onsave }: Props = $props();

	let depositDate = $state(new Date().toISOString().slice(0, 10));

	// ダイアログが開いた時に入金日をリセット
	$effect(() => {
		if (open) {
			depositDate = new Date().toISOString().slice(0, 10);
		}
	});

	async function createJournal() {
		if (!invoice || !vendor) return;

		try {
			let journalData;
			if (journalType === 'sales') {
				journalData = generateSalesJournal(invoice, vendor);
			} else {
				journalData = generateDepositJournal(invoice, vendor, depositDate);
			}

			const journalId = await addJournal(journalData);

			// 売掛金仕訳の場合、請求書に仕訳IDを紐付け
			if (journalType === 'sales') {
				await updateInvoice(invoiceId, { journalId });
				onsave(journalId);
			} else {
				onsave();
			}

			open = false;
			toast.success('仕訳を作成しました');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : '仕訳の作成に失敗しました');
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>
				{journalType === 'sales' ? '売掛金仕訳を作成' : '入金仕訳を作成'}
			</Dialog.Title>
			<Dialog.Description>
				{#if journalType === 'sales'}
					請求書発行に対応する売掛金仕訳を作成します。
				{:else}
					入金日を指定して入金仕訳を作成します。
				{/if}
			</Dialog.Description>
		</Dialog.Header>
		{#if journalType === 'deposit'}
			<div class="space-y-2 py-4">
				<Label for="depositDate">入金日</Label>
				<Input id="depositDate" type="date" bind:value={depositDate} />
			</div>
		{/if}
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)}>キャンセル</Button>
			<Button onclick={createJournal}>作成</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
