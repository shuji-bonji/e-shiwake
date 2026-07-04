/**
 * LLM チャット（アプリ内コパイロット）型定義
 *
 * OpenAI 互換 /v1/chat/completions を前提とした ProviderAdapter の型群。
 * 設計: docs/design/llm-chat.md
 */

/**
 * プロバイダ種別
 */
export type LLMProviderKind = 'local' | 'openai' | 'anthropic' | 'gemini' | 'grok' | 'custom';

/**
 * LLM プロバイダ設定
 *
 * API キーは IndexedDB（端末内）にのみ保存され、外部に出ない。
 */
export interface LLMProviderConfig {
	/** 設定の識別子（UUID） */
	id: string;
	/** 表示名（例: "neko8 Gemma"） */
	label: string;
	/** プロバイダ種別 */
	kind: LLMProviderKind;
	/** 例: http://neko8:4000/v1 */
	baseUrl: string;
	/** 端末内のみ。ローカルは空可 */
	apiKey: string;
	/** 例: gemma-smart / gpt-4o / claude-sonnet-4-5 */
	model: string;
	/** 追加ヘッダー（例: Anthropic の CORS 用ヘッダー） */
	extraHeaders?: Record<string, string>;
	temperature?: number;
	/** クラウド警告表示の判定に使用 */
	isCloud: boolean;
	createdAt: string;
	updatedAt: string;
}

/**
 * プロバイダのプリセット（設定 UI の初期値）
 */
export interface LLMProviderPreset {
	kind: LLMProviderKind;
	label: string;
	baseUrl: string;
	model: string;
	extraHeaders?: Record<string, string>;
	isCloud: boolean;
	requiresApiKey: boolean;
	note?: string;
}

export const LLM_PROVIDER_PRESETS: LLMProviderPreset[] = [
	{
		kind: 'local',
		label: 'ローカル LLM（LiteLLM / Ollama / vLLM / llamafile）',
		baseUrl: 'http://localhost:4000/v1',
		model: '',
		isCloud: false,
		requiresApiKey: false,
		note: '帳簿データが LAN の外に出ない構成（推奨）。サーバー側で CORS 許可が必要'
	},
	{
		kind: 'openai',
		label: 'OpenAI',
		baseUrl: 'https://api.openai.com/v1',
		model: 'gpt-4o',
		isCloud: true,
		requiresApiKey: true
	},
	{
		kind: 'anthropic',
		label: 'Anthropic',
		baseUrl: 'https://api.anthropic.com/v1',
		model: 'claude-sonnet-4-5',
		extraHeaders: { 'anthropic-dangerous-direct-browser-access': 'true' },
		isCloud: true,
		requiresApiKey: true
	},
	{
		kind: 'gemini',
		label: 'Google Gemini',
		baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
		model: 'gemini-2.5-flash',
		isCloud: true,
		requiresApiKey: true
	},
	{
		kind: 'grok',
		label: 'xAI Grok',
		baseUrl: 'https://api.x.ai/v1',
		model: 'grok-3',
		isCloud: true,
		requiresApiKey: true
	},
	{
		kind: 'custom',
		label: 'カスタム（OpenAI 互換）',
		baseUrl: '',
		model: '',
		isCloud: true,
		requiresApiKey: false,
		note: '企業 VPC 内の LiteLLM / vLLM 等。OpenAI 互換 /v1/chat/completions であること'
	}
];

// =============================================================================
// OpenAI 互換 Chat Completions ワイヤ形式
// =============================================================================

/** tool_calls の 1 要素 */
export interface ChatToolCall {
	id: string;
	type: 'function';
	function: {
		name: string;
		/** JSON 文字列 */
		arguments: string;
	};
}

/** メッセージ（OpenAI 互換ワイヤ形式） */
export interface ChatMessage {
	role: 'system' | 'user' | 'assistant' | 'tool';
	content: string | null;
	tool_calls?: ChatToolCall[];
	/** role: 'tool' のとき必須 */
	tool_call_id?: string;
}

/** function tool スキーマ */
export interface OpenAIToolSchema {
	type: 'function';
	function: {
		name: string;
		description: string;
		parameters: Record<string, unknown>;
	};
}

/** /v1/chat/completions レスポンス（必要な部分のみ） */
export interface ChatCompletionResponse {
	choices: {
		index: number;
		message: ChatMessage;
		finish_reason: string;
	}[];
	model?: string;
	usage?: {
		prompt_tokens?: number;
		completion_tokens?: number;
		total_tokens?: number;
	};
}

// =============================================================================
// チャットセッション（IndexedDB 永続化）
// =============================================================================

/**
 * チャットセッション
 *
 * 会話履歴を IndexedDB に永続化する単位。
 * 現状はセッション 1 つ（id: 'default'）のみ使用。
 */
export interface ChatSession {
	id: string;
	messages: ChatMessage[];
	/** 最後に使用したプロバイダ設定 ID */
	providerId?: string;
	createdAt: string;
	updatedAt: string;
}

/** 疎通テスト結果 */
export interface ConnectionTestResult {
	ok: boolean;
	message: string;
	/** /v1/models で取得できたモデル一覧（あれば） */
	models?: string[];
}
