import { describe, it, expect } from 'vitest';
import { makeFileNameUnique, generateAttachmentName } from './attachment-repository';

describe('makeFileNameUnique', () => {
	it('重複がなければ元のファイル名をそのまま返す', () => {
		const usedNames = new Set(['a.pdf', 'b.pdf']);
		expect(makeFileNameUnique('c.pdf', usedNames)).toBe('c.pdf');
	});

	it('重複がある場合は_2サフィックスを付与する', () => {
		const usedNames = new Set(['test.pdf']);
		expect(makeFileNameUnique('test.pdf', usedNames)).toBe('test_2.pdf');
	});

	it('_2も存在する場合は_3を付与する', () => {
		const usedNames = new Set(['test.pdf', 'test_2.pdf']);
		expect(makeFileNameUnique('test.pdf', usedNames)).toBe('test_3.pdf');
	});

	it('連番が飛んでいても最小の空き番号を使う', () => {
		const usedNames = new Set(['test.pdf', 'test_2.pdf', 'test_3.pdf']);
		expect(makeFileNameUnique('test.pdf', usedNames)).toBe('test_4.pdf');
	});

	it('空のSetなら重複なし', () => {
		expect(makeFileNameUnique('test.pdf', new Set())).toBe('test.pdf');
	});

	it('拡張子なしのファイル名でも動作する', () => {
		const usedNames = new Set(['readme']);
		expect(makeFileNameUnique('readme', usedNames)).toBe('readme_2');
	});

	it('日本語ファイル名でも正しく動作する', () => {
		const baseName = '2025-01-15_領収書_USBケーブル_3,980円_Amazon.pdf';
		const usedNames = new Set([baseName]);
		expect(makeFileNameUnique(baseName, usedNames)).toBe(
			'2025-01-15_領収書_USBケーブル_3,980円_Amazon_2.pdf'
		);
	});
});

describe('generateAttachmentName', () => {
	it('正しい形式のファイル名を生成する', () => {
		const name = generateAttachmentName('2025-01-15', 'receipt', 'USBケーブル', 3980, 'Amazon');
		expect(name).toBe('2025-01-15_領収書_USBケーブル_3,980円_Amazon.pdf');
	});

	it('摘要が空の場合は「未分類」になる', () => {
		const name = generateAttachmentName('2025-01-15', 'receipt', '', 3980, 'Amazon');
		expect(name).toContain('未分類');
	});

	it('取引先が空の場合は「不明」になる', () => {
		const name = generateAttachmentName('2025-01-15', 'receipt', 'テスト', 3980, '');
		expect(name).toContain('不明');
	});
});
