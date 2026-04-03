import { describe, it, expect } from 'vitest';
import {
	makeFileNameUnique,
	generateAttachmentName,
	sanitizeFileName,
	validateManualFileName,
	DocumentTypeShortLabels
} from './attachment-repository';

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

	it('金額が0円の場合でも正しくファイル名を生成する', () => {
		const name = generateAttachmentName('2025-01-15', 'contract', '業務委託契約', 0, '取引先A');
		expect(name).toBe('2025-01-15_契約書_業務委託契約_0円_取引先A.pdf');
	});

	it('billの場合は「請求書」になる', () => {
		const name = generateAttachmentName('2025-01-15', 'bill', 'サーバー利用料', 10000, 'AWS');
		expect(name).toBe('2025-01-15_請求書_サーバー利用料_10,000円_AWS.pdf');
	});

	it('invoiceの場合は「請求書発行」になる', () => {
		const name = generateAttachmentName(
			'2025-01-15',
			'invoice',
			'システム開発',
			100000,
			'クライアントA'
		);
		expect(name).toBe('2025-01-15_請求書発行_システム開発_100,000円_クライアントA.pdf');
	});

	it('ファイル名に使えない文字はサニタイズされる', () => {
		const name = generateAttachmentName('2025-01-15', 'receipt', 'A/B テスト', 5000, 'Co:Ltd');
		expect(name).not.toContain('/');
		expect(name).not.toContain(':');
		expect(name).toContain('A_B テスト');
		expect(name).toContain('Co_Ltd');
	});

	it('摘要と取引先が両方空の場合は「未分類」「不明」になる', () => {
		const name = generateAttachmentName('2025-01-15', 'other', '', 0, '');
		expect(name).toBe('2025-01-15_その他_未分類_0円_不明.pdf');
	});

	it('非常に長い摘要がある場合、ファイル名が240バイト以内に収まる', () => {
		const longDescription = 'あ'.repeat(200); // 200文字 × 3バイト = 600バイト
		const name = generateAttachmentName('2025-01-15', 'receipt', longDescription, 10000, '取引先A');
		const byteLength = new TextEncoder().encode(name).length;
		// .pdf (4バイト) を含めても安全な範囲内
		expect(byteLength).toBeLessThanOrEqual(245);
		expect(name).toMatch(/\.pdf$/);
	});
});

describe('DocumentTypeShortLabels', () => {
	it('invoiceとbillが区別されている', () => {
		expect(DocumentTypeShortLabels.invoice).toBe('請求書発行');
		expect(DocumentTypeShortLabels.bill).toBe('請求書');
		expect(DocumentTypeShortLabels.invoice).not.toBe(DocumentTypeShortLabels.bill);
	});

	it('全てのDocumentTypeに対応するラベルが存在する', () => {
		const types = ['invoice', 'bill', 'receipt', 'contract', 'estimate', 'other'] as const;
		for (const type of types) {
			expect(DocumentTypeShortLabels[type]).toBeTruthy();
		}
	});
});

describe('sanitizeFileName', () => {
	it('禁止文字を_に置換する', () => {
		expect(sanitizeFileName('a/b\\c:d')).toBe('a_b_c_d');
		expect(sanitizeFileName('file*name?.pdf')).toBe('file_name_.pdf');
		expect(sanitizeFileName('"hello"<world>|test')).toBe('_hello__world__test');
	});

	it('前後の空白をトリムする', () => {
		expect(sanitizeFileName('  hello  ')).toBe('hello');
	});

	it('禁止文字がなければそのまま返す', () => {
		expect(sanitizeFileName('正常なファイル名')).toBe('正常なファイル名');
	});

	it('空文字はそのまま返す', () => {
		expect(sanitizeFileName('')).toBe('');
	});
});

describe('validateManualFileName', () => {
	it('正常なファイル名はエラーなし', () => {
		expect(validateManualFileName('2025-01-15_領収書_テスト_1,000円_Amazon.pdf')).toEqual([]);
	});

	it('空文字はエラー', () => {
		const errors = validateManualFileName('');
		expect(errors.length).toBeGreaterThan(0);
		expect(errors[0]).toContain('入力してください');
	});

	it('空白のみはエラー', () => {
		const errors = validateManualFileName('   ');
		expect(errors.length).toBeGreaterThan(0);
	});

	it('パストラバーサルを検出する', () => {
		const errors = validateManualFileName('../../../etc/passwd.pdf');
		expect(errors.some((e) => e.includes('パス区切り'))).toBe(true);
	});

	it('スラッシュを検出する', () => {
		const errors = validateManualFileName('2025/test.pdf');
		expect(errors.some((e) => e.includes('パス区切り'))).toBe(true);
	});

	it('バックスラッシュを検出する', () => {
		const errors = validateManualFileName('test\\file.pdf');
		expect(errors.some((e) => e.includes('パス区切り'))).toBe(true);
	});

	it('禁止文字を検出する', () => {
		const errors = validateManualFileName('file:name.pdf');
		expect(errors.some((e) => e.includes('使用できない文字'))).toBe(true);
	});

	it('.pdf拡張子の重複を検出する', () => {
		const errors = validateManualFileName('test.pdf.pdf');
		expect(errors.some((e) => e.includes('.pdf 拡張子が重複'))).toBe(true);
	});

	it('.pdf拡張子がない場合はエラー', () => {
		const errors = validateManualFileName('test.txt');
		expect(errors.some((e) => e.includes('.pdf で終わる'))).toBe(true);
	});

	it('255バイト超のファイル名はエラー', () => {
		const longName = 'あ'.repeat(100) + '.pdf'; // 300バイト + 4バイト
		const errors = validateManualFileName(longName);
		expect(errors.some((e) => e.includes('長すぎます'))).toBe(true);
	});

	it('255バイト以内のファイル名はOK', () => {
		const name = 'あ'.repeat(80) + '.pdf'; // 240バイト + 4バイト = 244バイト
		expect(validateManualFileName(name)).toEqual([]);
	});
});
