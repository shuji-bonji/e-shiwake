/**
 * WebMCP 型定義
 *
 * navigator.modelContext API の型定義（Chrome 146+ Early Preview）
 * @see https://webmachinelearning.github.io/webmcp/
 * @see https://developer.chrome.com/blog/webmcp-epp
 */

/**
 * ツール実行結果のコンテンツブロック
 */
export interface ContentBlock {
	type: 'text' | 'image' | 'resource';
	text?: string;
	data?: string; // Base64 encoded
	mimeType?: string;
}

/**
 * ツール実行結果
 */
export interface ToolExecutionResult {
	content: ContentBlock[];
}

/**
 * ツール実行コールバック
 */
export type ToolExecuteCallback = (
	input: Record<string, unknown>,
	client?: unknown
) => Promise<ToolExecutionResult>;

/**
 * JSON Schema v7 サブセット（ツール入力定義用）
 */
export interface ToolInputSchema {
	type: 'object';
	properties: Record<
		string,
		{
			type: string;
			description?: string;
			enum?: string[];
			minimum?: number;
			maximum?: number;
			items?: { type: string };
		}
	>;
	required?: string[];
	additionalProperties?: boolean;
}

/**
 * WebMCP ツール定義
 */
export interface WebMCPToolDefinition {
	name: string;
	description: string;
	inputSchema?: ToolInputSchema;
	execute: ToolExecuteCallback;
}

/**
 * ツール登録結果
 */
export interface ToolRegistration {
	unregister: () => void;
}

/**
 * navigator.modelContext API
 */
export interface ModelContextAPI {
	registerTool: (tool: WebMCPToolDefinition) => ToolRegistration;
}

/**
 * navigator 拡張（WebMCP対応）
 */
declare global {
	interface Navigator {
		modelContext?: ModelContextAPI;
	}
}
