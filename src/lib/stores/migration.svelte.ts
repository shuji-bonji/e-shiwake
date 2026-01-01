/**
 * ストレージマイグレーション管理ストア
 * RxJSを使用した並列処理と進捗表示
 */
import { from, type Subscription } from 'rxjs';
import { mergeMap, tap, finalize, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import type { StorageType } from '$lib/types';
import {
	getAttachmentsForMigration,
	migrateAttachmentToFilesystem,
	migrateAttachmentToIndexedDB,
	setStorageMode,
	type MigrationAttachment
} from '$lib/db';

// 同時処理数
const CONCURRENCY = 5;

/**
 * マイグレーションエラー
 */
export interface MigrationError {
	attachmentId: string;
	fileName: string;
	error: string;
}

/**
 * マイグレーションストアの状態
 */
export interface MigrationState {
	isRunning: boolean;
	progress: number;
	total: number;
	completed: number;
	errors: MigrationError[];
	targetStorageType: StorageType | null;
}

/**
 * マイグレーションストアを作成
 */
export function createMigrationStore() {
	// Svelte 5 のリアクティブ状態
	let isRunning = $state(false);
	let progress = $state(0);
	let total = $state(0);
	let completed = $state(0);
	let errors = $state<MigrationError[]>([]);
	let targetStorageType = $state<StorageType | null>(null);
	let isCanceled = $state(false);

	// サブスクリプション管理
	let subscription: Subscription | null = null;

	/**
	 * マイグレーション対象の件数を取得
	 */
	async function getTargetCount(target: StorageType): Promise<number> {
		const attachments = await getAttachmentsForMigration(target);
		return attachments.length;
	}

	/**
	 * マイグレーションを開始
	 */
	async function startMigration(
		target: StorageType,
		directoryHandle: FileSystemDirectoryHandle
	): Promise<boolean> {
		if (isRunning) {
			console.warn('マイグレーション実行中です');
			return false;
		}

		// 状態をリセット
		isRunning = true;
		progress = 0;
		completed = 0;
		errors = [];
		targetStorageType = target;
		isCanceled = false;

		try {
			// マイグレーション対象を取得
			const attachments = await getAttachmentsForMigration(target);
			total = attachments.length;

			if (total === 0) {
				// 移行対象がない場合は即完了
				isRunning = false;
				progress = 1;
				await setStorageMode(target);
				return true;
			}

			// マイグレーション関数を選択
			const migrateFunc =
				target === 'filesystem' ? migrateAttachmentToFilesystem : migrateAttachmentToIndexedDB;

			return new Promise((resolve) => {
				subscription = from(attachments)
					.pipe(
						// 並列実行（同時処理数を制限）
						mergeMap(
							(item: MigrationAttachment) =>
								from(migrateFunc(item, directoryHandle)).pipe(
									// 成功時
									tap(() => {
										completed++;
										progress = completed / total;
									}),
									// エラー時も続行
									catchError((err) => {
										errors = [
											...errors,
											{
												attachmentId: item.attachmentId,
												fileName: item.attachment.generatedName,
												error: err instanceof Error ? err.message : '不明なエラー'
											}
										];
										completed++;
										progress = completed / total;
										return of(null); // エラーでもストリームを続行
									})
								),
							CONCURRENCY
						),
						// 完了時の処理
						finalize(async () => {
							isRunning = false;

							// キャンセルされた場合はprogress = 1にしない（UIで完了と誤認させない）
							if (!isCanceled) {
								progress = 1;
							}

							// エラーがなければストレージモードを更新
							if (!isCanceled && errors.length === 0) {
								await setStorageMode(target);
							}

							resolve(!isCanceled && errors.length === 0);
						})
					)
					.subscribe();
			});
		} catch (err) {
			isRunning = false;
			errors = [
				{
					attachmentId: '',
					fileName: '',
					error: err instanceof Error ? err.message : '不明なエラー'
				}
			];
			return false;
		}
	}

	/**
	 * マイグレーションをキャンセル
	 */
	function cancel() {
		if (subscription) {
			subscription.unsubscribe();
			subscription = null;
		}
		isCanceled = true;
		isRunning = false;
	}

	/**
	 * 状態をリセット
	 */
	function reset() {
		if (isRunning) {
			cancel();
		}
		progress = 0;
		total = 0;
		completed = 0;
		errors = [];
		targetStorageType = null;
		isCanceled = false;
	}

	return {
		// ゲッター（リアクティブ）
		get isRunning() {
			return isRunning;
		},
		get progress() {
			return progress;
		},
		get total() {
			return total;
		},
		get completed() {
			return completed;
		},
		get errors() {
			return errors;
		},
		get targetStorageType() {
			return targetStorageType;
		},
		get isCanceled() {
			return isCanceled;
		},

		// メソッド
		getTargetCount,
		startMigration,
		cancel,
		reset
	};
}

// シングルトンインスタンス
let migrationStore: ReturnType<typeof createMigrationStore> | null = null;

/**
 * マイグレーションストアを取得
 */
export function useMigrationStore() {
	if (!migrationStore) {
		migrationStore = createMigrationStore();
	}
	return migrationStore;
}
