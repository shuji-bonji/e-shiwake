<script lang="ts">
	interface Props {
		headers: string[];
		rows: string[][];
	}

	let { headers, rows }: Props = $props();
</script>

<div class="my-4 overflow-x-auto">
	<table class="w-full text-sm">
		<thead>
			<tr class="border-b">
				{#each headers as header, i (i)}
					<th class="px-3 py-2 text-left font-medium">{header}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each rows as row, rowIndex (rowIndex)}
				<tr class="border-b">
					{#each row as cell, cellIndex (cellIndex)}
						<td class="px-3 py-2">{cell}</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>
