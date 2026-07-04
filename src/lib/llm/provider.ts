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
 * 1. GET /v1/models でモデル一覧取得を試みる
 * 2. 失敗した場合は最小の chat completion で確認する
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

function truncate(text: string, max: number): string {
	return text.length > max ? `${text.slice(0, max)}…` : text;
}
