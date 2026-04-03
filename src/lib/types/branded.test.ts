import { describe, it, expect } from 'vitest';
import {
	isAccountCode,
	isDateString,
	isUUID,
	asAccountCode,
	asDateString,
	asUUID,
	asISODateTime
} from './branded';
import type { AccountCode, DateString, UUID, ISODateTimeString } from './branded';

describe('branded types', () => {
	describe('isAccountCode', () => {
		it('4桁の数字は有効', () => {
			expect(isAccountCode('1001')).toBe(true);
			expect(isAccountCode('5017')).toBe(true);
		});

		it('3桁は無効', () => {
			expect(isAccountCode('100')).toBe(false);
		});

		it('5桁は無効', () => {
			expect(isAccountCode('10001')).toBe(false);
		});

		it('数字以外は無効', () => {
			expect(isAccountCode('abcd')).toBe(false);
			expect(isAccountCode('100a')).toBe(false);
		});

		it('空文字は無効', () => {
			expect(isAccountCode('')).toBe(false);
		});
	});

	describe('isDateString', () => {
		it('YYYY-MM-DD形式は有効', () => {
			expect(isDateString('2025-01-15')).toBe(true);
			expect(isDateString('2024-12-31')).toBe(true);
		});

		it('区切り文字なしは無効', () => {
			expect(isDateString('20250115')).toBe(false);
		});

		it('月日が1桁は無効', () => {
			expect(isDateString('2025-1-5')).toBe(false);
		});

		it('空文字は無効', () => {
			expect(isDateString('')).toBe(false);
		});
	});

	describe('isUUID', () => {
		it('UUID v4形式は有効', () => {
			expect(isUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
		});

		it('大文字も有効', () => {
			expect(isUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
		});

		it('不正な形式は無効', () => {
			expect(isUUID('not-a-uuid')).toBe(false);
			expect(isUUID('')).toBe(false);
		});
	});

	describe('キャスト用ヘルパー', () => {
		it('asAccountCode は文字列をそのまま返す', () => {
			const code: AccountCode = asAccountCode('1001');
			expect(code).toBe('1001');
		});

		it('asDateString は文字列をそのまま返す', () => {
			const date: DateString = asDateString('2025-01-15');
			expect(date).toBe('2025-01-15');
		});

		it('asUUID は文字列をそのまま返す', () => {
			const id: UUID = asUUID('550e8400-e29b-41d4-a716-446655440000');
			expect(id).toBe('550e8400-e29b-41d4-a716-446655440000');
		});

		it('asISODateTime は文字列をそのまま返す', () => {
			const dt: ISODateTimeString = asISODateTime('2025-01-15T12:00:00.000Z');
			expect(dt).toBe('2025-01-15T12:00:00.000Z');
		});
	});
});
