import type { JournalEntry, JournalLine } from '$lib/types';

/**
 * 既存仕訳をコピーして新規作成用のデータを生成する
 *
 * 既存の仕訳データをコピーし、新規作成に適した形に整えて返す。
 * 日付は今日に変更され、各行のIDは再生成される。
 * 証憑（添付ファイル）はコピーされず、証跡ステータスは「なし」にリセットされる。
 * これにより、定期的な支払いなどで既存仕訳パターンを再利用する際に便利。
 *
 * @param original コピー元の仕訳データ
 * @returns 新規作成用に調整された仕訳データ（ID、タイムスタンプを除く）
 *
 * @example
 * const original = { date: '2025-01-10', description: '電車代', ... };
 * const newJournal = copyJournalForNew(original);
 * // newJournal.date は今日の日付、証憑はなし、各行IDは新規生成
 */
export function copyJournalForNew(
	original: JournalEntry
): Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'> {
	const today = new Date().toISOString().split('T')[0];

	return {
		date: today,
		lines: original.lines.map(
			(line): JournalLine => ({
				...line,
				id: crypto.randomUUID()
			})
		),
		description: original.description,
		vendor: original.vendor,
		evidenceStatus: 'none',
		attachments: []
	};
}
