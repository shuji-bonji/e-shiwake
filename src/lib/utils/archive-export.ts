/**
 * 検索機能付アーカイブ ZIP エクスポート
 * 仕訳データ + 証憑PDF + 帳簿レポート + 検索HTML を単一ZIPとして生成
 * 「年度決算パッケージ」として自己完結型の長期保存に対応
 */

import JSZip from 'jszip';
import { from, of } from 'rxjs';
import { catchError, finalize, mergeMap } from 'rxjs/operators';
import type { ExportData, JournalEntry, Account } from '$lib/types';
import { getAttachmentBlob } from '$lib/db';
import { generateArchiveHtml, type ArchiveData } from './archive-html-template';
import { downloadZip, type FailedAttachment } from './zip-export';
import {
	generateJournalHTML,
	generateJournalCSV,
	generateLedgerHTML,
	generateLedgerCSV,
	generateTrialBalanceHTML,
	generateTrialBalanceCSV,
	generateProfitLossHTML,
	generateProfitLossCSV,
	generateBalanceSheetHTML,
	generateBalanceSheetCSV,
	generateTaxSummaryHTML,
	generateTaxSummaryCSV,
	getPrintStyles
} from './report-html';

export { downloadZip };

/**
 * アーカイブエクスポートの進捗情報
 */
export interface ArchiveExportProgress {
	phase: 'preparing' | 'collecting' | 'generating' | 'compressing' | 'complete';
	current: number;
	total: number;
	message: string;
	failedAttachments?: FailedAttachment[];
}

/**
 * アーカイブエクスポートのオプション
 */
export interface ArchiveExportOptions {
	onProgress?: (progress: ArchiveExportProgress) => void;
	directoryHandle?: FileSystemDirectoryHandle | null;
}

const CONCURRENCY = 4;

/**
 * 日付文字列から年度を安全に抽出
 */
function parseYearFromDate(dateStr: string): number {
	const match = /^(\d{4})-\d{2}-\d{2}$/.exec(dateStr);
	if (match) {
		const year = parseInt(match[1], 10);
		if (year >= 1900 && year <= 2100) {
			return year;
		}
	}
	return new Date().getFullYear();
}

/**
 * 仕訳から証憑情報を収集
 */
interface AttachmentInfo {
	journalId: string;
	attachmentId: string;
	generatedName: string;
	mimeType: string;
	storageType: string;
	filePath?: string;
	blobPurgedAt?: string;
	year: number;
}

function collectAttachments(journals: JournalEntry[]): AttachmentInfo[] {
	const result: AttachmentInfo[] = [];

	for (const journal of journals) {
		const year = parseYearFromDate(journal.date);

		for (const attachment of journal.attachments) {
			if (
				(attachment.storageType === 'indexeddb' && !attachment.blobPurgedAt) ||
				(attachment.storageType === 'filesystem' && attachment.filePath)
			) {
				result.push({
					journalId: journal.id,
					attachmentId: attachment.id,
					generatedName: attachment.generatedName,
					mimeType: attachment.mimeType,
					storageType: attachment.storageType,
					filePath: attachment.filePath,
					blobPurgedAt: attachment.blobPurgedAt,
					year
				});
			}
		}
	}

	return result;
}

/**
 * 勘定科目コードから名前へのマップを作成
 */
function buildAccountMap(accounts: Account[]): Map<string, string> {
	const map = new Map<string, string>();
	for (const account of accounts) {
		map.set(account.code, account.name);
	}
	return map;
}

/**
 * アーカイブHTML用のデータを構築
 */
