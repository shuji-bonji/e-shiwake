<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { reloadActiveProvider } from '$lib/llm/chat.svelte';
	import {
		addProvider,
		deleteProvider,
		getActiveProviderId,
		getAllProviders,
		setActiveProviderId,
		updateProvider
	} from '$lib/llm/config-store';
	import { detectMixedContentRisk, testConnection } from '$lib/llm/provider';
	import {
		LLM_PROVIDER_PRESETS,
		type LLMProviderConfig,
		type LLMProviderKind
	} from '$lib/llm/types';
	import { AlertTriangle, Bot, CheckCircle2, Loader2, Pencil, Trash2 } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';

	let providers = $state<LLMProviderConfig[]>([]);
	let activeId = $state<string | null>(null);
	let testing = $state(false);

	// 編集フォームの状態（null = フォーム非表示）
	interface FormState {
		id?: string; // 編集時のみ
		kind: LLMProviderKind;
		label: string;
		baseUrl: string;
		apiKey: string;
		model: string;
		isCloud: boolean;
		extraHeaders?: Record<string, string>;
	}
	let form = $state<FormState | null>(null);

	const activeProvider = $derived(providers.find((p) => p.id === activeId) ?? null);

	/** HTTPS ページから http:// を指定した場合の警告（混在コンテンツ） */
	const mixedContentWarning = $derived(form ? detectMixedContentRisk(form.baseUrl) : null);

	onMount(async () => {
		await reload();
	});

	async function reload() {
		providers = await getAllProviders();
		activeId = await getActiveProviderId();
	}

	function startAdd(kind: LLMProviderKind) {
		const preset = LLM_PROVIDER_PRESETS.find((p) => p.kind === kind);
		if (!preset) return;
		form = {
			kind,
			label: preset.label,
			baseUrl: preset.baseUrl,
			apiKey: '',
			model: preset.model,
			isCloud: preset.isCloud,
			extraHeaders: preset.extraHeaders
		};
	}

	function startEdit(p: LLMProviderConfig) {
		form = {
			id: p.id,
			kind: p.kind,
			label: p.label,
			baseUrl: p.baseUrl,
			apiKey: p.apiKey,
			model: p.model,
			isCloud: p.isCloud,
			extraHeaders: p.extraHeaders
		};
	}

	async function saveForm() {
		if (!form) return;
		if (!form.baseUrl.trim() || !form.model.trim()) {
			toast.error('接続先 URL とモデル名は必須です');
			return;
		}
		const data = {
			kind: form.kind,
			label: form.label.trim() || form.model,
			baseUrl: form.baseUrl.trim(),
			apiKey: form.apiKey.trim(),
			model: form.model.trim(),
			isCloud: form.isCloud,
			extraHeaders: form.extraHeaders
		};
		if (form.id) {
			await updateProvider(form.id, data);
			toast.success('プロバイダ設定を更新しました');
		} else {
			const id = await addProvider(data);
			// 初回追加時は自動的にアクティブにする
			if (providers.length === 0) {
				await setActiveProviderId(id);
			}
			toast.success('プロバイダ設定を追加しました');
		}
		form = null;
		await reload();
		await reloadActiveProvider();
	}

	async function removeProvider(id: string) {
		await deleteProvider(id);
		toast.success('プロバイダ設定を削除しました');
		await reload();
		await reloadActiveProvider();
	}

	async function activate(id: string) {
		await setActiveProviderId(id);
		activeId = id;
		await reloadActiveProvider();
	}

	async function runTest(p: LLMProviderConfig) {
		testing = true;
		try {
			const result = await testConnection(p);
			if (result.ok) {
				toast.success(result.message, {
					description: result.models?.length ? result.models.slice(0, 5).join(', ') : undefined
				});
			} else {
				toast.error('接続失敗', { description: result.message });
			}
		} finally {
			testing = false;
		}
	}

	const presetLabel = $derived(
		form ? (LLM_PROVIDER_PRESETS.find((p) => p.kind === form?.kind)?.label ?? '') : ''
	);
</script>

