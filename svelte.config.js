import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: '404.html',
			strict: false // 未知のルートを許容
		}),
		paths: {
			base: process.env.NODE_ENV === 'production' ? '/e-shiwake' : ''
		},
		prerender: {
			handleHttpError: 'warn', // プリレンダリング時のエラーを警告に
			handleMissingId: 'warn',
			handleUnseenRoutes: 'ignore', // クロールで見つからないルートは無視
			// すべてのページをプリレンダリング（GitHub Pagesで404を回避）
			entries: [
				// メインページ
				'/',
				// 帳簿
				'/ledger',
				'/trial-balance',
				'/profit-loss',
				'/balance-sheet',
				'/tax-summary',
				'/fixed-assets',
				'/blue-return',
				'/reports',
				// 請求書
				'/invoice',
				// 管理
				'/vendors',
				'/accounts',
				'/data',
				'/settings',
				'/archive',
				'/export',
				// ヘルプ
				'/help',
				'/help/getting-started',
				'/help/journal',
				'/help/ledger',
				'/help/trial-balance',
				'/help/tax-category',
				'/help/evidence',
				'/help/accounts',
				'/help/fixed-assets',
				'/help/blue-return',
				'/help/invoice',
				'/help/data-management',
				'/help/backup-restore',
				'/help/import-export',
				'/help/archive',
				'/help/pwa',
				'/help/shortcuts',
				'/help/glossary',
				// LLM用テキストエンドポイント
				'/llms.txt',
				'/help/getting-started/llms.txt',
				'/help/journal/llms.txt',
				'/help/ledger/llms.txt',
				'/help/trial-balance/llms.txt',
				'/help/tax-category/llms.txt',
				'/help/evidence/llms.txt',
				'/help/accounts/llms.txt',
				'/help/fixed-assets/llms.txt',
				'/help/blue-return/llms.txt',
				'/help/invoice/llms.txt',
				'/help/data-management/llms.txt',
				'/help/backup-restore/llms.txt',
				'/help/import-export/llms.txt',
				'/help/archive/llms.txt',
				'/help/pwa/llms.txt',
				'/help/shortcuts/llms.txt',
				'/help/glossary/llms.txt',
				'/help/webmcp',
				'/help/webmcp/llms.txt'
			]
		}
	}
};

export default config;
