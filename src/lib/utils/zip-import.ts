import JSZip from 'jszip';
import { from, of } from 'rxjs';
import { catchError, finalize, mergeMap } from 'rxjs/operators';
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

const CONCURRENCY = 4;

interface EvidencePathInfo {
	journalId?: string;
	attachmentId?: string;
	fileName: string;
}

function parseEvidencePath(path: string): EvidencePathInfo | null {
	const normalized = path.replace(/^\/+/, '');
	if (!normalized.startsWith('evidences/')) return null;

	const parts = normalized.split('/');
	if (parts.length < 3) return null;

	// 新形式: evidences/{year}/{journalId}/{attachmentId}/{fileName}
	if (parts.length >= 5) {
		const yearSegment = parts[1];
		if (/^\d{4}$/.test(yearSegment)) {
			const journalId = parts[2];
			const attachmentId = parts[3];
			const fileName = parts.slice(4).join('/');
			return { journalId, attachmentId, fileName };
		}
	}

	// 新形式（年なし）: evidences/{journalId}/{attachmentId}/{fileName}
	if (parts.length >= 4) {
		const journalId = parts[1];
		const attachmentId = parts[2];
		const fileName = parts.slice(3).join('/');
		return { journalId, attachmentId, fileName };
	}

	// 旧形式: evidences/{year}/{fileName}
	return { fileName: parts.slice(2).join('/') };
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
	const attachmentIdToAttachment = new Map<string, { journalId: string; attachment: Attachment }>();
	for (const journal of exportData.journals) {
		for (const attachment of journal.attachments) {
			fileNameToAttachment.set(attachment.generatedName, {
				journalId: journal.id,
				attachment
			});
			attachmentIdToAttachment.set(attachment.id, {
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
	let completed = 0;

	onProgress?.({
		phase: 'storing',
		current: completed,
		total,
		message: `証憑を読み込み中... (${completed}/${total})`
	});

	await new Promise<void>((resolve) => {
		from(evidenceFiles)
			.pipe(
				mergeMap(
					(filePath) =>
						from(
							(async () => {
								const parsed = parseEvidencePath(filePath);
								if (!parsed) {
									warnings.push(`不明な証憑パス形式: ${filePath}`);
									return;
								}

								const { fileName, journalId, attachmentId } = parsed;
								if (!fileName) {
									warnings.push(`証憑ファイル名が取得できません: ${filePath}`);
									return;
								}

								let attachmentInfo: { journalId: string; attachment: Attachment } | undefined;
								if (attachmentId) {
									attachmentInfo = attachmentIdToAttachment.get(attachmentId);
									if (!attachmentInfo) {
										warnings.push(`不明な証憑ID: ${attachmentId}`);
										return;
									}
									if (journalId && attachmentInfo.journalId !== journalId) {
										warnings.push(`証憑と仕訳の対応が一致しません: ${attachmentId} (${journalId})`);
									}
									if (attachmentInfo.attachment.generatedName !== fileName) {
										warnings.push(`証憑ファイル名が一致しません: ${fileName}`);
									}
								} else {
									attachmentInfo = fileNameToAttachment.get(fileName);
									if (!attachmentInfo) {
										warnings.push(`不明な証憑ファイル: ${fileName}`);
										return;
									}
								}

								const fileData = await zip.files[filePath].async('arraybuffer');
								const blob = new Blob([fileData], {
									type: attachmentInfo.attachment.mimeType
								});
								attachmentBlobs.set(attachmentInfo.attachment.id, blob);
							})()
						).pipe(
							catchError((error) => {
								warnings.push(
									`証憑の読み込みに失敗: ${filePath} - ${
										error instanceof Error ? error.message : '不明なエラー'
									}`
								);
								return of(null);
							}),
							finalize(() => {
								completed++;
								onProgress?.({
									phase: 'storing',
									current: completed,
									total,
									message: `証憑を読み込み中... (${completed}/${total})`
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
