/**
 * テストヘルパー関数
 *
 * テスト間のDBクリーンアップを提供
 */
import { db } from './index';

/**
 * 全テーブルをクリアするヘルパー関数
 * テスト間の独立性を保証する
 */
export async function clearAllTables() {
	await db.accounts.clear();
	await db.journals.clear();
	await db.vendors.clear();
	await db.settings.clear();
	await db.invoices.clear();
	// attachmentsテーブルは仕訳に埋め込まれているため個別クリア不要
	// （journalsクリアで一緒に削除される）
}
