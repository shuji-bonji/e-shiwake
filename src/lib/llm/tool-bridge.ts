/**
 * ツールブリッジ
 *
 * 既存の WebMCP ツール定義（webmcpTools / webmcpUITools）を
 * OpenAI 互換の function tool スキーマへ変換し、実行をディスパッチする。
 * ツール定義は単一ソース（src/lib/webmcp/）のまま 2 系統に供給される。
 */

import { webmcpTools } from '$lib/webmcp/tools';
import { webmcpUITools } from '$lib/webmcp/ui-tools';
import type { WebMCPToolDefinition, ToolExecutionResult } from '$lib/webmcp/types';
import type { OpenAIToolSchema } from './types';

/** チャットに公開する全ツール（データ操作 + UI 操作） */
export const allChatTools: WebMCPToolDefinition[] = [...webmcpTools, ...webmcpUITools];

/** ツール名 → 定義のマップ */
export const chatToolMap: Map<string, WebMCPToolDefinition> = new Map(
	allChatTools.map((t) => [t.name, t])
);

/**
 * 破壊的ツールか（実行前にユーザー承認が必要）
 *
 * confirm_delete_journal は元々 UI 確認（HITL）を経るため対象外。
 */
export function isDestructiveTool(name: string): boolean {
	return name === 'delete_journal';
}

/** WebMCP ツール定義 → OpenAI function tool スキーマ */
export function toOpenAITool(t: WebMCPToolDefinition): OpenAIToolSchema {
	return {
		type: 'function',
		function: {
			name: t.name,
			description: t.description,
			parameters: (t.inputSchema as unknown as Record<string, unknown>) ?? {
				type: 'object',
				properties: {}
			}
		}
	};
}

/** チャット用 OpenAI tools 配列 */
export function getOpenAIToolSchemas(): OpenAIToolSchema[] {
	return allChatTools.map(toOpenAITool);
}

/** ツール実行結果の上限文字数（ローカル LLM のコンテキスト予算保護） */
const MAX_TOOL_RESULT_LENGTH = 8000;

/** ToolExecutionResult → tool メッセージ本文テキスト */
export function resultToText(result: ToolExecutionResult): string {
	const text = result.content
		.filter((c) => c.type === 'text' && c.text)
		.map((c) => c.text)
		.join('\n');
	if (text.length > MAX_TOOL_RESULT_LENGTH) {
		return `${text.slice(0, MAX_TOOL_RESULT_LENGTH)}\n…（結果が長いため ${text.length} 文字中 ${MAX_TOOL_RESULT_LENGTH} 文字で打ち切り）`;
	}
	return text || '(結果なし)';
}

/**
 * ツールを実行する
 *
 * @returns tool メッセージ本文にするテキスト
 */
export async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
	const tool = chatToolMap.get(name);
	if (!tool) {
		return `エラー: 不明なツール "${name}"`;
	}
	try {
		const result = await tool.execute(args);
		return resultToText(result);
	} catch (e) {
		return `ツール実行エラー: ${e instanceof Error ? e.message : String(e)}`;
	}
}
