import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import config from './svelte.config.js';

const base = config.kit?.paths?.base || '';
// PWAのパスにはトレイリングスラッシュが必要
const pwaBase = base ? `${base}/` : '/';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA({
			srcDir: 'src',
			mode: 'production',
			strategies: 'generateSW',
			registerType: 'prompt', // ユーザーに更新を通知
			// GitHub Pages のベースパスを考慮
			base: pwaBase,
			scope: pwaBase,
			// SvelteKit の trailingSlash 設定に合わせる
			integration: {
				configureOptions(viteOptions, options) {
					// トレイリングスラッシュを有効化
					(options as { kit?: { trailingSlash: string } }).kit = {
						trailingSlash: 'always'
					};
				}
			},
			manifest: {
				name: 'e-shiwake - 電子仕訳',
				short_name: 'e-shiwake',
				description: 'フリーランス・個人事業主向けの仕訳入力+証憑管理PWA',
				start_url: './',
				display: 'standalone',
				background_color: '#ffffff',
				theme_color: '#0f172a',
				categories: ['productivity', 'finance'],
				icons: [
					{
						src: 'icon-192x192.png',
						sizes: '192x192',
						type: 'image/png',
						purpose: 'any'
					},
					{
						src: 'icon-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'any'
					},
					{
						src: 'icon-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				]
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
				// ナビゲーションフォールバックを無効化（GitHub Pages の 404.html に任せる）
				navigateFallback: null,
				// 内部パスを実際の公開パスに変換してトレイリングスラッシュを追加
				manifestTransforms: [
					async (entries) => {
						const manifest = entries.map((entry) => {
							let url = entry.url;
							// prerendered/pages/ と client/ プレフィックスを除去
							url = url.replace(/^prerendered\/pages\//, '');
							url = url.replace(/^client\//, '');
							// index.html を / に変換
							url = url.replace(/index\.html$/, '');
							// HTMLページ（拡張子なし・空以外）にトレイリングスラッシュを追加
							if (!url.includes('.') && url !== '' && !url.endsWith('/')) {
								url = `${url}/`;
							}
							entry.url = url;
							return entry;
						});
						return { manifest };
					}
				],
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
						handler: 'CacheFirst',
						options: {
							cacheName: 'google-fonts-cache',
							expiration: {
								maxEntries: 10,
								maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
							},
							cacheableResponse: {
								statuses: [0, 200]
							}
						}
					}
				]
			},
			devOptions: {
				enabled: false
			}
		})
	],

	test: {
		expect: { requireAssertions: true },

		projects: [
			{
				extends: './vite.config.ts',

				test: {
					name: 'client',

					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},

					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.ts',

				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					setupFiles: ['src/lib/db/test-setup.ts']
				}
			}
		]
	}
});
