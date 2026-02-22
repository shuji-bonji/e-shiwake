/**
 * データベース初期化のテスト
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db, initializeDatabase, getAllAccounts } from './index';
import { clearAllTables } from './test-helpers';

describe('データベース初期化', () => {
	beforeEach(async () => {
		await clearAllTables();
	});

	afterEach(async () => {
		await clearAllTables();
	});

	it('初回起動時にデフォルト勘定科目が登録される', async () => {
		await initializeDatabase();

		const accounts = await getAllAccounts();
		expect(accounts.length).toBeGreaterThan(0);

		// システム科目が登録されていることを確認
		const cashAccount = accounts.find((a) => a.code === '1001');
		expect(cashAccount).toBeDefined();
		expect(cashAccount?.name).toBe('現金');
		expect(cashAccount?.isSystem).toBe(true);
	});

	it('2回目以降の初期化では重複登録されない', async () => {
		await initializeDatabase();
		const countFirst = await db.accounts.count();

		await initializeDatabase();
		const countSecond = await db.accounts.count();

		expect(countFirst).toBe(countSecond);
	});
});
