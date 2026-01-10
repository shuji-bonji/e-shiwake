// プリレンダリング + SSR
// IndexedDB アクセスは onMount 内で行うため SSR でも問題なし
export const prerender = true;
export const ssr = true;
export const trailingSlash = 'always';
