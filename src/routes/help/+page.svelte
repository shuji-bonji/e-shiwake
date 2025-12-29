<script lang="ts">
	import {
		BookOpen,
		FileText,
		Receipt,
		Paperclip,
		FolderCog,
		Database,
		Smartphone,
		Keyboard
	} from '@lucide/svelte';

	const sections = [
		{
			href: '/help/getting-started',
			label: 'はじめに',
			icon: BookOpen,
			description: 'e-shiwakeの概要と基本的な使い方'
		},
		{
			href: '/help/journal',
			label: '仕訳入力',
			icon: FileText,
			description: '仕訳の入力・編集・削除方法'
		},
		{
			href: '/help/tax-category',
			label: '消費税区分',
			icon: Receipt,
			description: '消費税区分の設定と使い方'
		},
		{
			href: '/help/evidence',
			label: '証憑管理',
			icon: Paperclip,
			description: 'PDF証憑の紐付けと管理'
		},
		{
			href: '/help/accounts',
			label: '勘定科目管理',
			icon: FolderCog,
			description: '勘定科目の追加・編集'
		},
		{
			href: '/help/data-management',
			label: 'データ管理',
			icon: Database,
			description: 'エクスポート・インポート・バックアップ'
		},
		{
			href: '/help/pwa',
			label: 'PWA・オフライン',
			icon: Smartphone,
			description: 'アプリのインストールとオフライン利用'
		},
		{
			href: '/help/shortcuts',
			label: 'ショートカット',
			icon: Keyboard,
			description: 'キーボードショートカット一覧'
		}
	];
</script>

<div>
	<h1 class="mb-2 text-2xl font-bold">e-shiwake ヘルプ</h1>
	<p class="mb-8 text-muted-foreground">
		e-shiwakeの使い方をご案内します。各項目をクリックして詳細をご覧ください。
	</p>

	<div class="grid gap-4 sm:grid-cols-2">
		{#each sections as section (section.href)}
			<a
				href={section.href}
				class="flex items-start gap-4 rounded-lg border p-4 transition-colors hover:bg-muted"
			>
				<div class="rounded-md bg-primary/10 p-2">
					<section.icon class="size-5 text-primary" />
				</div>
				<div>
					<h2 class="font-medium">{section.label}</h2>
					<p class="text-sm text-muted-foreground">{section.description}</p>
				</div>
			</a>
		{/each}
	</div>
</div>
