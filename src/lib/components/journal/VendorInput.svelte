<script lang="ts">
	import { tick } from 'svelte';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Check } from '@lucide/svelte';
	import { cn } from '$lib/utils.js';
	import type { Vendor } from '$lib/types';

	interface Props {
		vendors: Vendor[];
		value: string;
		onchange: (name: string) => void;
		onblur?: () => void;
		placeholder?: string;
		class?: string;
	}

	let { vendors, value, onchange, onblur, placeholder = '取引先', class: className }: Props = $props();

	let open = $state(false);
	let inputRef = $state<HTMLInputElement>(null!);

	// フィルタリングされた候補
	const filteredVendors = $derived.by(() => {
		if (!value) return vendors.slice(0, 10); // 空の時は最新10件
		const query = value.toLowerCase();
		return vendors
			.filter((v) => v.name.toLowerCase().includes(query))
			.slice(0, 10);
	});

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		onchange(target.value);
		if (!open && target.value) {
			open = true;
		}
	}

	function handleSelect(name: string) {
		onchange(name);
		open = false;
		tick().then(() => {
			inputRef?.focus();
		});
	}

	function handleFocus() {
		if (vendors.length > 0) {
			open = true;
		}
	}

	function handleBlur() {
		// 少し遅延させてクリックイベントを先に処理
		setTimeout(() => {
			open = false;
			// 親コンポーネントのonblurを呼び出し（証憑同期など）
			onblur?.();
		}, 200);
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger>
		{#snippet child({ props })}
			<Input
				{...props}
				bind:ref={inputRef}
				type="text"
				{value}
				oninput={handleInput}
				onfocus={handleFocus}
				onblur={handleBlur}
				{placeholder}
				class={cn('', className)}
				autocomplete="off"
			/>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-52 p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
		<Command.Root>
			<Command.List>
				{#if filteredVendors.length === 0}
					<Command.Empty>
						{#if value}
							新規: 「{value}」
						{:else}
							取引先がありません
						{/if}
					</Command.Empty>
				{:else}
					<Command.Group>
						{#each filteredVendors as vendor (vendor.id)}
							<Command.Item
								value={vendor.name}
								onSelect={() => handleSelect(vendor.name)}
							>
								<Check class={cn(value !== vendor.name && 'text-transparent')} />
								<span class="truncate">{vendor.name}</span>
							</Command.Item>
						{/each}
					</Command.Group>
				{/if}
			</Command.List>
		</Command.Root>
	</Popover.Content>
</Popover.Root>
