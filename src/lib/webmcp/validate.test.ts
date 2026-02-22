import { describe, it, expect } from 'vitest';
import {
	ValidationError,
	requireString,
	optionalString,
	requireNumber,
	optionalNumber,
	requireArray
} from './validate';

describe('WebMCP validate', () => {
	// === requireString ===
	describe('requireString', () => {
		it('有効な文字列を返す', () => {
			expect(requireString({ name: 'test' }, 'name')).toBe('test');
		});

		it('空文字列も有効', () => {
			expect(requireString({ name: '' }, 'name')).toBe('');
		});

		it('値がない場合にValidationErrorを投げる', () => {
			expect(() => requireString({}, 'name')).toThrow(ValidationError);
			expect(() => requireString({}, 'name')).toThrow('name は必須です');
		});

		it('nullの場合にValidationErrorを投げる', () => {
			expect(() => requireString({ name: null }, 'name')).toThrow('name は必須です');
		});

		it('数値の場合にValidationErrorを投げる', () => {
			expect(() => requireString({ name: 123 }, 'name')).toThrow('文字列である必要があります');
		});

		it('booleanの場合にValidationErrorを投げる', () => {
			expect(() => requireString({ name: true }, 'name')).toThrow('文字列である必要があります');
		});
	});

	// === optionalString ===
	describe('optionalString', () => {
		it('有効な文字列を返す', () => {
			expect(optionalString({ q: 'search' }, 'q')).toBe('search');
		});

		it('undefined/nullの場合はundefinedを返す', () => {
			expect(optionalString({}, 'q')).toBeUndefined();
			expect(optionalString({ q: null }, 'q')).toBeUndefined();
		});

		it('数値の場合にValidationErrorを投げる', () => {
			expect(() => optionalString({ q: 42 }, 'q')).toThrow(ValidationError);
		});
	});

	// === requireNumber ===
	describe('requireNumber', () => {
		it('有効な数値を返す', () => {
			expect(requireNumber({ year: 2025 }, 'year')).toBe(2025);
		});

		it('0も有効', () => {
			expect(requireNumber({ amount: 0 }, 'amount')).toBe(0);
		});

		it('値がない場合にValidationErrorを投げる', () => {
			expect(() => requireNumber({}, 'year')).toThrow('year は必須です');
		});

		it('文字列の場合にValidationErrorを投げる', () => {
			expect(() => requireNumber({ year: '2025' }, 'year')).toThrow('数値である必要があります');
		});

		it('NaNの場合にValidationErrorを投げる', () => {
			expect(() => requireNumber({ year: NaN }, 'year')).toThrow('数値である必要があります');
		});
	});

	// === optionalNumber ===
	describe('optionalNumber', () => {
		it('有効な数値を返す', () => {
			expect(optionalNumber({ year: 2025 }, 'year')).toBe(2025);
		});

		it('undefined/nullの場合はundefinedを返す', () => {
			expect(optionalNumber({}, 'year')).toBeUndefined();
			expect(optionalNumber({ year: null }, 'year')).toBeUndefined();
		});

		it('文字列の場合にValidationErrorを投げる', () => {
			expect(() => optionalNumber({ year: '2025' }, 'year')).toThrow(ValidationError);
		});
	});

	// === requireArray ===
	describe('requireArray', () => {
		it('有効な配列を返す', () => {
			const items = [{ code: '1001', amount: 100 }];
			expect(requireArray({ lines: items }, 'lines')).toEqual(items);
		});

		it('空配列も有効', () => {
			expect(requireArray({ lines: [] }, 'lines')).toEqual([]);
		});

		it('値がない場合にValidationErrorを投げる', () => {
			expect(() => requireArray({}, 'lines')).toThrow('lines は必須です');
		});

		it('オブジェクトの場合にValidationErrorを投げる', () => {
			expect(() => requireArray({ lines: { a: 1 } }, 'lines')).toThrow('配列である必要があります');
		});

		it('文字列の場合にValidationErrorを投げる', () => {
			expect(() => requireArray({ lines: 'not-array' }, 'lines')).toThrow(
				'配列である必要があります'
			);
		});
	});

	// === ValidationError ===
	describe('ValidationError', () => {
		it('Error を継承している', () => {
			const error = new ValidationError('test');
			expect(error).toBeInstanceOf(Error);
			expect(error).toBeInstanceOf(ValidationError);
			expect(error.name).toBe('ValidationError');
			expect(error.message).toBe('test');
		});
	});
});
