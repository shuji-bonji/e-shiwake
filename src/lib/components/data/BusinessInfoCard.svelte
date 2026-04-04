<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { getSetting, setSetting } from '$lib/db';
	import type { BusinessInfo } from '$lib/types/blue-return-types';
	import { createDebounce } from '$lib/utils/debounce';
	import { onMount } from 'svelte';

	let businessInfo = $state<BusinessInfo>({
		name: '',
		tradeName: '',
		address: '',
		businessType: '',
		phoneNumber: '',
		email: '',
		bankName: '',
		branchName: '',
		accountType: 'ordinary',
		accountNumber: '',
		accountHolder: '',
		invoiceRegistrationNumber: ''
	});

	onMount(async () => {
		const saved = await getSetting('businessInfo');
		if (saved) {
			businessInfo = saved;
		}
	});

	const saveBusinessInfoDebounced = createDebounce(async () => {
		try {
			const snapshot = $state.snapshot(businessInfo);
			const plain = JSON.parse(JSON.stringify(snapshot)) as BusinessInfo;
			await setSetting('businessInfo', plain);
		} catch (e) {
			console.error('businessInfo自動保存エラー:', e);
		}
	}, 500);
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>事業者情報</Card.Title>
		<Card.Description>請求書に表示される事業者情報を設定します（自動保存）</Card.Description>
	</Card.Header>
	<Card.Content class="space-y-6">
		<!-- 基本情報 -->
		<div class="space-y-4">
			<h3 class="text-sm font-medium">基本情報</h3>
			<div class="grid gap-4 sm:grid-cols-2">
				<div class="space-y-2">
					<Label for="business-name">氏名 *</Label>
					<Input
						id="business-name"
						bind:value={businessInfo.name}
						placeholder="山田 太郎"
						oninput={saveBusinessInfoDebounced}
					/>
				</div>
				<div class="space-y-2">
					<Label for="business-trade-name">屋号</Label>
					<Input
						id="business-trade-name"
						bind:value={businessInfo.tradeName}
						placeholder="○○事務所"
						oninput={saveBusinessInfoDebounced}
					/>
				</div>
				<div class="space-y-2 sm:col-span-2">
					<Label for="business-address">住所 *</Label>
					<Input
						id="business-address"
						bind:value={businessInfo.address}
						placeholder="東京都○○区..."
						oninput={saveBusinessInfoDebounced}
					/>
				</div>
				<div class="space-y-2">
					<Label for="business-phone">電話番号</Label>
					<Input
						id="business-phone"
						bind:value={businessInfo.phoneNumber}
						placeholder="03-1234-5678"
						oninput={saveBusinessInfoDebounced}
					/>
				</div>
				<div class="space-y-2">
					<Label for="business-email">メールアドレス</Label>
					<Input
						id="business-email"
						type="email"
						bind:value={businessInfo.email}
						placeholder="info@example.com"
						oninput={saveBusinessInfoDebounced}
					/>
				</div>
			</div>
		</div>

		<!-- インボイス登録番号 -->
		<div class="space-y-4">
			<h3 class="text-sm font-medium">インボイス制度</h3>
			<div class="space-y-2">
				<Label for="invoice-registration">適格請求書発行事業者登録番号</Label>
				<Input
					id="invoice-registration"
					bind:value={businessInfo.invoiceRegistrationNumber}
					placeholder="T1234567890123"
					oninput={saveBusinessInfoDebounced}
				/>
				<p class="text-xs text-muted-foreground">
					登録番号は「T」+ 13桁の数字です。未登録の場合は空欄のままにしてください。
				</p>
			</div>
			<div class="grid gap-4 sm:grid-cols-2">
				<div class="space-y-2">
					<Label for="invoice-start">登録適用開始日</Label>
					<Input
						id="invoice-start"
						type="date"
						bind:value={businessInfo.invoiceRegistrationStart}
						oninput={saveBusinessInfoDebounced}
					/>
				</div>
				<div class="space-y-2">
					<Label for="invoice-end">登録適用終了日（登録の取消し時のみ）</Label>
					<Input
						id="invoice-end"
						type="date"
						bind:value={businessInfo.invoiceRegistrationEnd}
						oninput={saveBusinessInfoDebounced}
					/>
				</div>
			</div>
			<p class="text-xs text-muted-foreground">
				開始日が空欄の場合、全期間を通じて登録済みとして扱います。年度途中で登録・取消しをした場合のみ設定してください。
			</p>
		</div>

		<!-- 振込先情報 -->
		<div class="space-y-4">
			<h3 class="text-sm font-medium">振込先情報</h3>
			<div class="grid gap-4 sm:grid-cols-2">
				<div class="space-y-2">
					<Label for="bank-name">銀行名</Label>
					<Input
						id="bank-name"
						bind:value={businessInfo.bankName}
						placeholder="○○銀行"
						oninput={saveBusinessInfoDebounced}
					/>
				</div>
				<div class="space-y-2">
					<Label for="branch-name">支店名</Label>
					<Input
						id="branch-name"
						bind:value={businessInfo.branchName}
						placeholder="○○支店"
						oninput={saveBusinessInfoDebounced}
					/>
				</div>
				<div class="space-y-2">
					<Label>口座種別</Label>
					<Select.Root
						type="single"
						value={businessInfo.accountType || 'ordinary'}
						onValueChange={(v) => {
							businessInfo.accountType = v as 'ordinary' | 'current';
							saveBusinessInfoDebounced();
						}}
					>
						<Select.Trigger>
							{businessInfo.accountType === 'current' ? '当座' : '普通'}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="ordinary">普通</Select.Item>
							<Select.Item value="current">当座</Select.Item>
						</Select.Content>
					</Select.Root>
				</div>
				<div class="space-y-2">
					<Label for="account-number">口座番号</Label>
					<Input
						id="account-number"
						bind:value={businessInfo.accountNumber}
						placeholder="1234567"
						oninput={saveBusinessInfoDebounced}
					/>
				</div>
				<div class="space-y-2 sm:col-span-2">
					<Label for="account-holder">口座名義</Label>
					<Input
						id="account-holder"
						bind:value={businessInfo.accountHolder}
						placeholder="ヤマダ タロウ"
						oninput={saveBusinessInfoDebounced}
					/>
				</div>
			</div>
		</div>
	</Card.Content>
</Card.Root>
