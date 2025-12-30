import JSZip from 'jszip';
import type { ExportData, JournalEntry, Attachment } from '$lib/types';
import { getAttachmentBlob } from '$lib/db';

/**
 * ZIP エクスポートの進捗コールバック
 */
export interface ZipExportProgress {
	phase: 'preparing' | 'collecting' | 'compressing' | 'complete';
	current: number;
	total: number;
	message: string;
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
			}
		} catch (error) {
			console.warn(`証憑の取得に失敗: ${attachment.generatedName}`, error);
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

	onProgress?.({
		phase: 'complete',
		current: total,
		total,
		message: '完了'
	});

	return zipBlob;
}

/**
 * エクスポートデータから Blob を除外
 */
function prepareExportData(data: ExportData): ExportData {
	return {
		...data,
		journals: data.journals.map((journal) => ({
			...journal,
			attachments: journal.attachments.map((attachment) => {
				// blob を除外、メタデータのみ保持
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				const { blob, ...rest } = attachment as Attachment & { blob?: Blob };
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

function collectAttachments(journals: JournalEntry[]): AttachmentInfo[] {
	const result: AttachmentInfo[] = [];

	for (const journal of journals) {
		const year = parseInt(journal.date.substring(0, 4), 10);

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
	URL.revokeObjectURL(url);
}
