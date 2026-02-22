/**
 * インポート/エクスポートのテスト（添付ファイル + データ移行）
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	initializeDatabase,
	addJournal,
	getJournalsByYear,
	getJournalById,
	generateAttachmentName,
	suggestDocumentType,
	validateExportData,
	importData,
	getImportPreview,
	deleteYearData
} from './index';
import { clearAllTables } from './test-helpers';

// テスト用のデフォルト設定
const testSettings = {
	fiscalYearStart: 1,
	defaultCurrency: 'JPY',
	storageMode: 'indexeddb' as const,
	autoPurgeBlobAfterExport: true,
	blobRetentionDays: 30
};

describe('添付ファイル', () => {
	describe('generateAttachmentName', () => {
		it('正しいファイル名を生成する', () => {
			const name = generateAttachmentName(
				'2024-01-15',
				'receipt',
				'コーヒー代',
				500,
				'スターバックス'
			);

			expect(name).toBe('2024-01-15_領収書_コーヒー代_500円_スターバックス.pdf');
		});

		it('特殊文字がサニタイズされる', () => {
			const name = generateAttachmentName('2024-01-15', 'receipt', 'テスト/購入', 1000, 'A*B?C');

			expect(name).not.toContain('/');
			expect(name).not.toContain('*');
			expect(name).not.toContain('?');
		});

		it('空の摘要・取引先はデフォルト値になる', () => {
			const name = generateAttachmentName('2024-01-15', 'receipt', '', 1000, '');

			expect(name).toContain('未分類');
			expect(name).toContain('不明');
		});

		it('金額がカンマ区切りでフォーマットされる', () => {
			const name = generateAttachmentName('2024-01-15', 'receipt', 'テスト', 1234567, 'テスト社');

			expect(name).toContain('1,234,567円');
		});
	});

	describe('suggestDocumentType', () => {
		it('費用系は請求書（受領）を提案', () => {
			expect(suggestDocumentType('expense')).toBe('bill');
		});

		it('収益系は請求書（発行）を提案', () => {
			expect(suggestDocumentType('revenue')).toBe('invoice');
		});

		it('その他は請求書（受領）を返す', () => {
			expect(suggestDocumentType('asset')).toBe('bill');
			expect(suggestDocumentType('liability')).toBe('bill');
			expect(suggestDocumentType(null)).toBe('bill');
		});

		it('借方が未払金系の場合は領収書を提案', () => {
			// 未払金（2004）、未払費用（2005）、未払消費税（2006）
			expect(suggestDocumentType('liability', '2004')).toBe('receipt');
			expect(suggestDocumentType('liability', '2005')).toBe('receipt');
			expect(suggestDocumentType('liability', '2006')).toBe('receipt');
			// 他の負債は請求書（受領）
			expect(suggestDocumentType('liability', '2001')).toBe('bill');
		});
	});
});

describe('インポート/エクスポート', () => {
	describe('validateExportData', () => {
		it('有効なデータを検証できる', () => {
			const validData = {
				version: '1.0.0',
				exportedAt: '2024-01-15T00:00:00.000Z',
				fiscalYear: 2024,
				journals: [],
				accounts: [],
				vendors: [],
				settings: {}
			};

			expect(validateExportData(validData)).toBe(true);
		});

		it('仕訳を含む有効なデータを検証できる', () => {
			const validData = {
				version: '1.0.0',
				exportedAt: '2024-01-15T00:00:00.000Z',
				fiscalYear: 2024,
				journals: [
					{
						id: 'test-id',
						date: '2024-01-15',
						lines: [],
						vendor: 'テスト',
						description: 'テスト仕訳',
						evidenceStatus: 'none',
						attachments: [],
						createdAt: '2024-01-15T00:00:00.000Z',
						updatedAt: '2024-01-15T00:00:00.000Z'
					}
				],
				accounts: [],
				vendors: [],
				settings: {}
			};

			expect(validateExportData(validData)).toBe(true);
		});

		it('無効なデータを検出できる', () => {
			expect(validateExportData(null)).toBe(false);
			expect(validateExportData({})).toBe(false);
			expect(validateExportData({ version: '1.0.0' })).toBe(false);
			expect(
				validateExportData({
					version: '1.0.0',
					exportedAt: '2024-01-15',
					fiscalYear: '2024', // 数値でないといけない
					journals: [],
					accounts: [],
					vendors: []
				})
			).toBe(false);
		});

		it('仕訳にcreatedAt/updatedAtがない場合は無効', () => {
			// createdAtがない
			expect(
				validateExportData({
					version: '1.0.0',
					exportedAt: '2024-01-15T00:00:00.000Z',
					fiscalYear: 2024,
					journals: [
						{
							id: 'test-id',
							date: '2024-01-15',
							lines: [],
							updatedAt: '2024-01-15T00:00:00.000Z'
							// createdAtがない
						}
					],
					accounts: [],
					vendors: []
				})
			).toBe(false);

			// updatedAtがない
			expect(
				validateExportData({
					version: '1.0.0',
					exportedAt: '2024-01-15T00:00:00.000Z',
					fiscalYear: 2024,
					journals: [
						{
							id: 'test-id',
							date: '2024-01-15',
							lines: [],
							createdAt: '2024-01-15T00:00:00.000Z'
							// updatedAtがない
						}
					],
					accounts: [],
					vendors: []
				})
			).toBe(false);
		});

		it('仕訳にid/date/linesがない場合は無効', () => {
			// idがない
			expect(
				validateExportData({
					version: '1.0.0',
					exportedAt: '2024-01-15T00:00:00.000Z',
					fiscalYear: 2024,
					journals: [
						{
							date: '2024-01-15',
							lines: [],
							createdAt: '2024-01-15T00:00:00.000Z',
							updatedAt: '2024-01-15T00:00:00.000Z'
						}
					],
					accounts: [],
					vendors: []
				})
			).toBe(false);

			// dateがない
			expect(
				validateExportData({
					version: '1.0.0',
					exportedAt: '2024-01-15T00:00:00.000Z',
					fiscalYear: 2024,
					journals: [
						{
							id: 'test-id',
							lines: [],
							createdAt: '2024-01-15T00:00:00.000Z',
							updatedAt: '2024-01-15T00:00:00.000Z'
						}
					],
					accounts: [],
					vendors: []
				})
			).toBe(false);

			// linesがない
			expect(
				validateExportData({
					version: '1.0.0',
					exportedAt: '2024-01-15T00:00:00.000Z',
					fiscalYear: 2024,
					journals: [
						{
							id: 'test-id',
							date: '2024-01-15',
							createdAt: '2024-01-15T00:00:00.000Z',
							updatedAt: '2024-01-15T00:00:00.000Z'
						}
					],
					accounts: [],
					vendors: []
				})
			).toBe(false);
		});
	});

	describe('deleteYearData', () => {
		beforeEach(async () => {
			await clearAllTables();
			await initializeDatabase();
		});

		afterEach(async () => {
			await clearAllTables();
		});

		it('指定した年度の仕訳を削除できる', async () => {
			// 2024年の仕訳を追加
			await addJournal({
				date: '2024-03-15',
				lines: [
					{ id: '1', type: 'debit', accountCode: '5006', amount: 1000 },
					{ id: '2', type: 'credit', accountCode: '1002', amount: 1000 }
				],
				vendor: 'A社',
				description: '2024年仕訳1',
				evidenceStatus: 'none',
				attachments: []
			});

			await addJournal({
				date: '2024-06-20',
				lines: [
					{ id: '3', type: 'debit', accountCode: '5006', amount: 2000 },
					{ id: '4', type: 'credit', accountCode: '1002', amount: 2000 }
				],
				vendor: 'B社',
				description: '2024年仕訳2',
				evidenceStatus: 'none',
				attachments: []
			});

			// 2025年の仕訳を追加
			await addJournal({
				date: '2025-01-10',
				lines: [
					{ id: '5', type: 'debit', accountCode: '5006', amount: 3000 },
					{ id: '6', type: 'credit', accountCode: '1002', amount: 3000 }
				],
				vendor: 'C社',
				description: '2025年仕訳',
				evidenceStatus: 'none',
				attachments: []
			});

			// 2024年のデータを削除
			const result = await deleteYearData(2024);

			expect(result.journalCount).toBe(2);
			expect(result.attachmentCount).toBe(0);

			// 2024年の仕訳がなくなっていることを確認
			const journals2024 = await getJournalsByYear(2024);
			expect(journals2024).toHaveLength(0);

			// 2025年の仕訳は残っていることを確認
			const journals2025 = await getJournalsByYear(2025);
			expect(journals2025).toHaveLength(1);
			expect(journals2025[0].description).toBe('2025年仕訳');
		});

		it('仕訳がない年度は0件で返る', async () => {
			const result = await deleteYearData(2020);

			expect(result.journalCount).toBe(0);
			expect(result.attachmentCount).toBe(0);
		});
	});

	describe('getImportPreview', () => {
		beforeEach(async () => {
			await clearAllTables();
			await initializeDatabase();
		});

		afterEach(async () => {
			await clearAllTables();
		});

		it('インポートプレビューを取得できる', async () => {
			const exportData = {
				version: '1.0.0',
				exportedAt: '2024-01-15T00:00:00.000Z',
				fiscalYear: 2024,
				journals: [
					{
						id: 'journal-1',
						date: '2024-01-15',
						lines: [
							{ id: '1', type: 'debit' as const, accountCode: '5006', amount: 1000 },
							{ id: '2', type: 'credit' as const, accountCode: '1002', amount: 1000 }
						],
						vendor: '新規取引先',
						description: 'テスト仕訳',
						evidenceStatus: 'none' as const,
						attachments: [],
						createdAt: '2024-01-15T00:00:00.000Z',
						updatedAt: '2024-01-15T00:00:00.000Z'
					}
				],
				accounts: [
					{
						code: '5200',
						name: 'カスタム科目',
						type: 'expense' as const,
						isSystem: false,
						createdAt: '2024-01-15T00:00:00.000Z'
					}
				],
				vendors: [{ id: 'v1', name: '新規取引先', createdAt: '2024-01-15T00:00:00.000Z' }],
				settings: testSettings
			};

			const preview = await getImportPreview(exportData);

			expect(preview.fiscalYear).toBe(2024);
			expect(preview.journalCount).toBe(1);
			expect(preview.newJournalCount).toBe(1);
			expect(preview.accountCount).toBe(1);
			expect(preview.newAccountCount).toBe(1);
			expect(preview.vendorCount).toBe(1);
			expect(preview.newVendorCount).toBe(1);
		});

		it('既存データがある場合は新規カウントが正しい', async () => {
			// 既存の仕訳を追加
			await addJournal({
				date: '2024-02-01',
				lines: [
					{ id: '1', type: 'debit', accountCode: '5006', amount: 500 },
					{ id: '2', type: 'credit', accountCode: '1002', amount: 500 }
				],
				vendor: '既存取引先',
				description: '既存仕訳',
				evidenceStatus: 'none',
				attachments: []
			});

			const exportData = {
				version: '1.0.0',
				exportedAt: '2024-01-15T00:00:00.000Z',
				fiscalYear: 2024,
				journals: [
					{
						id: 'new-journal',
						date: '2024-01-15',
						lines: [
							{ id: '1', type: 'debit' as const, accountCode: '5006', amount: 1000 },
							{ id: '2', type: 'credit' as const, accountCode: '1002', amount: 1000 }
						],
						vendor: '既存取引先',
						description: 'インポート仕訳',
						evidenceStatus: 'none' as const,
						attachments: [],
						createdAt: '2024-01-15T00:00:00.000Z',
						updatedAt: '2024-01-15T00:00:00.000Z'
					}
				],
				accounts: [],
				vendors: [{ id: 'v1', name: '既存取引先', createdAt: '2024-01-15T00:00:00.000Z' }],
				settings: testSettings
			};

			const preview = await getImportPreview(exportData);

			expect(preview.journalCount).toBe(1);
			expect(preview.newJournalCount).toBe(1);
			expect(preview.vendorCount).toBe(1);
			expect(preview.newVendorCount).toBe(0); // 既存取引先なので0
		});
	});

	describe('importData', () => {
		beforeEach(async () => {
			await clearAllTables();
			await initializeDatabase();
		});

		afterEach(async () => {
			await clearAllTables();
		});

		it('マージモードでインポートできる', async () => {
			// 既存の仕訳を追加
			const existingId = await addJournal({
				date: '2024-02-01',
				lines: [
					{ id: '1', type: 'debit', accountCode: '5006', amount: 500 },
					{ id: '2', type: 'credit', accountCode: '1002', amount: 500 }
				],
				vendor: '既存取引先',
				description: '既存仕訳',
				evidenceStatus: 'none',
				attachments: []
			});

			const exportData = {
				version: '1.0.0',
				exportedAt: '2024-01-15T00:00:00.000Z',
				fiscalYear: 2024,
				journals: [
					{
						id: 'new-journal',
						date: '2024-01-15',
						lines: [
							{ id: '1', type: 'debit' as const, accountCode: '5006', amount: 1000 },
							{ id: '2', type: 'credit' as const, accountCode: '1002', amount: 1000 }
						],
						vendor: '新規取引先',
						description: 'インポート仕訳',
						evidenceStatus: 'none' as const,
						attachments: [],
						createdAt: '2024-01-15T00:00:00.000Z',
						updatedAt: '2024-01-15T00:00:00.000Z'
					}
				],
				accounts: [],
				vendors: [],
				settings: testSettings
			};

			const result = await importData(exportData, 'merge');

			expect(result.success).toBe(true);
			expect(result.journalsImported).toBe(1);

			// 既存の仕訳が残っていることを確認
			const existingJournal = await getJournalById(existingId);
			expect(existingJournal).toBeDefined();
			expect(existingJournal?.description).toBe('既存仕訳');

			// 新規仕訳がインポートされていることを確認
			const journals = await getJournalsByYear(2024);
			expect(journals).toHaveLength(2);
		});

		it('上書きモードでインポートできる', async () => {
			// 既存の仕訳を追加
			await addJournal({
				date: '2024-02-01',
				lines: [
					{ id: '1', type: 'debit', accountCode: '5006', amount: 500 },
					{ id: '2', type: 'credit', accountCode: '1002', amount: 500 }
				],
				vendor: '既存取引先',
				description: '既存仕訳',
				evidenceStatus: 'none',
				attachments: []
			});

			const exportData = {
				version: '1.0.0',
				exportedAt: '2024-01-15T00:00:00.000Z',
				fiscalYear: 2024,
				journals: [
					{
						id: 'new-journal',
						date: '2024-01-15',
						lines: [
							{ id: '1', type: 'debit' as const, accountCode: '5006', amount: 1000 },
							{ id: '2', type: 'credit' as const, accountCode: '1002', amount: 1000 }
						],
						vendor: '新規取引先',
						description: 'インポート仕訳',
						evidenceStatus: 'none' as const,
						attachments: [],
						createdAt: '2024-01-15T00:00:00.000Z',
						updatedAt: '2024-01-15T00:00:00.000Z'
					}
				],
				accounts: [],
				vendors: [],
				settings: testSettings
			};

			const result = await importData(exportData, 'overwrite');

			expect(result.success).toBe(true);
			expect(result.journalsImported).toBe(1);

			// 既存の仕訳が削除されていることを確認
			const journals = await getJournalsByYear(2024);
			expect(journals).toHaveLength(1);
			expect(journals[0].description).toBe('インポート仕訳');
		});

		it('勘定科目と取引先もインポートされる', async () => {
			const exportData = {
				version: '1.0.0',
				exportedAt: '2024-01-15T00:00:00.000Z',
				fiscalYear: 2024,
				journals: [],
				accounts: [
					{
						code: '5200',
						name: 'カスタム科目',
						type: 'expense' as const,
						isSystem: false,
						createdAt: '2024-01-15T00:00:00.000Z'
					}
				],
				vendors: [{ id: 'v1', name: '新規取引先', createdAt: '2024-01-15T00:00:00.000Z' }],
				settings: testSettings
			};

			const result = await importData(exportData, 'merge');

			expect(result.success).toBe(true);
			expect(result.accountsImported).toBe(1);
			expect(result.vendorsImported).toBe(1);

			// 勘定科目がインポートされていることを確認
			const { db } = await import('./index');
			const account = await db.accounts.get('5200');
			expect(account).toBeDefined();
			expect(account?.name).toBe('カスタム科目');

			// 取引先がインポートされていることを確認
			const { getAllVendors } = await import('./index');
			const vendors = await getAllVendors();
			const found = vendors.find((v) => v.name === '新規取引先');
			expect(found).toBeDefined();
		});

		it('家事按分メタデータがマージモードで保持される', async () => {
			const exportData = {
				version: '1.0.0',
				exportedAt: '2024-01-15T00:00:00.000Z',
				fiscalYear: 2024,
				journals: [
					{
						id: 'business-ratio-journal',
						date: '2024-06-01',
						lines: [
							{
								id: 'line-1',
								type: 'debit' as const,
								accountCode: '5001',
								amount: 8000,
								taxCategory: 'purchase_10' as const,
								memo: '事業分80%',
								_businessRatioApplied: true,
								_originalAmount: 10000,
								_businessRatio: 80,
								_businessRatioGenerated: false
							},
							{
								id: 'line-2',
								type: 'debit' as const,
								accountCode: '3002',
								amount: 2000,
								memo: '家事分20%',
								_businessRatioApplied: true,
								_originalAmount: 10000,
								_businessRatio: 80,
								_businessRatioGenerated: true
							},
							{
								id: 'line-3',
								type: 'credit' as const,
								accountCode: '1002',
								amount: 10000
							}
						],
						vendor: 'NTTドコモ',
						description: '携帯電話代',
						evidenceStatus: 'none' as const,
						attachments: [],
						createdAt: '2024-06-01T00:00:00.000Z',
						updatedAt: '2024-06-01T00:00:00.000Z'
					}
				],
				accounts: [],
				vendors: [],
				settings: testSettings
			};

			const result = await importData(exportData, 'merge');

			expect(result.success).toBe(true);
			expect(result.journalsImported).toBe(1);

			// 家事按分メタデータが保持されていることを確認
			const journal = await getJournalById('business-ratio-journal');
			expect(journal).toBeDefined();

			const debitLine1 = journal?.lines.find((l) => l.id === 'line-1');
			expect(debitLine1?._businessRatioApplied).toBe(true);
			expect(debitLine1?._originalAmount).toBe(10000);
			expect(debitLine1?._businessRatio).toBe(80);
			expect(debitLine1?._businessRatioGenerated).toBe(false);
			expect(debitLine1?.taxCategory).toBe('purchase_10');

			const debitLine2 = journal?.lines.find((l) => l.id === 'line-2');
			expect(debitLine2?._businessRatioApplied).toBe(true);
			expect(debitLine2?._businessRatioGenerated).toBe(true);
		});

		it('家事按分メタデータが上書きモードで保持される', async () => {
			// 既存の仕訳を追加（上書きされる）
			await addJournal({
				date: '2024-06-01',
				lines: [
					{ id: '1', type: 'debit', accountCode: '5001', amount: 5000 },
					{ id: '2', type: 'credit', accountCode: '1002', amount: 5000 }
				],
				vendor: '既存',
				description: '既存仕訳',
				evidenceStatus: 'none',
				attachments: []
			});

			const exportData = {
				version: '1.0.0',
				exportedAt: '2024-01-15T00:00:00.000Z',
				fiscalYear: 2024,
				journals: [
					{
						id: 'overwrite-journal',
						date: '2024-06-15',
						lines: [
							{
								id: 'line-1',
								type: 'debit' as const,
								accountCode: '5005',
								amount: 4000,
								taxCategory: 'purchase_10' as const,
								_businessRatioApplied: true,
								_originalAmount: 5000,
								_businessRatio: 80,
								_businessRatioGenerated: false
							},
							{
								id: 'line-2',
								type: 'debit' as const,
								accountCode: '3002',
								amount: 1000,
								_businessRatioApplied: true,
								_originalAmount: 5000,
								_businessRatio: 80,
								_businessRatioGenerated: true
							},
							{
								id: 'line-3',
								type: 'credit' as const,
								accountCode: '1001',
								amount: 5000
							}
						],
						vendor: 'JR',
						description: '交通費（按分）',
						evidenceStatus: 'none' as const,
						attachments: [],
						createdAt: '2024-06-15T00:00:00.000Z',
						updatedAt: '2024-06-15T00:00:00.000Z'
					}
				],
				accounts: [],
				vendors: [],
				settings: testSettings
			};

			const result = await importData(exportData, 'overwrite');

			expect(result.success).toBe(true);

			// 上書きモードでも家事按分メタデータが保持されていることを確認
			const journal = await getJournalById('overwrite-journal');
			expect(journal).toBeDefined();

			const debitLine1 = journal?.lines.find((l) => l.id === 'line-1');
			expect(debitLine1?._businessRatioApplied).toBe(true);
			expect(debitLine1?._originalAmount).toBe(5000);
			expect(debitLine1?._businessRatio).toBe(80);
			expect(debitLine1?.taxCategory).toBe('purchase_10');

			const debitLine2 = journal?.lines.find((l) => l.id === 'line-2');
			expect(debitLine2?._businessRatioGenerated).toBe(true);
		});
	});
});
