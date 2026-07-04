/**
 * LLM プロバイダ設定の IndexedDB 永続化
 *
 * API キーを含む設定は llmProviders テーブル（端末内）にのみ保存する。
 * アクティブなプロバイダ ID は settings テーブルの 'activeLlmProviderId' に保存。
 */

import { db } from '$lib/db/database';
import { getSetting, setSetting } from '$lib/db/settings-repository';
import type { LLMProviderConfig } from './types';

/** Svelte $state プロキシを除去してプレーンオブジェクト化 */
function toPlain<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

/** 全プロバイダ設定を取得 */
export async function getAllProviders(): Promise<LLMProviderConfig[]> {
	return db.llmProviders.toArray();
}

/** プロバイダ設定を取得 */
export async function getProvider(id: string): Promise<LLMProviderConfig | undefined> {
	return db.llmProviders.get(id);
}

/** プロバイダ設定を追加 */
export async function addProvider(
	config: Omit<LLMProviderConfig, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
	const now = new Date().toISOString();
	const record: LLMProviderConfig = {
		...toPlain(config),
		id: crypto.randomUUID(),
		createdAt: now,
		updatedAt: now
	};
	await db.llmProviders.add(record);
	return record.id;
}

/** プロバイダ設定を更新 */
export async function updateProvider(
	id: string,
	updates: Partial<Omit<LLMProviderConfig, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
	await db.llmProviders.update(id, {
		...toPlain(updates),
		updatedAt: new Date().toISOString()
	});
}

/** プロバイダ設定を削除 */
export async function deleteProvider(id: string): Promise<void> {
	await db.llmProviders.delete(id);
	// アクティブだった場合は解除
	const activeId = await getActiveProviderId();
	if (activeId === id) {
		await setSetting('activeLlmProviderId', '');
	}
}

/** アクティブなプロバイダ ID を取得 */
export async function getActiveProviderId(): Promise<string | null> {
	const id = await getSetting('activeLlmProviderId');
	return id || null;
}

/** アクティブなプロバイダを設定 */
export async function setActiveProviderId(id: string): Promise<void> {
	await setSetting('activeLlmProviderId', id);
}

/** アクティブなプロバイダ設定を取得（未設定時は null） */
export async function getActiveProvider(): Promise<LLMProviderConfig | null> {
	const id = await getActiveProviderId();
	if (!id) return null;
	return (await db.llmProviders.get(id)) ?? null;
}
