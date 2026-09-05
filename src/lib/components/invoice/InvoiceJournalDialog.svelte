<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import type { Invoice } from '$lib/types/invoice';
	import type { Vendor } from '$lib/types';
	import { toast } from 'svelte-sonner';
	import { addJournal } from '$lib/db';
	import { generateSalesJournal, generateDepositJournal } from '$lib/utils/invoice-journal';
	import type { InvoiceSettlement } from '$lib/utils/invoice-settlement';
	import { formatCurrency } from '$lib/utils/invoice';

	/**
	 * 請求書から仕訳を生成するダイアログ
	 *
	 * 生成する仕訳には invoiceId を入れる（売掛金仕訳には generatedFrom: 'invoice' も付ける）。
	 * 作成後は仕訳帳の 1 件であり、請求書側は紐づく仕訳を集計して状態を導出するだけ。
	 * 作成済みかどうかの判定（ボタンの活性）は呼び出し側が settlement で行う。
	 */
	interface Props {
		open: boolean;
		journalType: 'sales' | 'deposit';
		invoice: Invoice | null;
		vendor: Vendor | null;
		/** 紐づく仕訳から導出した決済状態（入金額の初期値に使う） */
		settlement: InvoiceSettlement | null;
		/** 仕訳作成後に呼ばれる */
		onsave: (journalId: string) => void;
	}

	let { open = $bindable(), journalType, invoice, vendor, settlement, onsave }: Props = $props();

	let depositDate = $state(new Date().toISOString().slice(0, 10));
	let depositAmount = $state(0);

	// ダイアログが開いた時に入力値をリセットする
	$effect(() => {
		if (open) {
			depositDate = new Date().toISOString().slice(0, 10);
			// 入金額の初期値は未入金残額（紐づく入金仕訳がなければ税込合計）
			depositAmount = settlement?.remaining ?? invoice?.total ?? 0;
		}
	});

	async function createJournal() {
		if (!invoice) return;
		if (!vendor) {
			toast.error('取引先を選択してから仕訳を作成してください');
			return;
		}
		if (journalType === 'deposit' && (!Number.isFinite(depositAmount) || depositAmount <= 0)) {
			toast.error('入金額は 1 円以上を入力してください');
			return;
		}

		try {
			const journalData =
				journalType === 'sales'
					? generateSalesJournal(invoice, vendor)
					: generateDepositJournal(invoice, vendor, depositDate, '1003', depositAmount);
			const journalId = await addJournal(journalData);
			onsave(journalId);
			open = false;
			toast.success(
				journalType === 'sales' ? '売掛金仕訳を作成しました' : '入金仕訳を作成しました'
			);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : '仕訳の作成に失敗しました');
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>
				{journalType === 'sales' ? '売掛金仕訳を作成' : '売掛金入金仕訳を作成'}
			</Dialog.Title>
			<Dialog.Description>
				{#if journalType === 'sales'}
					請求書発行に対応する売掛金仕訳（借方 売掛金／貸方 売上高）を作成します。
					請求書の控え（PDF）を証憑にする場合は、作成後に仕訳帳でこの仕訳へドラッグ＆ドロップして添付してください。
				{:else}
					入金日と入金額を指定して入金仕訳（借方 普通預金／貸方 売掛金）を作成します。
				{/if}
			</Dialog.Description>
		</Dialog.Header>

		{#if journalType === 'deposit'}
			<div class="space-y-4 py-2">
				{#if settlement && settlement.depositedTotal > 0}
					<p class="text-sm text-muted-foreground">
						入金済 ¥{formatCurrency(settlement.depositedTotal)} / 税込合計 ¥{formatCurrency(
							invoice?.total ?? 0
						)}（残額 ¥{formatCurrency(settlement.remaining)}）
					</p>
				{/if}
				<div class="space-y-2">
					<Label for="depositDate">入金日</Label>
					<Input id="depositDate" type="date" bind:value={depositDate} />
				</div>
				<div class="space-y-2">
					<Label for="depositAmount">入金額（税込）</Label>
					<Input id="depositAmount" type="number" min="1" step="1" bind:value={depositAmount} />
					<p class="text-xs text-muted-foreground">
						分割入金の場合は今回の入金額を入力してください。初期値は未入金残額です。
					</p>
				</div>
			</div>
		{/if}

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)}>キャンセル</Button>
			<Button onclick={createJournal}>作成</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
