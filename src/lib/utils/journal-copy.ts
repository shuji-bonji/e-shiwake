import type { JournalEntry, JournalLine } from '$lib/types';

/**
 * 仕訳をコピーして新規作成用のデータを生成
 * - 日付は今日に変更
 * - ID は新規生成
 * - 証憑情報はクリア
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
