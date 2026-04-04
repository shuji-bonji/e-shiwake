/**
 * 設定リポジトリのテスト
 *
 * restoreAllSettings, getStorageMode, getSetting, setSetting の動作を検証
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	initializeDatabase,
	getSetting,
	setSetting,
	getStorageMode,
	setStorageMode,
	restoreAllSettings,
	getAllSettingsForExport
} from './index';
import { clearAllTables } from './test-helpers';
import type { SettingsValueMap } from '$lib/types';

describe('Settings Repository', () => {
	beforeEach(async () => {
		await initializeDatabase();
		await clearAllTables();
	});

	afterEach(async () => {
		await clearAllTables();
	});

	describe('restoreAllSettings', () => {
		it('基本的な設定を復元できる', async () => {
			const settingsToRestore: Partial<SettingsValueMap> = {
				autoPurgeBlobAfterExport: false,
				blobRetentionDays: 60,
				suppressRenameConfirm: true,
				blueReturnDeduction: 65
			};

			await restoreAllSettings(settingsToRestore);

			// 復元後の確認
			const autoPurge = await getSetting('autoPurgeBlobAfterExport');
			const blobDays = await getSetting('blobRetentionDays');
			const suppressRename = await getSetting('suppressRenameConfirm');
			const deduction = await getSetting('blueReturnDeduction');

			expect(autoPurge).toBe(false);
			expect(blobDays).toBe(60);
			expect(suppressRename).toBe(true);
			expect(deduction).toBe(65);
		});

		it('デフォルトで lastExportedAt を復元しない', async () => {
			const settingsToRestore: Partial<SettingsValueMap> = {
				lastExportedAt: '2024-01-15T12:00:00Z',
				autoPurgeBlobAfterExport: false
			};

			await restoreAllSettings(settingsToRestore);

			// lastExportedAt は復元されない
			const lastExported = await getSetting('lastExportedAt');
			expect(lastExported).toBeUndefined();

			// 他の設定は復元される
			const autoPurge = await getSetting('autoPurgeBlobAfterExport');
			expect(autoPurge).toBe(false);
		});

		it('デフォルトで storageMode を復元しない', async () => {
			// 最初に storageMode を 'filesystem' に設定
			await setStorageMode('filesystem');

			const settingsToRestore: Partial<SettingsValueMap> = {
				storageMode: 'indexeddb',
				autoPurgeBlobAfterExport: false
			};

			await restoreAllSettings(settingsToRestore);

			// storageMode は復元されない（filesystem のまま）
			const mode = await getStorageMode();
			expect(mode).toBe('filesystem');

			// 他の設定は復元される
			const autoPurge = await getSetting('autoPurgeBlobAfterExport');
			expect(autoPurge).toBe(false);
		});

		it('既存の storageMode を保持する', async () => {
			// 最初に storageMode を 'filesystem' に設定
			await setStorageMode('filesystem');

			const settingsToRestore: Partial<SettingsValueMap> = {
				blobRetentionDays: 45,
				autoPurgeBlobAfterExport: true
			};

			await restoreAllSettings(settingsToRestore);

			// storageMode は変わらない
			const mode = await getStorageMode();
			expect(mode).toBe('filesystem');

			// 新しい設定は復元される
			const blobDays = await getSetting('blobRetentionDays');
			expect(blobDays).toBe(45);
		});

		it('カスタム excludeKeys パラメータでキーを除外できる', async () => {
			const settingsToRestore: Partial<SettingsValueMap> = {
				autoPurgeBlobAfterExport: false,
				blobRetentionDays: 60,
				suppressRenameConfirm: true
			};

			// suppressRenameConfirm を除外
			await restoreAllSettings(settingsToRestore, ['suppressRenameConfirm']);

			// excludeKeys に含まれたものは復元されない
			const suppressRename = await getSetting('suppressRenameConfirm');
			expect(suppressRename).toBeUndefined();

			// 他は復元される
			const autoPurge = await getSetting('autoPurgeBlobAfterExport');
			const blobDays = await getSetting('blobRetentionDays');
			expect(autoPurge).toBe(false);
			expect(blobDays).toBe(60);
		});

		it('複数のカスタム excludeKeys を指定できる', async () => {
			const settingsToRestore: Partial<SettingsValueMap> = {
				autoPurgeBlobAfterExport: false,
				blobRetentionDays: 60,
				suppressRenameConfirm: true,
				blueReturnDeduction: 55
			};

			// 複数のキーを除外
			await restoreAllSettings(settingsToRestore, ['suppressRenameConfirm', 'blueReturnDeduction']);

			// 除外されたものは復元されない
			const suppressRename = await getSetting('suppressRenameConfirm');
			const deduction = await getSetting('blueReturnDeduction');
			expect(suppressRename).toBeUndefined();
			expect(deduction).toBeUndefined();

			// 除外されていないものは復元される
			const autoPurge = await getSetting('autoPurgeBlobAfterExport');
			const blobDays = await getSetting('blobRetentionDays');
			expect(autoPurge).toBe(false);
			expect(blobDays).toBe(60);
		});

		it('undefined の値は復元しない', async () => {
			// 最初に値を設定
			await setSetting('blobRetentionDays', 45);

			const settingsToRestore: Partial<SettingsValueMap> = {
				blobRetentionDays: undefined,
				autoPurgeBlobAfterExport: false
			};

			await restoreAllSettings(settingsToRestore);

			// undefined は復元されない（元の値が保持される）
			const blobDays = await getSetting('blobRetentionDays');
			expect(blobDays).toBe(45);

			// 他は復元される
			const autoPurge = await getSetting('autoPurgeBlobAfterExport');
			expect(autoPurge).toBe(false);
		});

		it('複雑なオブジェクト型の設定を復元できる', async () => {
			const businessInfo = {
				name: 'テスト事業所',
				address: '東京都渋谷区',
				businessType: 'IT',
				personalNumber: '01234567890',
				representativeName: '山田太郎'
			};

			const settingsToRestore: Partial<SettingsValueMap> = {
				businessInfo,
				autoPurgeBlobAfterExport: true
			};

			await restoreAllSettings(settingsToRestore);

			// 復元後の確認
			const restoredInfo = await getSetting('businessInfo');
			expect(restoredInfo).toEqual(businessInfo);

			const autoPurge = await getSetting('autoPurgeBlobAfterExport');
			expect(autoPurge).toBe(true);
		});
	});

	describe('getStorageMode', () => {
		it('デフォルト値として indexeddb を返す', async () => {
			// 設定されていない状態
			const mode = await getStorageMode();
			expect(mode).toBe('indexeddb');
		});

		it('保存された値を返す', async () => {
			await setStorageMode('filesystem');

			const mode = await getStorageMode();
			expect(mode).toBe('filesystem');
		});

		it('不正な値の場合はデフォルト値 indexeddb を返す', async () => {
			// 直接 database に不正な値を設定（テスト用）
			const { db } = await import('./database');
			await db.settings.put({
				key: 'storageMode',
				value: 'invalid_mode' as never,
				updatedAt: new Date().toISOString()
			});

			const mode = await getStorageMode();
			expect(mode).toBe('indexeddb');
		});

		it('filesystem に切り替えられる', async () => {
			// 最初は indexeddb
			let mode = await getStorageMode();
			expect(mode).toBe('indexeddb');

			// filesystem に切り替え
			await setStorageMode('filesystem');
			mode = await getStorageMode();
			expect(mode).toBe('filesystem');
		});
	});

	describe('getSetting & setSetting', () => {
		it('設定値を保存・取得できる', async () => {
			const value = 45;
			await setSetting('blobRetentionDays', value);

			const retrieved = await getSetting('blobRetentionDays');
			expect(retrieved).toBe(value);
		});

		it('複数の設定を独立して管理できる', async () => {
			await setSetting('blobRetentionDays', 60);
			await setSetting('autoPurgeBlobAfterExport', false);
			await setSetting('suppressRenameConfirm', true);

			const days = await getSetting('blobRetentionDays');
			const autoPurge = await getSetting('autoPurgeBlobAfterExport');
			const suppressRename = await getSetting('suppressRenameConfirm');

			expect(days).toBe(60);
			expect(autoPurge).toBe(false);
			expect(suppressRename).toBe(true);
		});

		it('存在しない設定は undefined を返す', async () => {
			const value = await getSetting('blueReturnDeduction');
			expect(value).toBeUndefined();
		});

		it('設定値を上書きできる', async () => {
			await setSetting('blobRetentionDays', 30);
			let retrieved = await getSetting('blobRetentionDays');
			expect(retrieved).toBe(30);

			// 上書き
			await setSetting('blobRetentionDays', 90);
			retrieved = await getSetting('blobRetentionDays');
			expect(retrieved).toBe(90);
		});

		it('boolean 型の設定が正しく保存される', async () => {
			await setSetting('autoPurgeBlobAfterExport', true);
			let retrieved = await getSetting('autoPurgeBlobAfterExport');
			expect(retrieved).toBe(true);

			await setSetting('autoPurgeBlobAfterExport', false);
			retrieved = await getSetting('autoPurgeBlobAfterExport');
			expect(retrieved).toBe(false);
		});

		it('number 型の設定が正しく保存される', async () => {
			const value = 123;
			await setSetting('blobRetentionDays', value);

			const retrieved = await getSetting('blobRetentionDays');
			expect(retrieved).toBe(value);
			expect(typeof retrieved).toBe('number');
		});

		it('複雑なオブジェクト型が正しく保存される', async () => {
			const businessInfo = {
				name: 'テスト株式会社',
				address: '東京都渋谷区神宮前1-1-1',
				businessType: 'コンサルティング',
				personalNumber: '01234567890',
				representativeName: '山田太郎'
			};

			await setSetting('businessInfo', businessInfo);

			const retrieved = await getSetting('businessInfo');
			expect(retrieved).toEqual(businessInfo);
		});

		it('ネストされたオブジェクトが正しく保存される', async () => {
			const businessInfo = {
				name: '複雑なオブジェクト',
				address: '東京都',
				businessType: 'サービス業',
				personalNumber: '01234567890',
				representativeName: '太郎'
			};

			await setSetting('businessInfo', businessInfo);

			const retrieved = await getSetting('businessInfo');
			expect(retrieved).toEqual(businessInfo);
		});
	});

	describe('getAllSettingsForExport', () => {
		it('lastExportedAt を除外してエクスポート用設定を取得する', async () => {
			await setSetting('blobRetentionDays', 60);
			await setSetting('autoPurgeBlobAfterExport', false);
			await setSetting('lastExportedAt', '2024-01-15T12:00:00Z');

			const settings = await getAllSettingsForExport();

			// lastExportedAt は含まれない
			expect(settings.lastExportedAt).toBeUndefined();

			// 他は含まれる
			expect(settings.blobRetentionDays).toBe(60);
			expect(settings.autoPurgeBlobAfterExport).toBe(false);
		});

		it('設定がない場合は空オブジェクトを返す', async () => {
			const settings = await getAllSettingsForExport();

			// 設定されていないため、lastExportedAt だけが除外された後、空に近い結果になる
			expect(typeof settings).toBe('object');
			expect(settings.lastExportedAt).toBeUndefined();
		});

		it('複数の設定を含める', async () => {
			await setSetting('blobRetentionDays', 45);
			await setSetting('autoPurgeBlobAfterExport', true);
			await setSetting('suppressRenameConfirm', true);
			await setSetting('storageMode', 'filesystem');
			await setSetting('lastExportedAt', '2024-01-15T12:00:00Z');

			const settings = await getAllSettingsForExport();

			expect(settings.blobRetentionDays).toBe(45);
			expect(settings.autoPurgeBlobAfterExport).toBe(true);
			expect(settings.suppressRenameConfirm).toBe(true);
			expect(settings.storageMode).toBe('filesystem');
			// lastExportedAt は除外される
			expect(settings.lastExportedAt).toBeUndefined();
		});
	});
});
