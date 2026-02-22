<script lang="ts">
	// レガシールート: /data に統合済み。リダイレクト。
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { onMount } from 'svelte';

	onMount(() => {
		goto(`${base}/data`, { replaceState: true });
	});
</script>
