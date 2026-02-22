<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { setSetting } from '$lib/db';
	import type { AccountType, BusinessInfo } from '$lib/types/blue-return-types';
	import { AccountTypeLabels } from '$lib/types/blue-return-types';

	interface Props {
		open: boolean;
		businessInfo: BusinessInfo;
		inventoryStart: number;
		inventoryEnd: number;
		blueReturnDeduction: 65 | 55 | 10;
		onsave: () => void;
	}

	let {
		open = $bindable(),
		businessInfo = $bindable(),
		inventoryStart = $bindable(),
		inventoryEnd = $bindable(),
		blueReturnDeduction = $bindable(),
		onsave
	}: Props = $props();

	async function handleSettingsSave() {
		try {
			const snapshot = $state.snapshot(businessInfo);
			const plainBusinessInfo = JSON.parse(JSON.stringify(snapshot)) as BusinessInfo;
			await setSetting('businessInfo', plainBusinessInfo);
			onsave();
			open = false;
		} catch (e) {
			console.error('businessInfo保存エラー:', e);
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-h-[90vh] overflow-y-auto sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>青色申告決算書の設定</Dialog.Title>
			<Dialog.Description>事業者情報と控除額を設定します</Dialog.Description>
		</Dialog.Header>
		<form
			class="space-y-6"
			onsubmit={(e) => {
				e.preventDefault();
				handleSettingsSave();
			}}
		>
			<!-- 事業者情報 -->
			<div class="space-y-4">
				<h3 class="font-medium">事業者情報</h3>
				<div class="grid gap-4 pl-2">
					<div class="space-y-2">
						<Label for="name">氏名</Label>
						<Input id="name" bind:value={businessInfo.name} placeholder="山田 太郎" />
					</div>
					<div class="space-y-2">
						<Label for="tradeName">屋号（任意）</Label>
						<Input id="tradeName" bind:value={businessInfo.tradeName} placeholder="山田商店" />
					</div>
					<div class="space-y-2">
						<Label for="address">住所</Label>
						<Input id="address" bind:value={businessInfo.address} placeholder="東京都..." />
					</div>
					<div class="space-y-2">
						<Label for="businessType">事業の種類</Label>
						<Input
							id="businessType"
							bind:value={businessInfo.businessType}
							placeholder="例: システム開発業"
						/>
					</div>
					<div class="grid grid-cols-2 gap-4">
						<div class="space-y-2">
							<Label for="phoneNumber">電話番号（任意）</Label>
							<Input
								id="phoneNumber"
								bind:value={businessInfo.phoneNumber}
								placeholder="03-1234-5678"
							/>
						</div>
						<div class="space-y-2">
							<Label for="email">メールアドレス（任意）</Label>
							<Input
								id="email"
								type="email"
								bind:value={businessInfo.email}
								placeholder="info@example.com"
							/>
						</div>
					</div>
					<div class="space-y-2">
						<Label for="invoiceRegistrationNumber">インボイス登録番号（任意）</Label>
						<Input
							id="invoiceRegistrationNumber"
							bind:value={businessInfo.invoiceRegistrationNumber}
							placeholder="T1234567890123"
						/>
					</div>
				</div>
			</div>

			<!-- 振込先情報（請求書用） -->
			<div class="space-y-4">
				<h3 class="font-medium">振込先情報（請求書用・任意）</h3>
				<div class="grid gap-4 pl-2">
					<div class="grid grid-cols-2 gap-4">
						<div class="space-y-2">
							<Label for="bankName">銀行名</Label>
							<Input id="bankName" bind:value={businessInfo.bankName} placeholder="○○銀行" />
						</div>
						<div class="space-y-2">
							<Label for="branchName">支店名</Label>
							<Input id="branchName" bind:value={businessInfo.branchName} placeholder="○○支店" />
						</div>
					</div>
					<div class="grid grid-cols-2 gap-4">
						<div class="space-y-2">
							<Label for="accountType">口座種別</Label>
							<Select.Root
								type="single"
								value={businessInfo.accountType || 'ordinary'}
								onValueChange={(v) => v && (businessInfo.accountType = v as AccountType)}
							>
								<Select.Trigger class="w-full">
									{businessInfo.accountType ? AccountTypeLabels[businessInfo.accountType] : '普通'}
								</Select.Trigger>
								<Select.Content>
									<Select.Item value="ordinary">普通</Select.Item>
									<Select.Item value="current">当座</Select.Item>
								</Select.Content>
							</Select.Root>
						</div>
						<div class="space-y-2">
							<Label for="accountNumber">口座番号</Label>
							<Input
								id="accountNumber"
								bind:value={businessInfo.accountNumber}
								placeholder="1234567"
							/>
						</div>
					</div>
					<div class="space-y-2">
						<Label for="accountHolder">口座名義</Label>
						<Input
							id="accountHolder"
							bind:value={businessInfo.accountHolder}
							placeholder="ヤマダ タロウ"
						/>
					</div>
				</div>
			</div>

			<!-- 青色申告特別控除 -->
			<div class="space-y-4">
				<h3 class="font-medium">青色申告特別控除</h3>
				<div class="pl-2">
					<Select.Root
						type="single"
						value={blueReturnDeduction.toString()}
						onValueChange={(v) => v && (blueReturnDeduction = parseInt(v) as 65 | 55 | 10)}
					>
						<Select.Trigger class="w-full">
							{blueReturnDeduction}万円
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="65">65万円（e-Tax + 複式簿記）</Select.Item>
							<Select.Item value="55">55万円（紙提出 + 複式簿記）</Select.Item>
							<Select.Item value="10">10万円（簡易簿記）</Select.Item>
						</Select.Content>
					</Select.Root>
				</div>
			</div>

			<!-- 棚卸資産 -->
			<div class="space-y-4">
				<h3 class="font-medium">棚卸資産（商品・製品がある場合）</h3>
				<div class="grid grid-cols-2 gap-4 pl-2">
					<div class="space-y-2">
						<Label for="inventoryStart">期首棚卸高</Label>
						<Input id="inventoryStart" type="number" bind:value={inventoryStart} />
					</div>
					<div class="space-y-2">
						<Label for="inventoryEnd">期末棚卸高</Label>
						<Input id="inventoryEnd" type="number" bind:value={inventoryEnd} />
					</div>
				</div>
			</div>

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (open = false)}>キャンセル</Button>
				<Button type="submit">保存</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
