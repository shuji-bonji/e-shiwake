<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { base } from '$app/paths';
	import type { NavGroup } from './sidebar-nav';

	interface Props {
		group: NavGroup;
		pathname: string;
	}

	let { group, pathname }: Props = $props();
</script>

<Sidebar.Group>
	<Sidebar.GroupLabel>
		<group.icon class="size-4" />
		{group.label}
	</Sidebar.GroupLabel>
	<Sidebar.GroupContent>
		<Sidebar.Menu>
			{#each group.items as item (item.href)}
				<Sidebar.MenuItem>
					<Sidebar.MenuButton isActive={pathname === item.href}>
						{#snippet child({ props })}
							<a href="{base}{item.href === '/' ? '/' : item.href}" {...props}>
								<item.icon class="size-4" />
								<span>{item.label}</span>
							</a>
						{/snippet}
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
			{/each}
		</Sidebar.Menu>
	</Sidebar.GroupContent>
</Sidebar.Group>
