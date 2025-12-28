<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Sun, Moon, Monitor, Check } from '@lucide/svelte';
	import { useTheme, type Theme } from '$lib/stores/theme.svelte.js';

	const theme = useTheme();

	const options: { value: Theme; label: string; icon: typeof Sun }[] = [
		{ value: 'light', label: 'ライト', icon: Sun },
		{ value: 'dark', label: 'ダーク', icon: Moon },
		{ value: 'system', label: 'システム', icon: Monitor }
	];
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button variant="ghost" size="icon" {...props}>
				{#if theme.resolved === 'dark'}
					<Moon class="size-5" />
				{:else}
					<Sun class="size-5" />
				{/if}
				<span class="sr-only">テーマを切り替え</span>
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end">
		{#each options as option (option.value)}
			<DropdownMenu.Item onclick={() => theme.set(option.value)}>
				<option.icon class="mr-2 size-4" />
				<span>{option.label}</span>
				{#if theme.current === option.value}
					<Check class="ml-auto size-4" />
				{/if}
			</DropdownMenu.Item>
		{/each}
	</DropdownMenu.Content>
</DropdownMenu.Root>
