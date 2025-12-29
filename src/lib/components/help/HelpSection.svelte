<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		children: Snippet;
	}

	let { title, children }: Props = $props();
</script>

<section class="mb-8">
	<h2 class="mb-4 text-xl font-semibold">{title}</h2>
	<div class="space-y-4 text-muted-foreground">
		{@render children()}
	</div>
</section>
