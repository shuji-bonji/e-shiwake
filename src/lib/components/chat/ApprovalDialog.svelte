<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { useChat } from '$lib/llm/chat.svelte';

	const chat = useChat();

	const argsText = $derived(
		chat.pendingApproval ? JSON.stringify(chat.pendingApproval.args, null, 2) : ''
	);

	const toolLabel = $derived.by(() => {
		switch (chat.pendingApproval?.toolName) {
			case 'delete_journal':
				return '仕訳の削除';
			default:
				return chat.pendingApproval?.toolName ?? '';
		}
	});
</script>

<AlertDialog.Root open={chat.pendingApproval !== null}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>AI が破壊的操作を要求しています</AlertDialog.Title>
			<AlertDialog.Description>
				操作: <strong>{toolLabel}</strong> — この操作は取り消せません。実行してよいか確認してください。
			</AlertDialog.Description>
		</AlertDialog.Header>
		<pre
			class="max-h-40 overflow-auto rounded bg-muted p-2 font-mono text-xs whitespace-pre-wrap">{argsText}</pre>
		<AlertDialog.Footer>
			<AlertDialog.Cancel onclick={() => chat.pendingApproval?.resolve(false)}>
				却下
			</AlertDialog.Cancel>
			<AlertDialog.Action onclick={() => chat.pendingApproval?.resolve(true)}>
				実行を許可
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
