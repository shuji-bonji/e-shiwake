import JSZip from 'jszip';
import { from, of } from 'rxjs';
import { catchError, finalize, mergeMap } from 'rxjs/operators';
import type { BackupData, ExportData, ExportDataDTO, JournalEntry, Attachment } from '$lib/types';
import { getAttachmentBlob } from '$lib/db';

/**
 * ZIPエクスポート時に取得失敗した証憑情報
 *
 * @property fileName - 証憑ファイル名
 * @property journalId - 紐付く仕訳ID
 * @property error - エラーメッセージ
 */
export interface FailedAttachment {
	fileName: string;
	journalId: string;
	error: string;
}

/**
 * ZIPエクスポートの進捗情報
 * onProgressコールバック経由でUI更新用に利用
 *
 * @property phase - 現在のフェーズ（preparing: 準備中、collecting: 証憑収集中、compressing: 圧縮中、complete: 完了）
 * @property current - 処理済み件数
 * @property total - 合計件数
 * @property message - ユーザー向けメッセージ
 * @property failedAttachments - 取得失敗した証憑一覧（complete時のみ設定）
 */
export interface ZipExportProgress {
	phase: 'preparing' | 'collecting' | 'compressing' | 'complete';
	current: number;
	total: number;
	message: string;
	failedAttachments?: FailedAttachment[];
}

/**
 * ZIPエクスポートのオプション
 *
 * @property includeEvidences - 証憑ファイルを含めるか
 * @property onProgress - 進捗コールバック関数（オプション）
 * @property directoryHandle - ファイルシステム保存の場合のディレクトリハンドル（オプション）
 */
export interface ZipExportOptions {
	includeEvidences: boolean;
	onProgress?: (progress: ZipExportProgress) => void;
	directoryHandle?: FileSystemDirectoryHandle | null;
}

const CONCURRENCY = 4;

/**
 * 年度データ（仕訳・設定・証憑）をZIPファイルとしてエクスポート
 * JSZipライブラリを使用して、data.json + 証憑PDFをZIP形式で圧縮
 *
 * @param exportData - エクスポートするデータ（仕訳、勘定科目、取引先、設定）
 * @param journals - 仕訳配列（証憑の仕訳IDマッピング用）
 * @param options - エクスポートオプション
 * @returns ZIPファイルのBlob
 * @throws ZIPフォルダ作成に失敗した場合
 */
