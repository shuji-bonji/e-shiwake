import JSZip from 'jszip';
import { from, of } from 'rxjs';
import { catchError, finalize, mergeMap } from 'rxjs/operators';
import type { BackupData, ExportData, Attachment } from '$lib/types';
import { validateExportData, validateBackupData } from '$lib/db';

/**
 * ZIPインポートの進捗情報
 * onProgressコールバック経由でUI更新用に利用
 *
 * @property phase - 現在のフェーズ（extracting: 展開中、processing: 処理中、storing: 保存中、complete: 完了）
 * @property current - 処理済み件数
 * @property total - 合計件数
 * @property message - ユーザー向けメッセージ
 */
export interface ZipImportProgress {
	phase: 'extracting' | 'processing' | 'storing' | 'complete';
	current: number;
	total: number;
	message: string;
}

/**
 * ZIPインポートの結果（ExportData 形式）
 */
export interface ZipImportExportResult {
	dataType: 'export';
	exportData: ExportData;
	attachmentBlobs: Map<string, Blob>;
	warnings: string[];
}

/**
 * ZIPインポートの結果（BackupData 形式）
 */
export interface ZipImportBackupResult {
	dataType: 'backup';
	backupData: BackupData;
	attachmentBlobs: Map<string, Blob>;
	warnings: string[];
}

/**
 * ZIPインポートの結果（判別済み）
 */
export type ZipImportResult = ZipImportExportResult | ZipImportBackupResult;

/**
 * 後方互換: 旧形式の結果型（exportData プロパティで直接アクセス）
 * @deprecated ZipImportResult を使用してください
 */
export interface ZipImportResultLegacy {
	exportData: ExportData;
	attachmentBlobs: Map<string, Blob>;
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
 * ZIPファイルからデータ（JSON）と証憑（PDF）を抽出
 * data.jsonの妥当性を検証し、証憑ファイルを収集。新形式（年度別フォルダ）と旧形式の両方に対応
 *
 * @param file - インポートするZIPファイル
 * @param onProgress - 進捗コールバック関数（オプション）
 * @returns インポート結果（仕訳データ、証憑Blob、警告メッセージ）
 * @throws data.jsonが存在しない、または形式が不正な場合
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
	let parsedData: unknown;

	try {
		parsedData = JSON.parse(dataJsonText);
	} catch {
		throw new Error('data.jsonの解析に失敗しました');
	}

	// BackupData か ExportData かを判別
	const isBackup = validateBackupData(parsedData);
	const isExport = !isBackup && validateExportData(parsedData);

	if (!isBackup && !isExport) {
		throw new Error(
			'ファイル形式が正しくありません。e-shiwakeからエクスポートしたZIPファイルを選択してください。'
		);
	}

	// BackupData / ExportData どちらでも journals を取り出す
	const journals = isBackup
		? (parsedData as BackupData).journals
		: (parsedData as ExportData).journals;

	// Phase 3: 証憑ファイルを抽出
	const attachmentBlobs = new Map<string, Blob>();

	// 証憑ファイル名からattachment IDへのマッピングを作成
	const fileNameToAttachment = new Map<string, { journalId: string; attachment: Attachment }>();
	const attachmentIdToAttachment = new Map<string, { journalId: string; attachment: Attachment }>();
	const duplicateFileNames = new Set<string>();

	for (const journal of journals) {
		for (const attachment of journal.attachments) {
			// 同名ファイルの衝突を検知
			if (fileNameToAttachment.has(attachment.generatedName)) {
				duplicateFileNames.add(attachment.generatedName);
				warnings.push(
					`同名の証憑ファイルが複数存在します: ${attachment.generatedName}（旧形式ZIPでは最後の1件のみ使用されます）`
				);
			}
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
									// journalIdが指定されていて一致しない場合はスキップ（データ不整合）
									if (journalId && attachmentInfo.journalId !== journalId) {
										warnings.push(
											`証憑と仕訳の対応が一致しません（スキップ）: ${attachmentId} (期待: ${attachmentInfo.journalId}, 実際: ${journalId})`
										);
										return;
									}
									// ファイル名の不一致は警告のみ（リネームの可能性あり）
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

	if (isBackup) {
		return {
			dataType: 'backup' as const,
			backupData: parsedData as BackupData,
			attachmentBlobs,
			warnings
		};
	}

	return {
		dataType: 'export' as const,
		exportData: parsedData as ExportData,
		attachmentBlobs,
		warnings
	};
}

/**
 * ファイルがZIPファイルかどうかをMIMEタイプで判定
 * MIMEタイプまたはファイル名拡張子で判定
 *
 * @param file - 判定するファイル
 * @returns ZIPファイルの場合true
 */
export function isZipFile(file: File): boolean {
	return (
		file.type === 'application/zip' ||
		file.type === 'application/x-zip-compressed' ||
		file.name.toLowerCase().endsWith('.zip')
	);
}
