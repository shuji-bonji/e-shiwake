<script lang="ts">
	import type { Invoice } from '$lib/types/invoice';
	import type { Vendor } from '$lib/types';
	import type { BusinessInfo } from '$lib/types/blue-return-types';
	import { AccountTypeLabels } from '$lib/types/blue-return-types';
	import { formatCurrency } from '$lib/utils/invoice';

	interface Props {
		invoice: Invoice;
		vendor: Vendor | null;
		businessInfo: BusinessInfo | null;
	}

	const { invoice, vendor, businessInfo }: Props = $props();

	// 空行のインデックス配列（最低10行表示用）
	const emptyRowIndices = $derived(
		Array.from({ length: Math.max(0, 10 - invoice.items.length) }, (_, i) => i)
	);
</script>

<div class="invoice-print">
	<!-- タイトル -->
	<h1 class="invoice-title">請求書</h1>

	<!-- ヘッダー部 -->
	<div class="invoice-header">
		<!-- 宛先（左側） -->
		<div class="invoice-recipient">
			{#if vendor}
				<div class="recipient-name">{vendor.name} 御中</div>
				{#if vendor.address}
					<div class="recipient-address">{vendor.address}</div>
				{/if}
			{:else}
				<div class="recipient-name">（宛先未設定）</div>
			{/if}
		</div>

		<!-- 発行者情報（右側） -->
		<div class="invoice-issuer">
			<div class="invoice-meta">
				<div class="invoice-number">No. {invoice.invoiceNumber}</div>
				<div class="invoice-date">発行日: {invoice.issueDate}</div>
				<div class="invoice-due">支払期限: {invoice.dueDate}</div>
			</div>
			{#if businessInfo}
				<div class="issuer-info">
					{#if businessInfo.tradeName}
						<div class="issuer-trade-name">{businessInfo.tradeName}</div>
					{/if}
					<div class="issuer-name">{businessInfo.name}</div>
					<div class="issuer-address">{businessInfo.address}</div>
					{#if businessInfo.phoneNumber || businessInfo.email}
						<div class="issuer-contact">
							{#if businessInfo.phoneNumber}
								<span class="issuer-phone">TEL: {businessInfo.phoneNumber}</span>
							{/if}
							{#if businessInfo.email}
								<span class="issuer-email">{businessInfo.email}</span>
							{/if}
						</div>
					{/if}
					{#if businessInfo.invoiceRegistrationNumber}
						<div class="issuer-invoice-number">
							登録番号: {businessInfo.invoiceRegistrationNumber}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<!-- 請求金額サマリー -->
	<div class="invoice-summary">
		<div class="summary-label">ご請求金額</div>
		<div class="summary-amount">¥{formatCurrency(invoice.total)}-</div>
	</div>

	<!-- 明細テーブル -->
	<table class="invoice-items">
		<thead>
			<tr>
				<th class="col-date">日付</th>
				<th class="col-description">品名・サービス名</th>
				<th class="col-unit-price">単価</th>
				<th class="col-quantity">数量</th>
				<th class="col-tax-rate">税率</th>
				<th class="col-amount">金額</th>
			</tr>
		</thead>
		<tbody>
			{#each invoice.items as item (item.id)}
				<tr>
					<td class="col-date">{item.date}</td>
					<td class="col-description">{item.description}</td>
					<td class="col-unit-price">¥{formatCurrency(item.unitPrice)}</td>
					<td class="col-quantity">{item.quantity}</td>
					<td class="col-tax-rate">{item.taxRate}%</td>
					<td class="col-amount">¥{formatCurrency(item.amount)}</td>
				</tr>
			{/each}
			<!-- 空行で埋める（最低10行表示） -->
			{#each emptyRowIndices as i (i)}
				<tr class="empty-row">
					<td class="col-date">&nbsp;</td>
					<td class="col-description"></td>
					<td class="col-unit-price"></td>
					<td class="col-quantity"></td>
					<td class="col-tax-rate"></td>
					<td class="col-amount"></td>
				</tr>
			{/each}
		</tbody>
	</table>

	<!-- 振込先情報と金額内訳（横並び） -->
	<div class="invoice-footer-row">
		<!-- 振込先情報（左側） -->
		<div class="invoice-bank">
			{#if businessInfo?.bankName}
				<div class="bank-title">お振込先</div>
				<div class="bank-info">
					<div class="bank-line">
						<span class="bank-name">{businessInfo.bankName}</span>
						<span class="branch-name">{businessInfo.branchName || ''}支店</span>
					</div>
					<div class="bank-line">
						<span class="account-type"
							>{businessInfo.accountType
								? AccountTypeLabels[businessInfo.accountType]
								: '普通'}</span
						>
						<span class="account-number">{businessInfo.accountNumber || ''}</span>
					</div>
				</div>
				{#if businessInfo.accountHolder}
					<div class="account-holder">口座名義: {businessInfo.accountHolder}</div>
				{/if}
			{/if}
		</div>

		<!-- 金額内訳（右側） -->
		<div class="invoice-totals">
			<table class="totals-table">
				<tbody>
					<tr>
						<td class="label">小計（税抜）</td>
						<td class="amount">¥{formatCurrency(invoice.subtotal)}</td>
					</tr>
					{#if (invoice.taxBreakdown?.taxable10 ?? 0) > 0}
						<tr>
							<td class="label">10%対象</td>
							<td class="amount">¥{formatCurrency(invoice.taxBreakdown?.taxable10)}</td>
						</tr>
						<tr>
							<td class="label">消費税（10%）</td>
							<td class="amount">¥{formatCurrency(invoice.taxBreakdown?.tax10)}</td>
						</tr>
					{/if}
					{#if (invoice.taxBreakdown?.taxable8 ?? 0) > 0}
						<tr>
							<td class="label">8%対象（軽減税率）</td>
							<td class="amount">¥{formatCurrency(invoice.taxBreakdown?.taxable8)}</td>
						</tr>
						<tr>
							<td class="label">消費税（8%）</td>
							<td class="amount">¥{formatCurrency(invoice.taxBreakdown?.tax8)}</td>
						</tr>
					{/if}
					<tr class="total-row">
						<td class="label">合計（税込）</td>
						<td class="amount">¥{formatCurrency(invoice.total)}</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>

	<!-- 備考 -->
	{#if invoice.note}
		<div class="invoice-note">
			<div class="note-title">備考</div>
			<div class="note-content">{invoice.note}</div>
		</div>
	{/if}
</div>
