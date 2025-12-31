import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// GitHub Pages のベースパス（リポジトリ名）
const base = process.env.NODE_ENV === 'production' ? '/e-shiwake' : '';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// GitHub Pages 用の静的アダプター
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: '404.html', // SPA フォールバック
			precompress: false,
			strict: true
		}),
		paths: {
			base
		},
		alias: {
			'@/*': './path/to/lib/*'
		},
		// Service Worker は @vite-pwa/sveltekit が管理
		serviceWorker: {
			register: false
		}
	}
};

export { base };
export default config;
