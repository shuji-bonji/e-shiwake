import {
	BookOpen,
	BookText,
	Scale,
	Calculator,
	TrendingUp,
	Landmark,
	Receipt,
	Package,
	FileCheck,
	ClipboardList,
	FileOutput,
	FileText,
	FileSpreadsheet,
	Users,
	Settings,
	List
} from '@lucide/svelte';
import type { Component } from 'svelte';

export interface NavItem {
	label: string;
	href: string;
	icon: Component;
}

export interface NavGroup {
	label: string;
	icon: Component;
	items: NavItem[];
}

export const navGroups: NavGroup[] = [
	{
		label: '帳簿',
		icon: BookOpen,
		items: [
			{ label: '仕訳帳', href: '/', icon: BookText },
			{ label: '総勘定元帳', href: '/ledger', icon: BookOpen },
			{ label: '試算表', href: '/trial-balance', icon: Scale }
		]
	},
	{
		label: '決算書類',
		icon: Calculator,
		items: [
			{ label: '損益計算書', href: '/profit-loss', icon: TrendingUp },
			{ label: '貸借対照表', href: '/balance-sheet', icon: Landmark },
			{ label: '消費税集計', href: '/tax-summary', icon: Receipt },
			{ label: '固定資産台帳', href: '/fixed-assets', icon: Package }
		]
	},
	{
		label: '確定申告',
		icon: FileCheck,
		items: [{ label: '青色申告決算書', href: '/blue-return', icon: ClipboardList }]
	},
	{
		label: '出力',
		icon: FileOutput,
		items: [{ label: '帳簿出力', href: '/reports', icon: FileText }]
	},
	{
		label: '請求書',
		icon: FileSpreadsheet,
		items: [
			{ label: '請求書一覧', href: '/invoice', icon: FileSpreadsheet },
			{ label: '取引先管理', href: '/vendors', icon: Users }
		]
	},
	{
		label: '設定',
		icon: Settings,
		items: [
			{ label: '勘定科目', href: '/accounts', icon: List },
			{ label: '設定・データ管理', href: '/data', icon: Settings }
		]
	}
];
