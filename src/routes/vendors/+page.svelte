<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Plus, Pencil, Trash2, Building2 } from '@lucide/svelte';
	import type { Vendor } from '$lib/types';
	import {
		initializeDatabase,
		getAllVendors,
		getVendorById,
		addVendorWithDetails,
		updateVendor,
		deleteVendor,
		isVendorInUseByInvoice,
		isVendorInUseByJournal
	} from '$lib/db';

	// 状態
	let vendors = $state<Vendor[]>([]);
	let isLoading = $state(true);
	let dialogOpen = $state(false);
	let deleteDialogOpen = $state(false);
	let editingVendor = $state<Vendor | null>(null);
	let deletingVendor = $state<Vendor | null>(null);
	let deleteError = $state('');

	// フォーム用の状態
	let formName = $state('');
	let formAddress = $state('');
	let formPaymentTerms = $state('');
	let formNote = $state('');
	let formError = $state('');

	onMount(async () => {
		await initializeDatabase();
		await loadVendors();
	});

	async function loadVendors() {
		isLoading = true;
		try {
			vendors = await getAllVendors();
		} finally {
			isLoading = false;
		}
	}

	function openAddDialog() {
		editingVendor = null;
		formName = '';
		formAddress = '';
		formPaymentTerms = '';
		formNote = '';
		formError = '';
		dialogOpen = true;
	}

	async function openEditDialog(vendor: Vendor) {
		// 最新のデータを取得
		const latest = await getVendorById(vendor.id);
		if (!latest) {
			await loadVendors();
			return;
		}
		editingVendor = latest;
		formName = latest.name;
		formAddress = latest.address || '';
		formPaymentTerms = latest.paymentTerms || '';
		formNote = latest.note || '';
		formError = '';
		dialogOpen = true;
	}

	async function openDeleteDialog(vendor: Vendor) {
		deletingVendor = vendor;
		deleteError = '';

		// 使用状況をチェック
		const inUseByInvoice = await isVendorInUseByInvoice(vendor.id);
		const inUseByJournal = await isVendorInUseByJournal(vendor.id);

		if (inUseByInvoice) {
			deleteError = 'この取引先は請求書で使用されているため削除できません';
		} else if (inUseByJournal) {
			deleteError = 'この取引先は仕訳で使用されているため削除できません';
		}

		deleteDialogOpen = true;
	}

	async function handleSubmit() {
		formError = '';

		// バリデーション
		if (!formName.trim()) {
			formError = '取引先名を入力してください';
			return;
		}

		// 重複チェック（新規追加時または名前変更時）
		if (!editingVendor || editingVendor.name !== formName.trim()) {
			const duplicate = vendors.find(
				(v) => v.name === formName.trim() && v.id !== editingVendor?.id
			);
			if (duplicate) {
				formError = 'この取引先名は既に登録されています';
				return;
			}
		}

		try {
			if (editingVendor) {
				// 更新
				await updateVendor(editingVendor.id, {
					name: formName.trim(),
					address: formAddress.trim() || undefined,
					paymentTerms: formPaymentTerms.trim() || undefined,
					note: formNote.trim() || undefined
				});
			} else {
				// 新規追加
				await addVendorWithDetails({
					name: formName.trim(),
					address: formAddress.trim() || undefined,
					paymentTerms: formPaymentTerms.trim() || undefined,
					note: formNote.trim() || undefined
				});
			}
			dialogOpen = false;
			await loadVendors();
		} catch (error) {
			formError = error instanceof Error ? error.message : 'エラーが発生しました';
		}
	}

	async function handleDelete() {
		if (!deletingVendor || deleteError) return;

		try {
			await deleteVendor(deletingVendor.id);
			deleteDialogOpen = false;
			await loadVendors();
		} catch (error) {
			deleteError = error instanceof Error ? error.message : '削除に失敗しました';
		}
	}
</script>

<svelte:head>
	<title>取引先管理 - e-shiwake</title>
