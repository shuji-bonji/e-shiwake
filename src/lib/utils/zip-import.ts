import JSZip from 'jszip';
import type { ExportData, Attachment } from '$lib/types';
import { validateExportData } from '$lib/db';

/**
 * ZIP インポートの進捗コールバック
 */
export interface ZipImportProgress {
	phase: 'extracting' | 'processing' | 'storing' | 'complete';
	current: number;
	total: number;
	message: string;
}

/**
 * ZIP インポートの結果
 */
export interface ZipImportResult {
	exportData: ExportData;
	attachmentBlobs: Map<string, Blob>; // attachmentId -> Blob
	warnings: string[];
}

/**
 * ZIP ファイルからデータと証憑を抽出
 */
export async function importFromZip(
	file: File,
	onProgress?: (progress: ZipImportProgress) => void
): Promise<ZipImportResult> {
	const warnings: string[] = [];

	// Phase 1: ZIP を展開
	onProgress?.({
		phase: 'extracting',
		current: 0,
		total: 1,
		message: 'ZIPファイルを展開中...'
	});

	const arrayBuffer = await file.arrayBuffer();
	const zip = await JSZip.loadAsync(arrayBuffer);

	// Phase 2: data.json を読み込み
	onProgress?.({
		phase: 'processing',
		current: 0,
		total: 1,
		message: 'データを読み込み中...'
	});

	const dataJsonFile = zip.file('data.json');
	if (!dataJsonFile) {
		throw new Error('ZIPファイルにdata.jsonが含まれていません');
	}

	const dataJsonText = await dataJsonFile.async('string');
	let exportData: ExportData;

	try {
		exportData = JSON.parse(dataJsonText);
	} catch {
		throw new Error('data.jsonの解析に失敗しました');
	}

	if (!validateExportData(exportData)) {
		throw new Error(
			'ファイル形式が正しくありません。e-shiwakeからエクスポートしたZIPファイルを選択してください。'
		);
	}

	// Phase 3: 証憑ファイルを抽出
	const attachmentBlobs = new Map<string, Blob>();

	// 証憑ファイル名からattachment IDへのマッピングを作成
	const fileNameToAttachment = new Map<string, { journalId: string; attachment: Attachment }>();
	for (const journal of exportData.journals) {
		for (const attachment of journal.attachments) {
			fileNameToAttachment.set(attachment.generatedName, {
				journalId: journal.id,
				attachment
			});
		}
	}

	// evidences フォルダ内のファイルを処理
	const evidenceFiles = Object.keys(zip.files).filter(
		(path) => path.startsWith('evidences/') && !zip.files[path].dir
	);

	const total = evidenceFiles.length;

	for (let i = 0; i < evidenceFiles.length; i++) {
		const filePath = evidenceFiles[i];
		const fileName = filePath.split('/').pop();

		onProgress?.({
			phase: 'storing',
			current: i + 1,
			total,
			message: `証憑を読み込み中... (${i + 1}/${total})`
		});

		if (!fileName) continue;

		const attachmentInfo = fileNameToAttachment.get(fileName);
		if (!attachmentInfo) {
			warnings.push(`不明な証憑ファイル: ${fileName}`);
			continue;
		}

		try {
			const fileData = await zip.files[filePath].async('arraybuffer');
			const blob = new Blob([fileData], { type: attachmentInfo.attachment.mimeType });
			attachmentBlobs.set(attachmentInfo.attachment.id, blob);
		} catch (error) {
			warnings.push(
				`証憑の読み込みに失敗: ${fileName} - ${error instanceof Error ? error.message : '不明なエラー'}`
			);
		}
	}

	onProgress?.({
		phase: 'complete',
		current: total,
		total,
		message: `完了（${attachmentBlobs.size}件の証憑を読み込み）`
	});

	return {
		exportData,
		attachmentBlobs,
		warnings
	};
}

/**
 * ファイルがZIPファイルかどうかを判定
 */
export function isZipFile(file: File): boolean {
	return (
		file.type === 'application/zip' ||
		file.type === 'application/x-zip-compressed' ||
		file.name.toLowerCase().endsWith('.zip')
	);
}
