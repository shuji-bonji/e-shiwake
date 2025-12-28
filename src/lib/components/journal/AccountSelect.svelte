<script lang="ts">
	import { tick } from 'svelte';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Check, ChevronsUpDown } from '@lucide/svelte';
	import { cn } from '$lib/utils.js';
	import type { Account } from '$lib/types';

	interface Props {
		accounts: Account[];
		value: string;
		onchange: (code: string) => void;
		placeholder?: string;
		class?: string;
	}

	let {
		accounts,
		value,
		onchange,
		placeholder = '勘定科目を選択',
		class: className
	}: Props = $props();

	let open = $state(false);
	let triggerRef = $state<HTMLButtonElement>(null!);

	const selectedAccount = $derived(accounts.find((a) => a.code === value));

	function closeAndFocusTrigger() {
		open = false;
		tick().then(() => {
			triggerRef?.focus();
		});
	}

	function handleSelect(code: string) {
		onchange(code);
		closeAndFocusTrigger();
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger bind:ref={triggerRef}>
		{#snippet child({ props })}
			<Button
				{...props}
				variant="outline"
				role="combobox"
				aria-expanded={open}
				class={cn('w-full justify-between font-normal', className)}
			>
				{#if selectedAccount}
					<span class="truncate">{selectedAccount.name}</span>
				{:else}
					<span class="text-muted-foreground">{placeholder}</span>
				{/if}
				<ChevronsUpDown class="ml-2 size-4 shrink-0 opacity-50" />
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-52 p-0" align="start">
		<Command.Root>
			<Command.Input placeholder="検索..." />
			<Command.List>
				<Command.Empty>見つかりません</Command.Empty>
				<Command.Group>
					{#each accounts as account (account.code)}
						<Command.Item
							value={account.code}
							keywords={[account.name]}
							onSelect={() => handleSelect(account.code)}
						>
							<Check class={cn(value !== account.code && 'text-transparent')} />
							<span class="font-mono text-xs text-muted-foreground">{account.code}</span>
							<span class="truncate">{account.name}</span>
						</Command.Item>
					{/each}
				</Command.Group>
			</Command.List>
		</Command.Root>
	</Popover.Content>
</Popover.Root>
