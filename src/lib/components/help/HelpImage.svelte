<script lang="ts">
	interface Props {
		src: string;
		alt: string;
		caption?: string;
	}

	let { src, alt, caption }: Props = $props();
</script>

<figure class="my-4">
	<img {src} {alt} class="rounded-lg border shadow-sm" />
	{#if caption}
		<figcaption class="mt-2 text-center text-sm text-muted-foreground">
			{caption}
		</figcaption>
	{/if}
</figure>
