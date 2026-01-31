<script lang="ts">
	import { base } from '$app/paths';
	import {
		BookOpen,
		FileText,
		Receipt,
		Paperclip,
		FolderCog,
		Database,
		Smartphone,
		Keyboard,
		BookA,
		Package,
		ClipboardList,
		BookText,
		Scale,
		FileSpreadsheet
	} from '@lucide/svelte';

	const pageDescription =
		'e-shiwakeの使い方ガイド。仕訳入力、帳簿出力、青色申告決算書の作成方法を解説。';

	const sections = [
		{
			href: `${base}/help/getting-started`,
			label: 'はじめに',
			icon: BookOpen,
			description: 'e-shiwakeの概要と基本的な使い方'
		},
		{
			href: `${base}/help/journal`,
			label: '仕訳入力',
			icon: FileText,
			description: '仕訳の入力・編集・削除方法'
		},
		{
			href: `${base}/help/ledger`,
			label: '総勘定元帳',
			icon: BookText,
			description: '勘定科目別の取引履歴と残高'
		},
		{
			href: `${base}/help/trial-balance`,
			label: '試算表',
			icon: Scale,
			description: '貸借一致の確認と勘定科目一覧'
		},
		{
			href: `${base}/help/tax-category`,
			label: '消費税区分',
			icon: Receipt,
			description: '消費税区分の設定と使い方'
		},
		{
			href: `${base}/help/evidence`,
			label: '証憑管理',
			icon: Paperclip,
			description: 'PDF証憑の紐付けと管理'
		},
		{
			href: `${base}/help/accounts`,
			label: '勘定科目管理',
			icon: FolderCog,
			description: '勘定科目の追加・編集'
		},
		{
			href: `${base}/help/fixed-assets`,
			label: '固定資産台帳',
			icon: Package,
			description: '固定資産の登録と減価償却計算'
		},
		{
			href: `${base}/help/blue-return`,
			label: '青色申告決算書',
			icon: ClipboardList,
			description: '青色申告決算書の作成と印刷'
		},
		{
			href: `${base}/help/invoice`,
			label: '請求書',
			icon: FileSpreadsheet,
			description: '請求書の作成・印刷と仕訳生成'
		},
		{
			href: `${base}/help/data-management`,
			label: '設定・データ管理',
			icon: Database,
			description: '証憑保存・エクスポート・インポート・帳簿出力'
		},
		{
			href: `${base}/help/pwa`,
			label: 'PWA・オフライン',
			icon: Smartphone,
			description: 'アプリのインストールとオフライン利用'
		},
		{
			href: `${base}/help/shortcuts`,
			label: 'ショートカット',
			icon: Keyboard,
			description: 'キーボードショートカット一覧'
		},
		{
			href: `${base}/help/glossary`,
			label: '用語集',
			icon: BookA,
			description: '簿記・会計用語の解説'
		}
	];
</script>

<svelte:head>
	<meta name="description" content={pageDescription} />
	<meta property="og:description" content={pageDescription} />
	<meta name="twitter:description" content={pageDescription} />
</svelte:head>

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
