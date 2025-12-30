import JSZip from 'jszip';
import type {
	ExportData,
	ExportDataDTO,
	JournalEntry,
	Attachment,
	ExportAttachment
} from '$lib/types';
import { getAttachmentBlob } from '$lib/db';

/**
 * 取得失敗した証憑情報
 */
export interface FailedAttachment {
	fileName: string;
	journalId: string;
	error: string;
}

/**
 * ZIP エクスポートの進捗コールバック
 */
export interface ZipExportProgress {
	phase: 'preparing' | 'collecting' | 'compressing' | 'complete';
	current: number;
	total: number;
	message: string;
	/** 取得失敗した証憑一覧（complete時に設定） */
	failedAttachments?: FailedAttachment[];
}

/**
 * ZIP エクスポートのオプション
 */
export interface ZipExportOptions {
	includeEvidences: boolean;
	onProgress?: (progress: ZipExportProgress) => void;
	directoryHandle?: FileSystemDirectoryHandle | null;
}

/**
 * 年度データを ZIP ファイルとしてエクスポート
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

	// 各証憑を追加
	for (let i = 0; i < attachments.length; i++) {
		const { journalId, attachment, year } = attachments[i];

		onProgress?.({
			phase: 'collecting',
			current: i + 1,
			total,
			message: `証憑を収集中... (${i + 1}/${total})`
		});

		try {
			const blob = await getAttachmentBlob(journalId, attachment.id, directoryHandle);

			if (blob) {
				// 年度別フォルダに保存
				const yearFolder = evidencesFolder.folder(year.toString());
				if (yearFolder) {
					// BlobをArrayBufferに変換（Node.js環境との互換性のため）
					const arrayBuffer = await blob.arrayBuffer();
					yearFolder.file(attachment.generatedName, arrayBuffer);
				}
			} else {
				// Blobがnullの場合も失敗として記録
				failedAttachments.push({
					fileName: attachment.generatedName,
					journalId,
					error: '証憑データが見つかりません'
				});
			}
		} catch (error) {
			console.warn(`証憑の取得に失敗: ${attachment.generatedName}`, error);
			failedAttachments.push({
				fileName: attachment.generatedName,
				journalId,
				error: error instanceof Error ? error.message : '不明なエラー'
			});
			// 失敗しても続行
		}
	}

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
 * エクスポートデータから Blob を除外
 */
function prepareExportData(data: ExportData): ExportDataDTO {
	return {
		...data,
		journals: data.journals.map((journal) => ({
			...journal,
			attachments: journal.attachments.map((attachment): ExportAttachment => {
				// blob を除外、メタデータのみ保持
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				const { blob, ...rest } = attachment;
				return rest;
			})
		}))
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
			// Blob または filePath があるものを対象
			if (attachment.blob || attachment.filePath) {
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
 * ZIP ファイルをダウンロード
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
