import { db } from './database';
import { saveVendor } from './vendor-repository';

// ==================== テストデータ ====================

/**
 * 2024年のダミーデータを生成
 */
export async function seedTestData2024(): Promise<number> {
	const testJournals = [
		{
			date: '2024-01-15',
			vendor: 'Amazon',
			description: 'USBケーブル購入',
			debitCode: '5006', // 消耗品費
			creditCode: '1002', // 普通預金
			amount: 1980
		},
		{
			date: '2024-02-03',
			vendor: 'スターバックス',
			description: '打ち合わせ コーヒー代',
			debitCode: '5008', // 会議費
			creditCode: '1001', // 現金
			amount: 1200
		},
		{
			date: '2024-03-10',
			vendor: 'JR東日本',
			description: '客先訪問 交通費',
			debitCode: '5005', // 旅費交通費
			creditCode: '1001', // 現金
			amount: 580
		},
		{
			date: '2024-04-20',
			vendor: 'ヨドバシカメラ',
			description: 'マウス購入',
			debitCode: '5006', // 消耗品費
			creditCode: '1002', // 普通預金
			amount: 3980
		},
		{
			date: '2024-05-15',
			vendor: '株式会社クライアントA',
			description: 'ウェブサイト制作',
			debitCode: '1003', // 売掛金
			creditCode: '4001', // 売上高
			amount: 330000
		},
		{
			date: '2024-06-01',
			vendor: 'NTTドコモ',
			description: '携帯電話代 5月分',
			debitCode: '5004', // 通信費
			creditCode: '1002', // 普通預金
			amount: 8800
		},
		{
			date: '2024-06-30',
			vendor: '株式会社クライアントA',
			description: 'ウェブサイト制作 入金',
			debitCode: '1002', // 普通預金
			creditCode: '1003', // 売掛金
			amount: 330000
		},
		{
			date: '2024-07-10',
			vendor: 'モノタロウ',
			description: '事務用品購入',
			debitCode: '5006', // 消耗品費
			creditCode: '1002', // 普通預金
			amount: 2450
		},
		{
			date: '2024-08-25',
			vendor: 'さくらインターネット',
			description: 'サーバー代 年間',
			debitCode: '5004', // 通信費
			creditCode: '1002', // 普通預金
			amount: 13200
		},
		{
			date: '2024-09-15',
			vendor: '株式会社クライアントB',
			description: 'システム開発',
			debitCode: '1003', // 売掛金
			creditCode: '4001', // 売上高
			amount: 550000
		},
		{
			date: '2024-10-20',
			vendor: 'Apple',
			description: 'MacBook Air購入',
			debitCode: '1004', // 工具器具備品
			creditCode: '1002', // 普通預金
			amount: 164800
		},
		{
			date: '2024-11-05',
			vendor: '楽天',
			description: '書籍購入',
			debitCode: '5007', // 新聞図書費
			creditCode: '1002', // 普通預金
			amount: 3520
		},
		{
			date: '2024-12-10',
			vendor: '株式会社クライアントB',
			description: 'システム開発 入金',
			debitCode: '1002', // 普通預金
			creditCode: '1003', // 売掛金
			amount: 550000
		},
		{
			date: '2024-12-25',
			vendor: '国税庁',
			description: '予定納税 第2期',
			debitCode: '5010', // 租税公課
			creditCode: '1002', // 普通預金
			amount: 50000
		}
	];

	let count = 0;
	const now = new Date().toISOString();

	for (const data of testJournals) {
		// 取引先を登録
		await saveVendor(data.vendor);

		// 仕訳を登録
		await db.journals.add({
			id: crypto.randomUUID(),
			date: data.date,
			lines: [
				{
					id: crypto.randomUUID(),
					type: 'debit',
					accountCode: data.debitCode,
					amount: data.amount
				},
				{
					id: crypto.randomUUID(),
					type: 'credit',
					accountCode: data.creditCode,
					amount: data.amount
				}
			],
			vendor: data.vendor,
			description: data.description,
			evidenceStatus: Math.random() > 0.5 ? 'digital' : 'none',
			attachments: [],
			createdAt: now,
			updatedAt: now
		});
		count++;
	}

	return count;
}