export async function exportToZip(
	exportData: ExportData,
	journals: JournalEntry[],
	options: ZipExportOptions
): Promise<Blob> {
	const { includeEvidences = true, onProgress, directoryHandle } = options;
	const zip = new JSZip();

	// Phase 1: 準備
	onProgress?.({
		phase: 'preparing',
		current: 0,
		total: 1,
		message: 'エクスポートを準備中...'
	});

	// data.json を追加（証憑の Blob は除外）
	const dataForExport = prepareExportData(exportData);
	zip.file('data.json', JSON.stringify(dataForExport, null, 2));

	if (!includeEvidences) {
		// 証憑なしの場合はすぐに完了
		onProgress?.({
			phase: 'complete',
			current: 1,
			total: 1,
			message: '完了'
		});
		return await zip.generateAsync({ type: 'blob' });
	}

	// Phase 2: 証憑を収集
	const attachments = collectAttachments(journals);
	const total = attachments.length;

	if (total === 0) {
		onProgress?.({
			phase: 'complete',
			current: 1,
			total: 1,
			message: '完了（証憑なし）'
		});
		return await zip.generateAsync({ type: 'blob' });
	}

	// evidences フォルダを作成
	const evidencesFolder = zip.folder('evidences');
	if (!evidencesFolder) {
		throw new Error('ZIP フォルダの作成に失敗しました');
	}

	// 失敗した証憑を追跡
	const failedAttachments: FailedAttachment[] = [];
	let completed = 0;

	onProgress?.({
		phase: 'collecting',
		current: completed,
		total,
		message: `証憑を収集中... (${completed}/${total})`
	});

	function recordFailure(journalId: string, fileName: string, error: string) {
		failedAttachments.push({ fileName, journalId, error });
	}

	// 各証憑を追加
	await new Promise<void>((resolve) => {
		from(attachments)
			.pipe(
				mergeMap(
					({ journalId, attachment, year }) =>
						from(
							(async () => {
								const blob = await getAttachmentBlob(journalId, attachment.id, directoryHandle);

								if (!blob) {
									recordFailure(journalId, attachment.generatedName, '証憑データが見つかりません');
									return;
								}

								const yearFolder = evidencesFolder.folder(year.toString());
								if (!yearFolder) {
									recordFailure(
										journalId,
										attachment.generatedName,
										'年度フォルダの作成に失敗しました'
									);
									return;
								}

								const journalFolder = yearFolder.folder(journalId);
								if (!journalFolder) {
									recordFailure(
										journalId,
										attachment.generatedName,
										'仕訳フォルダの作成に失敗しました'
									);
									return;
								}

								const attachmentFolder = journalFolder.folder(attachment.id);
								if (!attachmentFolder) {
									recordFailure(
										journalId,
										attachment.generatedName,
										'証憑フォルダの作成に失敗しました'
									);
									return;
								}

								const arrayBuffer = await blob.arrayBuffer();
								attachmentFolder.file(attachment.generatedName, arrayBuffer);
							})()
						).pipe(
							catchError((error) => {
								console.warn(`証憑の取得に失敗: ${attachment.generatedName}`, error);
								recordFailure(
									journalId,
									attachment.generatedName,
									error instanceof Error ? error.message : '不明なエラー'
								);
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
				finalize(() => {
					resolve();
				})
			)
			.subscribe();
	});

	// Phase 3: 圧縮
	onProgress?.({
		phase: 'compressing',
		current: total,
		total,
		message: 'ZIP ファイルを生成中...'
	});

	const zipBlob = await zip.generateAsync({
		type: 'blob',
		compression: 'DEFLATE',
		compressionOptions: { level: 6 }
	});

	// 完了メッセージを構築
	let completeMessage = '完了';
	if (failedAttachments.length > 0) {
		completeMessage = `完了（${failedAttachments.length}件の証憑取得に失敗）`;
	}

	onProgress?.({
		phase: 'complete',
		current: total,
		total,
		message: completeMessage,
		failedAttachments: failedAttachments.length > 0 ? failedAttachments : undefined
	});

	return zipBlob;
}

/**
 * フルバックアップ（全年度スナップショット）をZIPファイルとしてエクスポート
 *
 * @param backupData - バックアップデータ（全年度の仕訳・マスタ・設定）
 * @param options - エクスポートオプション
 * @returns ZIPファイルのBlob
 */
export async function exportBackupToZip(
	backupData: BackupData,
	options: ZipExportOptions
): Promise<Blob> {
	const { includeEvidences = true, onProgress, directoryHandle } = options;
	const zip = new JSZip();

	onProgress?.({
		phase: 'preparing',
		current: 0,
		total: 1,
		message: 'バックアップを準備中...'
	});

	// data.json を追加（BackupData をそのまま保存）
	const dataForExport = prepareBackupData(backupData);
	zip.file('data.json', JSON.stringify(dataForExport, null, 2));

	if (!includeEvidences) {
		onProgress?.({
			phase: 'complete',
			current: 1,
			total: 1,
			message: '完了'
		});
		return await zip.generateAsync({ type: 'blob' });
	}

	// 全年度の仕訳から証憑を収集
	const attachments = collectAttachments(backupData.journals);
	const total = attachments.length;

	if (total === 0) {
		onProgress?.({
			phase: 'complete',
			current: 1,
			total: 1,
			message: '完了（証憑なし）'
		});
		return await zip.generateAsync({ type: 'blob' });
	}

	const evidencesFolder = zip.folder('evidences');
	if (!evidencesFolder) {
		throw new Error('ZIP フォルダの作成に失敗しました');
	}

	const failedAttachments: FailedAttachment[] = [];
	let completed = 0;

	onProgress?.({
		phase: 'collecting',
		current: completed,
		total,
		message: `証憑を収集中... (${completed}/${total})`
	});

	function recordFailure(journalId: string, fileName: string, error: string) {
		failedAttachments.push({ fileName, journalId, error });
	}

	await new Promise<void>((resolve) => {
		from(attachments)
			.pipe(
				mergeMap(
					({ journalId, attachment, year }) =>
						from(
							(async () => {
								const blob = await getAttachmentBlob(journalId, attachment.id, directoryHandle);
								if (!blob) {
									recordFailure(journalId, attachment.generatedName, '証憑データが見つかりません');
									return;
								}

								const yearFolder = evidencesFolder.folder(year.toString());
								if (!yearFolder) {
									recordFailure(
										journalId,
										attachment.generatedName,
										'年度フォルダの作成に失敗しました'
									);
									return;
								}

								const journalFolder = yearFolder.folder(journalId);
								if (!journalFolder) {
									recordFailure(
										journalId,
										attachment.generatedName,
										'仕訳フォルダの作成に失敗しました'
									);
									return;
								}

								const attachmentFolder = journalFolder.folder(attachment.id);
								if (!attachmentFolder) {
									recordFailure(
										journalId,
										attachment.generatedName,
										'証憑フォルダの作成に失敗しました'
									);
									return;
								}

								const arrayBuffer = await blob.arrayBuffer();
								attachmentFolder.file(attachment.generatedName, arrayBuffer);
							})()
						).pipe(
							catchError((error) => {
								console.warn(`証憑の取得に失敗: ${attachment.generatedName}`, error);
								recordFailure(
									journalId,
									attachment.generatedName,
									error instanceof Error ? error.message : '不明なエラー'
								);
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
				finalize(() => {
					resolve();
				})
			)
			.subscribe();
	});

	onProgress?.({
		phase: 'compressing',
		current: total,
		total,
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
		current: total,
		total,
		message: completeMessage,
		failedAttachments: failedAttachments.length > 0 ? failedAttachments : undefined
	});

	return zipBlob;
}

/**
 * BackupData をJSON用に準備
 */
function prepareBackupData(data: BackupData): BackupData {
	// Attachment 内の Blob 参照は attachmentBlobs テーブルに分離されているため、
	// BackupData のメタデータはそのまま保存可能
	return { ...data };
}

/**
 * エクスポートデータを DTO に変換
 * Blob は attachmentBlobs テーブルに分離されているため、
 * Attachment にはメタデータのみが含まれている。
 */
function prepareExportData(data: ExportData): ExportDataDTO {
	return {
		...data
	};
}

/**
 * 仕訳から証憑情報を収集
 */
interface AttachmentInfo {
	journalId: string;
	attachment: Attachment;
	year: number;
}

/**
 * 日付文字列から年度を安全に抽出
 * YYYY-MM-DD 形式を想定、不正な場合は現在年度を返す
 */
function parseYearFromDate(dateStr: string): number {
	// YYYY-MM-DD 形式のバリデーション
	const match = /^(\d{4})-\d{2}-\d{2}$/.exec(dateStr);
	if (match) {
		const year = parseInt(match[1], 10);
		// 妥当な年度範囲（1900-2100）をチェック
		if (year >= 1900 && year <= 2100) {
			return year;
		}
	}
	// 不正な日付の場合は現在年度を使用
	console.warn(`不正な日付形式: ${dateStr}、現在年度を使用します`);
	return new Date().getFullYear();
}

function collectAttachments(journals: JournalEntry[]): AttachmentInfo[] {
	const result: AttachmentInfo[] = [];

	for (const journal of journals) {
		const year = parseYearFromDate(journal.date);

		for (const attachment of journal.attachments) {
			// indexeddb（purge済みでない）または filesystem のものを対象
			if (
				(attachment.storageType === 'indexeddb' && !attachment.blobPurgedAt) ||
				(attachment.storageType === 'filesystem' && attachment.filePath)
			) {
				result.push({
					journalId: journal.id,
					attachment,
					year
				});
			}
		}
	}

	return result;
}

/**
 * ZIPファイルのBlobをブラウザダウンロード
 * ObjectURL経由でダウンロード処理を実行
 *
 * @param blob - ダウンロードするZIPファイルのBlob
 * @param filename - ダウンロード時のファイル名（例：「e-shiwake-2025.zip」）
 */
export function downloadZip(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	// ダウンロード完了まで待機してからURL解放（環境によっては即時解放でダウンロード中断の可能性あり）
	setTimeout(() => {
		URL.revokeObjectURL(url);
	}, 1000);
}
