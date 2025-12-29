<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Info, AlertTriangle, Lightbulb } from '@lucide/svelte';

	interface Props {
		type?: 'info' | 'warning' | 'tip';
		children: Snippet;
	}

	let { type = 'info', children }: Props = $props();

	const styles = {
		info: {
			icon: Info,
			bg: 'bg-blue-50 dark:bg-blue-950',
			border: 'border-blue-200 dark:border-blue-800',
			text: 'text-blue-800 dark:text-blue-200'
		},
		warning: {
			icon: AlertTriangle,
			bg: 'bg-yellow-50 dark:bg-yellow-950',
			border: 'border-yellow-200 dark:border-yellow-800',
			text: 'text-yellow-800 dark:text-yellow-200'
		},
		tip: {
			icon: Lightbulb,
			bg: 'bg-green-50 dark:bg-green-950',
			border: 'border-green-200 dark:border-green-800',
			text: 'text-green-800 dark:text-green-200'
		}
	};

	const style = $derived(styles[type]);
	const Icon = $derived(style.icon);
</script>

<div class="my-4 flex gap-3 rounded-lg border p-4 {style.bg} {style.border}">
	<Icon class="size-5 shrink-0 {style.text}" />
	<div class="text-sm {style.text}">
		{@render children()}
	</div>
</div>
