/**
 * デバウンス関連のユーティリティ
 */

/**
 * デバウンスされた関数を作成する
 * 最後の呼び出しから指定したミリ秒が経過するまで、関数の実行を遅延させる
 *
 * @param fn - 実行する関数
 * @param delay - 遅延時間（ミリ秒）。デフォルトは500ms
 * @returns デバウンスされた関数
 */
export function createDebounce<T extends (...args: never[]) => void>(
	fn: T,
	delay: number = 500
): (...args: Parameters<T>) => void {
	let timer: ReturnType<typeof setTimeout> | null = null;

	return (...args: Parameters<T>) => {
		if (timer) {
			clearTimeout(timer);
		}
		timer = setTimeout(() => {
			fn(...args);
		}, delay);
	};
}
