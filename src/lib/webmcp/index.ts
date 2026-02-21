/**
 * e-shiwake WebMCP 初期化モジュール
 *
 * Chrome 146+ の navigator.modelContext API にツールを登録する。
 * WebMCP が利用できない環境では何もしない（graceful degradation）。
 *
 * @experimental WebMCP Early Preview（2026年2月）
 *
 * 使い方:
 *   onMount 内で initWebMCP() を呼び出す。
 *   ツールの登録解除は destroyWebMCP() で行う。
 *
 * 前提:
 *   Chrome Canary 146+ で chrome://flags → "WebMCP for testing" を有効にすること。
 */

import type { ToolRegistration } from './types';
import { webmcpTools } from './tools';

/** 登録済みツールの参照を保持 */
let registrations: ToolRegistration[] = [];

/** WebMCP が利用可能かチェック */
export function isWebMCPAvailable(): boolean {
	return (
		typeof navigator !== 'undefined' &&
		'modelContext' in navigator &&
		navigator.modelContext !== undefined
	);
}

/**
 * WebMCP ツールを登録する
 *
 * @returns 登録されたツール数（0 = WebMCP非対応環境）
 */
export function initWebMCP(): number {
	if (!isWebMCPAvailable()) {
		console.info('[e-shiwake WebMCP] navigator.modelContext が利用できません。WebMCP は無効です。');
		console.info(
			'[e-shiwake WebMCP] Chrome Canary 146+ で chrome://flags → "WebMCP for testing" を有効にしてください。'
		);
		return 0;
	}

	// 既存の登録をクリーンアップ
	destroyWebMCP();

	const mc = navigator.modelContext!;

	for (const tool of webmcpTools) {
		try {
			const registration = mc.registerTool(tool);
			registrations.push(registration);
			console.info(`[e-shiwake WebMCP] ツール登録: ${tool.name}`);
		} catch (e) {
			console.error(`[e-shiwake WebMCP] ツール登録失敗: ${tool.name}`, e);
		}
	}

	console.info(
		`[e-shiwake WebMCP] ${registrations.length}/${webmcpTools.length} ツールを登録しました`
	);
	return registrations.length;
}

/**
 * WebMCP ツールの登録を解除する
 */
export function destroyWebMCP(): void {
	for (const registration of registrations) {
		try {
			registration.unregister();
		} catch {
			// 無視
		}
	}
	registrations = [];
}

/**
 * 登録済みツールの情報を取得する（デバッグ用）
 */
export function getRegisteredToolNames(): string[] {
	return webmcpTools.map((t) => t.name);
}
