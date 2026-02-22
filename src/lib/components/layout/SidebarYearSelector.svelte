<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Calendar } from '@lucide/svelte';

	interface Props {
		availableYears: number[];
		selectedYear: number;
		onselect: (year: number) => void;
	}

	let { availableYears, selectedYear, onselect }: Props = $props();
</script>

<Sidebar.Group>
	<Sidebar.GroupLabel>
		<Calendar class="size-4" />
		年度
	</Sidebar.GroupLabel>
	<Sidebar.GroupContent>
		<Sidebar.Menu>
			{#each availableYears as year (year)}
				<Sidebar.MenuItem>
					<Sidebar.MenuButton isActive={selectedYear === year} onclick={() => onselect(year)}>
						<span>{year}</span>
						{#if selectedYear === year}
							<span class="ml-auto text-xs text-muted-foreground">選択中</span>
						{/if}
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
			{/each}
		</Sidebar.Menu>
	</Sidebar.GroupContent>
</Sidebar.Group>