function buildArchiveData(
	exportData: ExportData,
	journals: JournalEntry[],
	accountMap: Map<string, string>,
	attachmentPaths: Map<string, string>, // attachmentId -> ZIP内パス
	totalAttachments: number
): ArchiveData {
	return {
		meta: {
			appName: 'e-shiwake',
			appVersion: exportData.version,
			exportedAt: exportData.exportedAt,
			fiscalYear: exportData.fiscalYear,
			journalCount: journals.length,
			accountCount: exportData.accounts.length,
			vendorCount: exportData.vendors.length,
			attachmentCount: totalAttachments
		},
		accounts: exportData.accounts.map((a) => ({
			code: a.code,
			name: a.name,
			type: a.type
		})),
		journals: journals.map((j) => ({
			id: j.id,
			date: j.date,
			vendor: j.vendor,
			description: j.description,
			lines: j.lines.map((l) => ({
				type: l.type,
				accountCode: l.accountCode,
				accountName: accountMap.get(l.accountCode) || l.accountCode,
				amount: l.amount,
				taxCategory: l.taxCategory
			})),
			attachments: j.attachments
				.filter((a) => attachmentPaths.has(a.id))
				.map((a) => ({
					generatedName: a.generatedName,
					path: attachmentPaths.get(a.id)!
				}))
		}))
	};
}

/**
 * アーカイブZIPを生成
 * data.json + index.html + evidences/ → ZIP
 */