</svelte:head>

<div class="space-y-6">
	<!-- ヘッダー -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold">取引先管理</h1>
			<p class="text-sm text-muted-foreground">請求書で使用する取引先を管理します</p>
		</div>
		<Button onclick={openAddDialog}>
			<Plus class="mr-2 size-4" />
			取引先を追加
		</Button>
	</div>

	{#if isLoading}
		<div class="flex items-center justify-center py-8">
			<p class="text-muted-foreground">読み込み中...</p>
		</div>
	{:else if vendors.length === 0}
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<Building2 class="mb-4 size-12 text-muted-foreground" />
			<p class="text-lg font-medium">取引先が登録されていません</p>
			<p class="mb-4 text-sm text-muted-foreground">
				「取引先を追加」ボタンから取引先を登録してください
			</p>
			<Button onclick={openAddDialog}>
				<Plus class="mr-2 size-4" />
				取引先を追加
			</Button>
		</div>
	{:else}
		<div class="space-y-2">
			{#each vendors as vendor (vendor.id)}
				<div
					class="flex items-start justify-between gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50"
				>
					<div class="min-w-0 flex-1">
						<div class="font-medium">{vendor.name}</div>
						{#if vendor.address}
							<div class="text-sm text-muted-foreground">{vendor.address}</div>
						{/if}
						{#if vendor.paymentTerms}
							<div class="text-sm text-muted-foreground">支払条件: {vendor.paymentTerms}</div>
						{/if}
						{#if vendor.note}
							<div class="mt-1 text-sm text-muted-foreground">{vendor.note}</div>
						{/if}
					</div>
					<div class="flex gap-2">
						<Button size="sm" variant="outline" onclick={() => openEditDialog(vendor)}>
							<Pencil class="size-4" />
						</Button>
						<Button size="sm" variant="outline" onclick={() => openDeleteDialog(vendor)}>
							<Trash2 class="size-4" />
						</Button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- 追加/編集ダイアログ -->
<Dialog.Root bind:open={dialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>
				{editingVendor ? '取引先を編集' : '取引先を追加'}
			</Dialog.Title>
			<Dialog.Description>
				{editingVendor ? '取引先情報を編集します' : '新しい取引先を登録します'}
			</Dialog.Description>
		</Dialog.Header>
		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleSubmit();
			}}
		>
			<div class="space-y-4">
				<div class="space-y-2">
					<Label for="name">取引先名 *</Label>
					<Input id="name" bind:value={formName} placeholder="株式会社○○" />
				</div>
				<div class="space-y-2">
					<Label for="address">住所</Label>
					<Input id="address" bind:value={formAddress} placeholder="東京都..." />
				</div>
				<div class="space-y-2">
					<Label for="paymentTerms">支払条件</Label>
					<Input id="paymentTerms" bind:value={formPaymentTerms} placeholder="月末締め翌月末払い" />
				</div>
				<div class="space-y-2">
					<Label for="note">メモ</Label>
					<Textarea id="note" bind:value={formNote} placeholder="備考など" rows={3} />
				</div>
			</div>
			{#if formError}
				<p class="mt-4 text-sm text-destructive">{formError}</p>
			{/if}
			<Dialog.Footer class="mt-6">
				<Button type="button" variant="outline" onclick={() => (dialogOpen = false)}>
					キャンセル
				</Button>
				<Button type="submit">{editingVendor ? '更新' : '追加'}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- 削除確認ダイアログ -->
<Dialog.Root bind:open={deleteDialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>取引先を削除</Dialog.Title>
			<Dialog.Description>
				「{deletingVendor?.name}」を削除しますか？この操作は取り消せません。
			</Dialog.Description>
		</Dialog.Header>
		{#if deleteError}
			<p class="text-sm text-destructive">{deleteError}</p>
		{/if}
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (deleteDialogOpen = false)}>キャンセル</Button>
			<Button variant="destructive" onclick={handleDelete} disabled={!!deleteError}>削除</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
