/**
 * File System Access API ユーティリティ
 * デスクトップ向けのファイルシステム操作
 */

import { db } from '$lib/db';

/**
 * FileSystemDirectoryHandle の拡張型定義
 * File System Access API の permission メソッドを追加
 */
interface FileSystemPermissionDescriptor {
	mode: 'read' | 'readwrite';
}

interface ExtendedFileSystemDirectoryHandle extends FileSystemDirectoryHandle {
	queryPermission(descriptor: FileSystemPermissionDescriptor): Promise<PermissionState>;
	requestPermission(descriptor: FileSystemPermissionDescriptor): Promise<PermissionState>;
}

// IndexedDBに保存するディレクトリハンドルのキー
const DIRECTORY_HANDLE_KEY = 'outputDirectoryHandle';

/**
 * File System Access API がサポートされているか判定
 */
export function supportsFileSystemAccess(): boolean {
	return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/**
 * ディレクトリピッカーを表示して保存先を選択
 */
export async function pickDirectory(): Promise<FileSystemDirectoryHandle | null> {
	if (!supportsFileSystemAccess()) {
		return null;
	}

	try {
		// @ts-expect-error - File System Access API
		const handle = await window.showDirectoryPicker({
			mode: 'readwrite',
			startIn: 'documents'
		});
		return handle;
	} catch (error) {
		// ユーザーがキャンセルした場合
		if (error instanceof Error && error.name === 'AbortError') {
			return null;
		}
		throw error;
	}
}

/**
 * 保存したディレクトリハンドルを取得
 * IndexedDBから取得し、権限を確認
 */
export async function getSavedDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
	if (!supportsFileSystemAccess()) {
		return null;
	}

	try {
		// IndexedDBからハンドルを取得
		const stored = await db.table('settings').get(DIRECTORY_HANDLE_KEY);
		if (!stored?.handle) {
			return null;
		}

		const handle = stored.handle as ExtendedFileSystemDirectoryHandle;

		// 権限を確認（必要なら再リクエスト）
		const permission = await handle.queryPermission({ mode: 'readwrite' });
		if (permission === 'granted') {
			return handle;
		}

		// 権限をリクエスト
		const newPermission = await handle.requestPermission({ mode: 'readwrite' });
		if (newPermission === 'granted') {
			return handle;
		}

		return null;
	} catch {
		return null;
	}
}

/**
 * ディレクトリハンドルを保存
 */
export async function saveDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
	await db.table('settings').put({
		key: DIRECTORY_HANDLE_KEY,
		handle,
		updatedAt: new Date().toISOString()
	});
}

/**
 * ディレクトリハンドルをクリア
 */
export async function clearDirectoryHandle(): Promise<void> {
	await db.table('settings').delete(DIRECTORY_HANDLE_KEY);
}

/**
 * 年度別サブディレクトリを取得（なければ作成）
 */
export async function getYearDirectory(
	rootHandle: FileSystemDirectoryHandle,
	year: number
): Promise<FileSystemDirectoryHandle> {
	return await rootHandle.getDirectoryHandle(String(year), { create: true });
}

/**
 * ファイルを保存
 * @param rootHandle ルートディレクトリハンドル
 * @param year 年度
 * @param fileName ファイル名
 * @param file ファイルデータ
 * @returns 保存したファイルの相対パス
 */
export async function saveFileToDirectory(
	rootHandle: FileSystemDirectoryHandle,
	year: number,
	fileName: string,
	file: File | Blob
): Promise<string> {
	// 年度別ディレクトリを取得
	const yearDir = await getYearDirectory(rootHandle, year);

	// ファイルを作成
	const fileHandle = await yearDir.getFileHandle(fileName, { create: true });

	// ファイルに書き込み
	const writable = await fileHandle.createWritable();
	await writable.write(file);
	await writable.close();

	// 相対パスを返す
	return `${year}/${fileName}`;
}

/**
 * ファイルを読み込み
 * @param rootHandle ルートディレクトリハンドル
 * @param filePath 相対パス（{年度}/{ファイル名}）
 * @returns ファイルのBlob
 */
export async function readFileFromDirectory(
	rootHandle: FileSystemDirectoryHandle,
	filePath: string
): Promise<Blob | null> {
	try {
		const [year, ...fileNameParts] = filePath.split('/');
		const fileName = fileNameParts.join('/');

		const yearDir = await rootHandle.getDirectoryHandle(year);
		const fileHandle = await yearDir.getFileHandle(fileName);
		const file = await fileHandle.getFile();

		return file;
	} catch {
		return null;
	}
}

/**
 * ファイルを削除
 * @param rootHandle ルートディレクトリハンドル
 * @param filePath 相対パス（{年度}/{ファイル名}）
 */
export async function deleteFileFromDirectory(
	rootHandle: FileSystemDirectoryHandle,
	filePath: string
): Promise<void> {
	try {
		const [year, ...fileNameParts] = filePath.split('/');
		const fileName = fileNameParts.join('/');

		const yearDir = await rootHandle.getDirectoryHandle(year);
		await yearDir.removeEntry(fileName);
	} catch {
		// ファイルが存在しない場合は無視
	}
}

/**
 * ディレクトリの表示名を取得
 */
export function getDirectoryDisplayName(handle: FileSystemDirectoryHandle): string {
	return handle.name;
}
