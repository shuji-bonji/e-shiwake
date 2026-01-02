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
				'/',
				'/accounts',
				'/data',
				'/ledger',
				'/trial-balance',
				'/balance-sheet',
				'/profit-loss',
				'/tax-summary',
				'/reports',
				'/export',
				'/help',
				'/help/getting-started',
				'/help/journal',
				'/help/ledger',
				'/help/trial-balance',
				'/help/tax-category',
				'/help/evidence',
				'/help/accounts',
				'/help/data-management',
				'/help/pwa',
				'/help/shortcuts',
				'/help/glossary'
			]
		}
	}
};

export default config;