export async function exportArchiveZip(
	exportData: ExportData,
	journals: JournalEntry[],
	options: ArchiveExportOptions
): Promise<Blob> {
	const { onProgress, directoryHandle } = options;
	const zip = new JSZip();
	const accountMap = buildAccountMap(exportData.accounts);

	// Phase 1: 準備
	onProgress?.({
		phase: 'preparing',
		current: 0,
		total: 1,
		message: 'アーカイブを準備中...'
	});

	// data.json を追加
	zip.file('data.json', JSON.stringify(exportData, null, 2));

	// Phase 2: 証憑を収集
	const attachmentInfos = collectAttachments(journals);
	const total = attachmentInfos.length;
	const attachmentPaths = new Map<string, string>();
	const failedAttachments: FailedAttachment[] = [];

	if (total > 0) {
		const evidencesFolder = zip.folder('evidences');
		if (!evidencesFolder) {
			throw new Error('ZIP フォルダの作成に失敗しました');
		}

		let completed = 0;
		onProgress?.({
			phase: 'collecting',
			current: completed,
			total,
			message: `証憑を収集中... (${completed}/${total})`
		});

		await new Promise<void>((resolve) => {
			from(attachmentInfos)
				.pipe(
					mergeMap(
						(info) =>
							from(
								(async () => {
									const blob = await getAttachmentBlob(
										info.journalId,
										info.attachmentId,
										directoryHandle
									);

									if (!blob) {
										failedAttachments.push({
											fileName: info.generatedName,
											journalId: info.journalId,
											error: '証憑データが見つかりません'
										});
										return;
									}

									// ZIP内パス: evidences/{year}/{journalId}/{attachmentId}/{generatedName}
									const zipPath = `${info.year}/${info.journalId}/${info.attachmentId}/${info.generatedName}`;
									const relativePath = `evidences/${zipPath}`;
									attachmentPaths.set(info.attachmentId, relativePath);

									const yearFolder = evidencesFolder.folder(info.year.toString());
									if (!yearFolder) return;
									const journalFolder = yearFolder.folder(info.journalId);
									if (!journalFolder) return;
									const attachmentFolder = journalFolder.folder(info.attachmentId);
									if (!attachmentFolder) return;

									const arrayBuffer = await blob.arrayBuffer();
									attachmentFolder.file(info.generatedName, arrayBuffer);
								})()
							).pipe(
								catchError((error) => {
									failedAttachments.push({
										fileName: info.generatedName,
										journalId: info.journalId,
										error: error instanceof Error ? error.message : '不明なエラー'
									});
									return of(null);
								}),
								finalize(() => {
									completed++;
									onProgress?.({
										phase: 'collecting',
										current: completed,
										total,
										message: `証憑を収集中... (${completed}/${total})`
									});
								})
							),
						CONCURRENCY
					),
					finalize(() => resolve())
				)
				.subscribe();
		});
	}

	// Phase 3: 検索HTML + 帳簿レポート生成
	onProgress?.({
		phase: 'generating',
		current: 0,
		total: 1,
		message: '検索HTML・帳簿レポートを生成中...'
	});

	const archiveData = buildArchiveData(
		exportData,
		journals,
		accountMap,
		attachmentPaths,
		total - failedAttachments.length
	);
	const html = generateArchiveHtml(archiveData);
	zip.file('index.html', html);

	// 帳簿レポートを生成して同梱
	const fiscalYear = exportData.fiscalYear;
	const accounts = exportData.accounts;
	const reportsFolder = zip.folder('reports');
	if (reportsFolder) {
		const printStyles = getPrintStyles();

		// HTML帳簿（印刷可能な形式）
		const htmlFolder = reportsFolder.folder('html');
		if (htmlFolder) {
			const wrapHtml = (title: string, body: string) =>
				`<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${title} — ${fiscalYear}年度</title><style>${printStyles}</style></head><body>${body}</body></html>`;

			htmlFolder.file(
				`仕訳帳_${fiscalYear}.html`,
				wrapHtml('仕訳帳', generateJournalHTML(journals, accounts, fiscalYear))
			);
			htmlFolder.file(
				`総勘定元帳_${fiscalYear}.html`,
				wrapHtml('総勘定元帳', generateLedgerHTML(journals, accounts, fiscalYear, 'used'))
			);
			htmlFolder.file(
				`試算表_${fiscalYear}.html`,
				wrapHtml('試算表', generateTrialBalanceHTML(journals, accounts, fiscalYear))
			);
			htmlFolder.file(
				`損益計算書_${fiscalYear}.html`,
				wrapHtml('損益計算書', generateProfitLossHTML(journals, accounts, fiscalYear))
			);
			htmlFolder.file(
				`貸借対照表_${fiscalYear}.html`,
				wrapHtml('貸借対照表', generateBalanceSheetHTML(journals, accounts, fiscalYear))
			);
			htmlFolder.file(
				`消費税集計_${fiscalYear}.html`,
				wrapHtml('消費税集計', generateTaxSummaryHTML(journals, fiscalYear))
			);
		}

		// CSV帳簿（データ連携用）
		const csvFolder = reportsFolder.folder('csv');
		if (csvFolder) {
			csvFolder.file(`仕訳帳_${fiscalYear}.csv`, generateJournalCSV(journals, accounts));
			csvFolder.file(`総勘定元帳_${fiscalYear}.csv`, generateLedgerCSV(journals, accounts, 'used'));
			csvFolder.file(`試算表_${fiscalYear}.csv`, generateTrialBalanceCSV(journals, accounts));
			csvFolder.file(
				`損益計算書_${fiscalYear}.csv`,
				generateProfitLossCSV(journals, accounts, fiscalYear)
			);
			csvFolder.file(
				`貸借対照表_${fiscalYear}.csv`,
				generateBalanceSheetCSV(journals, accounts, fiscalYear)
			);
			csvFolder.file(`消費税集計_${fiscalYear}.csv`, generateTaxSummaryCSV(journals, fiscalYear));
		}
	}

	// Phase 4: 圧縮
	onProgress?.({
		phase: 'compressing',
		current: 0,
		total: 1,
		message: 'ZIP ファイルを生成中...'
	});

	const zipBlob = await zip.generateAsync({
		type: 'blob',
		compression: 'DEFLATE',
		compressionOptions: { level: 6 }
	});

	let completeMessage = '完了';
	if (failedAttachments.length > 0) {
		completeMessage = `完了（${failedAttachments.length}件の証憑取得に失敗）`;
	}

	onProgress?.({
		phase: 'complete',
		current: 1,
		total: 1,
		message: completeMessage,
		failedAttachments: failedAttachments.length > 0 ? failedAttachments : undefined
	});

	return zipBlob;
}
