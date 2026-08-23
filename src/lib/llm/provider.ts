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
 * これらへの http:// は HTTPS ページからでも制限を受けない。
 */
const TRUSTWORTHY_HOST = /^(localhost|.+\.localhost|127(?:\.\d+){1,3}|\[::1\]|::1)$/i;

/**
 * ローカルネットワーク宛と判定されるホスト名（mDNS 名・RFC1918・リンクローカル）。
 * Chrome 142 以降はこれらを混在コンテンツの対象外とし、
 * 代わりに「ローカルネットワークへのアクセス」の許可を求める。
 */
const LOCAL_NETWORK_HOST =
	/\.local\.?$|^10\.|^192\.168\.|^172\.(?:1[6-9]|2\d|3[01])\.|^169\.254\./i;

/**
 * HTTPS ページから http:// を呼ぶ構成を検出し、ブラウザ側の制限を説明する
 *
 * 制限の内容は接続先によって 2 種類に分かれる。
 *
 * - **ローカルネットワーク宛**（`.local` / RFC1918 / リンクローカル）:
 *   Chrome 142 以降は混在コンテンツの対象外で、代わりに
 *   「ローカルネットワークへのアクセス」の許可を求める。Safari / Firefox はブロックする。
 * - **それ以外**: 混在コンテンツとしてブロックされる。サーバー側の設定では解決しない。
 *
 * いずれも**判定のみ**で送信の可否は決めない。呼び出し側は事前の警告表示と、
 * 失敗したときのエラー説明に使う。
 *
 * @returns 該当する場合は説明文、問題なければ null
 */
export function detectMixedContentRisk(baseUrl: string): string | null {
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

	if (LOCAL_NETWORK_HOST.test(url.hostname)) {
		return (
			`HTTPS で表示しているページから、ローカルネットワーク宛の http:// を呼ぶ構成です。ブラウザによって扱いが変わります。\n` +
			`・Chrome 142 以降: 混在コンテンツの対象外。代わりに「ローカルネットワークへのアクセス」の許可を求められます（拒否すると失敗します）\n` +
			`・Safari / Firefox: 混在コンテンツとしてブロックされます\n` +
			`・Chrome が .local の名前を解決できないこともあります（アドレスバーで ${url.origin}/v1/models を開いて確認してください）\n` +
			`どの環境でも動かすには、LLM サーバーを HTTPS 化して https:// の URL を指定してください。`
		);
	}

	return (
		`HTTPS で表示しているページから http:// の接続先を呼ぶと、ブラウザがリクエストを送信前に破棄します（混在コンテンツ）。\n` +
		`サーバー側の CORS 設定では解決しません。\n` +
		`対処: (1) LLM サーバーを HTTPS 化して https:// の URL を指定する（推奨） / ` +
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
		const detail = e instanceof Error ? e.message : String(e);
		const mixedContent = detectMixedContentRisk(cfg.baseUrl);
		throw new Error(
			`接続に失敗しました: ${cfg.baseUrl}（${detail}）\n` +
				(mixedContent ?? `ネットワーク到達性と、サーバー側の CORS 設定を確認してください。`)
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
 * 1. GET /v1/models でモデル一覧取得を試みる
 * 2. 失敗した場合は最小の chat completion で確認する
 *
 * 混在コンテンツの可能性は事前にブロックせず、実際に失敗したときの説明に含める
 * （Chrome の「安全でないコンテンツ」許可済みなら送信は通るため）。
 */
export async function testConnection(cfg: LLMProviderConfig): Promise<ConnectionTestResult> {
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
