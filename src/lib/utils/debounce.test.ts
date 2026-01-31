import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDebounce } from './debounce';

describe('createDebounce', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('デフォルトで500ms後に関数を実行する', () => {
		const fn = vi.fn();
		const debounced = createDebounce(fn);

		debounced();
		expect(fn).not.toHaveBeenCalled();

		vi.advanceTimersByTime(499);
		expect(fn).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('カスタムの遅延時間を指定できる', () => {
		const fn = vi.fn();
		const debounced = createDebounce(fn, 200);

		debounced();
		expect(fn).not.toHaveBeenCalled();

		vi.advanceTimersByTime(199);
		expect(fn).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('連続して呼び出すとタイマーがリセットされる', () => {
		const fn = vi.fn();
		const debounced = createDebounce(fn, 100);

		debounced();
		vi.advanceTimersByTime(50);
		expect(fn).not.toHaveBeenCalled();

		// 2回目の呼び出し - タイマーリセット
		debounced();
		vi.advanceTimersByTime(50);
		expect(fn).not.toHaveBeenCalled();

		// 3回目の呼び出し - タイマーリセット
		debounced();
		vi.advanceTimersByTime(50);
		expect(fn).not.toHaveBeenCalled();

		// 最後の呼び出しから100ms後に実行
		vi.advanceTimersByTime(50);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('引数を正しく渡す', () => {
		const fn = vi.fn();
		const debounced = createDebounce(fn, 100);

		debounced('arg1', 'arg2');
		vi.advanceTimersByTime(100);

		expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
	});

	it('最後の呼び出しの引数のみが使用される', () => {
		const fn = vi.fn();
		const debounced = createDebounce(fn, 100);

		debounced('first');
		vi.advanceTimersByTime(50);

		debounced('second');
		vi.advanceTimersByTime(50);

		debounced('third');
		vi.advanceTimersByTime(100);

		expect(fn).toHaveBeenCalledTimes(1);
		expect(fn).toHaveBeenCalledWith('third');
	});

	it('複数回の完了後も正常に動作する', () => {
		const fn = vi.fn();
		const debounced = createDebounce(fn, 100);

		// 1回目
		debounced('first');
		vi.advanceTimersByTime(100);
		expect(fn).toHaveBeenCalledTimes(1);
		expect(fn).toHaveBeenLastCalledWith('first');

		// 2回目
		debounced('second');
		vi.advanceTimersByTime(100);
		expect(fn).toHaveBeenCalledTimes(2);
		expect(fn).toHaveBeenLastCalledWith('second');
	});

	it('非同期関数でも動作する', async () => {
		const asyncFn = vi.fn().mockResolvedValue('result');
		const debounced = createDebounce(asyncFn, 100);

		debounced();
		vi.advanceTimersByTime(100);

		expect(asyncFn).toHaveBeenCalledTimes(1);
	});
});
