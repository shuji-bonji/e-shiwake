import { browser } from '$app/environment';

export type Theme = 'light' | 'dark' | 'system';

// テーマの状態
let currentTheme = $state<Theme>('system');
let resolvedTheme = $state<'light' | 'dark'>('light');

// localStorageのキー
const THEME_KEY = 'e-shiwake-theme';

/**
 * システムのダークモード設定を取得
 */
function getSystemTheme(): 'light' | 'dark' {
	if (!browser) return 'light';
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * テーマをDOMに適用
 */
function applyTheme(theme: 'light' | 'dark') {
	if (!browser) return;

	const root = document.documentElement;
	if (theme === 'dark') {
		root.classList.add('dark');
	} else {
		root.classList.remove('dark');
	}

	// theme-colorも更新
	const metaThemeColor = document.querySelector('meta[name="theme-color"]');
	if (metaThemeColor) {
		metaThemeColor.setAttribute('content', theme === 'dark' ? '#0f172a' : '#ffffff');
	}
}

/**
 * テーマを解決して適用
 */
function resolveAndApplyTheme(theme: Theme) {
	const resolved = theme === 'system' ? getSystemTheme() : theme;
	resolvedTheme = resolved;
	applyTheme(resolved);
}

/**
 * テーマストアを初期化
 */
export function initializeTheme() {
	if (!browser) return;

	// localStorageから読み込み
	const stored = localStorage.getItem(THEME_KEY) as Theme | null;
	currentTheme = stored || 'system';
	resolveAndApplyTheme(currentTheme);

	// システム設定の変更を監視
	const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
	mediaQuery.addEventListener('change', () => {
		if (currentTheme === 'system') {
			resolveAndApplyTheme('system');
		}
	});
}

/**
 * テーマを設定
 */
export function setTheme(theme: Theme) {
	currentTheme = theme;
	resolveAndApplyTheme(theme);

	if (browser) {
		localStorage.setItem(THEME_KEY, theme);
	}
}

/**
 * 現在のテーマ設定を取得
 */
export function useTheme() {
	return {
		get current() {
			return currentTheme;
		},
		get resolved() {
			return resolvedTheme;
		},
		set: setTheme
	};
}