<Card.Root>
	<Card.Header>
		<Card.Title class="flex items-center gap-2">
			<Bot class="size-5" />
			AI アシスタント（LLM プロバイダ）
		</Card.Title>
		<Card.Description>
			チャット機能で使う LLM の接続先を設定します。API キーはこの端末内（ブラウザの
			IndexedDB）にのみ保存されます。
		</Card.Description>
	</Card.Header>
	<Card.Content class="space-y-6">
		<!-- クラウド警告 -->
		{#if activeProvider?.isCloud}
			<div
				class="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
			>
				<AlertTriangle class="mt-0.5 size-4 shrink-0" />
				<p>
					クラウド LLM（{activeProvider.label}）が選択されています。チャット中に参照した<strong
						>帳簿データが外部プロバイダに送信されます</strong
					>。データを外部に出したくない場合はローカル LLM を利用してください。
				</p>
			</div>
		{/if}

		<!-- プロバイダ一覧 -->
		{#if providers.length > 0}
			<div class="space-y-2">
				{#each providers as p (p.id)}
					<div class="flex items-center gap-3 rounded-md border p-3">
						<input
							type="radio"
							name="active-llm-provider"
							checked={p.id === activeId}
							onchange={() => activate(p.id)}
							aria-label={`${p.label} を使用する`}
							class="size-4 accent-primary"
						/>
						<div class="min-w-0 flex-1">
							<div class="flex flex-wrap items-center gap-2">
								<span class="text-sm font-medium">{p.label}</span>
								{#if p.isCloud}
									<Badge variant="outline" class="border-amber-400 text-amber-600">クラウド</Badge>
								{:else}
									<Badge variant="outline" class="border-emerald-400 text-emerald-600">
										ローカル
									</Badge>
								{/if}
							</div>
							<p class="truncate text-xs text-muted-foreground">{p.model} — {p.baseUrl}</p>
						</div>
						<div class="flex shrink-0 gap-1">
							<Button
								variant="ghost"
								size="sm"
								disabled={testing}
								onclick={() => runTest(p)}
								title="疎通テスト"
							>
								{#if testing}
									<Loader2 class="size-4 animate-spin" />
								{:else}
									<CheckCircle2 class="size-4" />
								{/if}
								<span class="sr-only">疎通テスト</span>
							</Button>
							<Button variant="ghost" size="sm" onclick={() => startEdit(p)} title="編集">
								<Pencil class="size-4" />
								<span class="sr-only">編集</span>
							</Button>
							<Button variant="ghost" size="sm" onclick={() => removeProvider(p.id)} title="削除">
								<Trash2 class="size-4 text-destructive" />
								<span class="sr-only">削除</span>
							</Button>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<p class="text-sm text-muted-foreground">
				プロバイダが未設定です。プリセットを選んで接続先を追加してください。
			</p>
		{/if}

		<!-- 追加 -->
		{#if !form}
			<div class="space-y-2">
				<Label>プリセットから追加</Label>
				<Select.Root type="single" onValueChange={(v) => startAdd(v as LLMProviderKind)}>
					<Select.Trigger class="w-full sm:w-96">接続先の種類を選択…</Select.Trigger>
					<Select.Content>
						{#each LLM_PROVIDER_PRESETS as preset (preset.kind)}
							<Select.Item value={preset.kind}>{preset.label}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
		{/if}

		<!-- 編集フォーム -->
		{#if form}
			<div class="space-y-4 rounded-md border p-4">
				<h3 class="text-sm font-medium">
					{form.id ? 'プロバイダを編集' : `新規追加: ${presetLabel}`}
				</h3>
				{#if form.isCloud}
					<p class="flex items-center gap-1 text-xs text-amber-600">
						<AlertTriangle class="size-3.5" />
						クラウドプロバイダです。帳簿データが外部送信されます。
					</p>
				{/if}
				<div class="grid gap-4 sm:grid-cols-2">
					<div class="space-y-2">
						<Label for="llm-label">表示名</Label>
						<Input id="llm-label" bind:value={form.label} placeholder="例: 自宅サーバーの Gemma" />
					</div>
					<div class="space-y-2">
						<Label for="llm-model">モデル名 *</Label>
						<Input id="llm-model" bind:value={form.model} placeholder="例: gemma-smart" />
					</div>
					<div class="space-y-2 sm:col-span-2">
						<Label for="llm-baseurl">接続先 URL（OpenAI 互換 /v1）*</Label>
						<Input
							id="llm-baseurl"
							bind:value={form.baseUrl}
							placeholder="http://localhost:4000/v1"
						/>
						{#if mixedContentWarning}
							<p class="flex items-start gap-1 text-xs text-amber-600">
								<AlertTriangle class="mt-0.5 size-3.5 shrink-0" />
								<span class="whitespace-pre-line">{mixedContentWarning}</span>
							</p>
						{/if}
					</div>
					<div class="space-y-2 sm:col-span-2">
						<Label for="llm-apikey"
							>API キー{form.kind === 'local' ? '（ローカルは省略可）' : ''}</Label
						>
						<Input id="llm-apikey" type="password" bind:value={form.apiKey} placeholder="sk-..." />
					</div>
				</div>
				<div class="flex gap-2">
					<Button onclick={saveForm}>{form.id ? '更新' : '追加'}</Button>
					<Button variant="outline" onclick={() => (form = null)}>キャンセル</Button>
				</div>
			</div>
		{/if}

		<p class="text-xs text-muted-foreground">
			ローカル LLM（LiteLLM / Ollama 等）を使う場合は、サーバー側でこのアプリのオリジンからの CORS
			を許可してください。また、このページを HTTPS で開いている場合、接続先も HTTPS
			である必要があります。ブラウザ保存の API キーは XSS
			に弱い性質がありますが、本アプリはサードパーティスクリプトを含まない静的 PWA です。
		</p>
	</Card.Content>
</Card.Root>
