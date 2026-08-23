/**
 * ProviderAdapter
 *
 * すべてのプロバイダを OpenAI 互換 /v1/chat/completions で呼ぶ。
 * 接続先（ローカル LiteLLM / OpenAI / Anthropic / Gemini / Grok / カスタム）は
 * LLMProviderConfig の差し替えのみで切り替わる。
 */

import type {
	LLMProviderConfig,
	ChatMessage,
	OpenAIToolSchema,
	ChatCompletionResponse,
	ConnectionTestResult
} from './types';

/** baseUrl 末尾のスラッシュを除去 */
function normalizeBaseUrl(baseUrl: string): string {
	return baseUrl.replace(/\/+$/, '');
}

/**
 * ブラウザが「安全なオリジン」として扱うホスト名。
 * これらへの http:// は HTTPS ページからでもブロックされない（Safari を除く）。
 */
const TRUSTWORTHY_HOST = /^(localhost|.+\.localhost|127(?:\.\d+){1,3}|\[::1\]|::1)$/i;

/**
 * 混在コンテンツでブロックされる組み合わせを検出する
 *
 * HTTPS で配信されているページ（例: GitHub Pages）から http:// の接続先を
 * fetch すると、ブラウザはリクエストを送信せずに破棄する。
 * この場合サーバーには何も届かないため、CORS 設定を変えても解決しない。
 *
 * @returns ブロックされる場合は説明文、問題なければ null
 */
export function detectMixedContentBlock(baseUrl: string): string | null {
	if (typeof location === 'undefined') return null;
	if (location.protocol !== 'https:') return null;

	let url: URL;
	try {
		url = new URL(baseUrl);
	} catch {
		return null; // URL 形式の不備は別途バリデーションする
	}
	if (url.protocol !== 'http:') return null;
	if (TRUSTWORTHY_HOST.test(url.hostname)) return null;

	return (
		`HTTPS で表示しているページから http:// の接続先は呼び出せません（混在コンテンツ）。\n` +
		`接続先: ${baseUrl}\n` +
		`ブラウザがリクエストを送信前に破棄するため、サーバー側の CORS 設定では解決しません。\n` +
		`対処: (1) LLM サーバーを HTTPS 化して https:// の URL を指定する / ` +
		`(2) http://localhost で起動したアプリから使う / ` +
		`(3) Chrome のサイト設定で「安全でないコンテンツ」を許可する（Chrome のみ）`
	);
}

/**
 * chat completion を実行する（非ストリーミング）
 */
export async function chatCompletion(
	cfg: LLMProviderConfig,
	messages: ChatMessage[],
	tools: OpenAIToolSchema[],
	signal?: AbortSignal
): Promise<ChatCompletionResponse> {
	const mixedContent = detectMixedContentBlock(cfg.baseUrl);
	if (mixedContent) {
		throw new Error(mixedContent);
	}

	const url = `${normalizeBaseUrl(cfg.baseUrl)}/chat/completions`;

	const body: Record<string, unknown> = {
		model: cfg.model,
		messages
	};
	if (tools.length > 0) {
		body.tools = tools;
	}
	if (cfg.temperature !== undefined) {
		body.temperature = cfg.temperature;
	}

	let res: Response;
	try {
		res = await fetch(url, {
			method: 'POST',
			headers: buildHeaders(cfg),
			body: JSON.stringify(body),
			signal
		});
	} catch (e) {
		if (e instanceof DOMException && e.name === 'AbortError') throw e;
		throw new Error(
			`接続に失敗しました: ${cfg.baseUrl}\n` +
				`ネットワーク到達性と、サーバー側の CORS 設定を確認してください。` +
				`（${e instanceof Error ? e.message : String(e)}）`
		);
	}

	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new Error(`LLM API エラー (HTTP ${res.status}): ${truncate(text, 500)}`);
	}

	const json = (await res.json()) as ChatCompletionResponse;
	if (!json.choices?.length) {
		throw new Error('LLM API のレスポンスに choices がありません');
	}
	return json;
}

/**
 * 疎通テスト
 *
 * 0. 混在コンテンツでブロックされる構成かを先に判定する
 * 1. GET /v1/models でモデル一覧取得を試みる
 * 2. 失敗した場合は最小の chat completion で確認する
 */
export async function testConnection(cfg: LLMProviderConfig): Promise<ConnectionTestResult> {
	const mixedContent = detectMixedContentBlock(cfg.baseUrl);
	if (mixedContent) {
		return { ok: false, message: mixedContent };
	}

	const base = normalizeBaseUrl(cfg.baseUrl);

	// 1. /models
	try {
		const res = await fetch(`${base}/models`, { headers: buildHeaders(cfg) });
		if (res.ok) {
			const json = (await res.json()) as { data?: { id: string }[] };
			const models = json.data?.map((m) => m.id) ?? [];
			return {
				ok: true,
				message: `接続成功（${models.length} モデル検出）`,
				models
			};
		}
	} catch {
		// フォールバックへ
	}

	// 2. 最小 chat completion
	try {
		await chatCompletion(cfg, [{ role: 'user', content: 'ping' }], []);
		return { ok: true, message: '接続成功（chat completion で確認）' };
	} catch (e) {
		return {
			ok: false,
			message: e instanceof Error ? e.message : String(e)
		};
	}
}

/** 認証・追加ヘッダーを構築 */
function buildHeaders(cfg: LLMProviderConfig): Record<string, string> {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json'
	};
	if (cfg.apiKey) {
		headers['Authorization'] = `Bearer ${cfg.apiKey}`;
	}
	return { ...headers, ...cfg.extraHeaders };
}

function truncate(text: string, max: number): string {
	return text.length > max ? `${text.slice(0, max)}…` : text;
}
