import type { Account, AccountType, TaxCategory } from '$lib/types';

const now = new Date().toISOString();

/**
 * 勘定科目タイプからデフォルトの税区分を取得
 */
export function getDefaultTaxCategory(type: AccountType, code: string): TaxCategory {
	// 特殊な科目
	if (code === '1012') return 'na'; // 仮払消費税
	if (code === '2011') return 'na'; // 仮受消費税
	if (code === '5002') return 'out_of_scope'; // 租税公課
	if (code === '5014') return 'out_of_scope'; // 給料賃金
	if (code === '5016') return 'exempt'; // 利子割引料（支払利息）
	if (code === '4003') return 'exempt'; // 受取利息

	// タイプ別デフォルト
	switch (type) {
		case 'revenue':
			return 'sales_10';
		case 'expense':
			return 'purchase_10';
		default:
			return 'na';
	}
}

/**
 * デフォルトの勘定科目
 * 個人事業主（青色申告）向けの一般的な勘定科目
 *
 * コード体系（4桁）:
 *   1桁目: カテゴリ（1:資産, 2:負債, 3:純資産, 4:収益, 5:費用）
 *   2桁目: 区分（0:システム, 1:ユーザー追加）
 *   3-4桁目: 連番（01-99）
 */
export const defaultAccounts: Account[] = [
	// ========== 資産 (10XX) ==========
	{
		code: '1001',
		name: '現金',
		type: 'asset',
		isSystem: true,
		defaultTaxCategory: 'na',
		createdAt: now
	},
	{
		code: '1002',
		name: '当座預金',
		type: 'asset',
		isSystem: true,
		defaultTaxCategory: 'na',
		createdAt: now
	},
	{
		code: '1003',
		name: '普通預金',
		type: 'asset',
		isSystem: true,
		defaultTaxCategory: 'na',
		createdAt: now
	},
	{
		code: '1004',
		name: '定期預金',
		type: 'asset',
		isSystem: true,
		defaultTaxCategory: 'na',
		createdAt: now
	},
	{
		code: '1005',
		name: '売掛金',
		type: 'asset',
		isSystem: true,
		defaultTaxCategory: 'na',
		createdAt: now
	},
	{
		code: '1006',
		name: '未収入金',
		type: 'asset',
		isSystem: true,
		defaultTaxCategory: 'na',
		createdAt: now
	},
	{
		code: '1007',
		name: '棚卸資産',
		type: 'asset',
		isSystem: true,
		defaultTaxCategory: 'na',
		createdAt: now
	},
	{
		code: '1008',
		name: '前払費用',
		type: 'asset',
		isSystem: true,
		defaultTaxCategory: 'na',
		createdAt: now
	},
	{
		code: '1009',
		name: '前払金',
		type: 'asset',
		isSystem: true,
		defaultTaxCategory: 'na',
		createdAt: now
	},
	{
		code: '1010',
		name: '立替金',
		type: 'asset',
		isSystem: true,
		defaultTaxCategory: 'na',
		createdAt: now
	},
	{
		code: '1011',
		name: '仮払金',
		type: 'asset',
		isSystem: true,
		defaultTaxCategory: 'na',
		createdAt: now
	},
	{
		code: '1012',
		name: '仮払消費税',
		type: 'asset',
		isSystem: true,
		defaultTaxCategory: 'na',
		createdAt: now
	},
	{
		code: '1013',
		name: '貸付金',
		type: 'asset',
		isSystem: true,
		defaultTaxCategory: 'na',
		createdAt: now
	},
	{
		code: '1014',
		name: '建物',
		type: 'asset',
		isSystem: true,
		defaultTaxCategory: 'na',
		createdAt: now
	},
	{
		code: '1015',
		name: '建物附属設備',
		type: 'asset',
		isSystem: true,
		defaultTaxCategory: 'na',
		createdAt: now
	},
	{
		code: '1016',
		name: '機械装置',
		type: 'asset',
		isSystem: true,
		defaultTaxCategory: 'na',
		createdAt: now
	},
	{
		code: '1017',
		name: '車両運搬具',
		type: 'asset',
		isSystem: true,
		defaultTaxCategory: 'na',
		createdAt: now
	},
	{
		code: '1018',
		name: '工具器具備品',
		type: 'asset',
		isSystem: true,
		defaultTaxCategory: 'na',
		createdAt: now
	},
	{
		code: '1019',
		name: '土地',
		type: 'asset',
		isSystem: true,
		defaultTaxCategory: 'na',
		createdAt: now
	},
	{
		code: '1020',
		name: 'ソフトウェア',
		type: 'asset',
		isSystem: true,
		defaultTaxCategory: 'na',
		createdAt: now
	},
	{
		code: '1021',
		name: '敷金・保証金',
		type: 'asset',
		isSystem: true,
		defaultTaxCategory: 'na',
		createdAt: now
	},

	// ========== 負債 (20XX) ==========
	{
		code: '2001',
		name: '買掛金',
		type: 'liability',
		isSystem: true,
		defaultTaxCategory: 'na',
		createdAt: now
	},
	{
		code: '2002',
		name: '短期借入金',
		type: 'liability',
		isSystem: true,
		defaultTaxCategory: 'na',
		createdAt: now
	},
	{
		code: '2003',
		name: '長期借入金',
		type: 'liability',
		isSystem: true,
		defaultTaxCategory: 'na',
		createdAt: now
	},
	{
		code: '2004',
		name: '未払金',
		type: 'liability',
		isSystem: true,
		defaultTaxCategory: 'na',
		createdAt: now
	},
	{
		code: '2005',
		name: '未払費用',
		type: 'liability',
		isSystem: true,
		defaultTaxCategory: 'na',
		createdAt: now
	},
	{
		code: '2006',
		name: '未払消費税',
		type: 'liability',
		isSystem: true,
		defaultTaxCategory: 'na',
		createdAt: now
	},
	{
		code: '2007',
		name: '前受金',
		type: 'liability',
		isSystem: true,
		defaultTaxCategory: 'na',
		createdAt: now
	},
	{
		code: '2008',
		name: '預り金',
		type: 'liability',
		isSystem: true,
		defaultTaxCategory: 'na',
		createdAt: now
	},
	{
		code: '2009',
		name: '源泉所得税預り金',
		type: 'liability',
		isSystem: true,
		defaultTaxCategory: 'na',
		createdAt: now
	},
	{
		code: '2010',
		name: '仮受金',
		type: 'liability',
		isSystem: true,
		defaultTaxCategory: 'na',
		createdAt: now
	},
	{
		code: '2011',
		name: '仮受消費税',
		type: 'liability',
		isSystem: true,
		defaultTaxCategory: 'na',
		createdAt: now
	},

	// ========== 純資産 (30XX) ==========
	{
		code: '3001',
		name: '元入金',
		type: 'equity',
		isSystem: true,
		defaultTaxCategory: 'na',
		createdAt: now
	},
	{
		code: '3002',
		name: '事業主貸',
		type: 'equity',
		isSystem: true,
		defaultTaxCategory: 'na',
		createdAt: now
	},
	{
		code: '3003',
		name: '事業主借',
		type: 'equity',
		isSystem: true,
		defaultTaxCategory: 'na',
		createdAt: now
	},

	// ========== 収益 (40XX) ==========
	{
		code: '4001',
		name: '売上高',
		type: 'revenue',
		isSystem: true,
		defaultTaxCategory: 'sales_10',
		createdAt: now
	},
	{
		code: '4002',
		name: '雑収入',
		type: 'revenue',
		isSystem: true,
		defaultTaxCategory: 'sales_10',
		createdAt: now
	},
	{
		code: '4003',
		name: '受取利息',
		type: 'revenue',
		isSystem: true,
		defaultTaxCategory: 'exempt',
		createdAt: now
	},

	// ========== 費用 (50XX) ==========
	{
		code: '5001',
		name: '仕入高',
		type: 'expense',
		isSystem: true,
		defaultTaxCategory: 'purchase_10',
		createdAt: now
	},
	{
		code: '5002',
		name: '租税公課',
		type: 'expense',
		isSystem: true,
		defaultTaxCategory: 'out_of_scope',
		createdAt: now
	},
	{
		code: '5003',
		name: '荷造運賃',
		type: 'expense',
		isSystem: true,
		defaultTaxCategory: 'purchase_10',
		createdAt: now
	},
	{
		code: '5004',
		name: '水道光熱費',
		type: 'expense',
		isSystem: true,
		defaultTaxCategory: 'purchase_10',
		createdAt: now
	},
	{
		code: '5005',
		name: '旅費交通費',
		type: 'expense',
		isSystem: true,
		defaultTaxCategory: 'purchase_10',
		createdAt: now
	},
	{
		code: '5006',
		name: '通信費',
		type: 'expense',
		isSystem: true,
		defaultTaxCategory: 'purchase_10',
		createdAt: now
	},
	{
		code: '5007',
		name: '広告宣伝費',
		type: 'expense',
		isSystem: true,
		defaultTaxCategory: 'purchase_10',
		createdAt: now
	},
	{
		code: '5008',
		name: '接待交際費',
		type: 'expense',
		isSystem: true,
		defaultTaxCategory: 'purchase_10',
		createdAt: now
	},
	{
		code: '5009',
		name: '損害保険料',
		type: 'expense',
		isSystem: true,
		defaultTaxCategory: 'exempt',
		createdAt: now
	},
	{
		code: '5010',
		name: '修繕費',
		type: 'expense',
		isSystem: true,
		defaultTaxCategory: 'purchase_10',
		createdAt: now
	},
	{
		code: '5011',
		name: '消耗品費',
		type: 'expense',
		isSystem: true,
		defaultTaxCategory: 'purchase_10',
		createdAt: now
	},
	{
		code: '5012',
		name: '減価償却費',
		type: 'expense',
		isSystem: true,
		defaultTaxCategory: 'out_of_scope',
		createdAt: now
	},
	{
		code: '5013',
		name: '福利厚生費',
		type: 'expense',
		isSystem: true,
		defaultTaxCategory: 'purchase_10',
		createdAt: now
	},
	{
		code: '5014',
		name: '給料賃金',
		type: 'expense',
		isSystem: true,
		defaultTaxCategory: 'out_of_scope',
		createdAt: now
	},
	{
		code: '5015',
		name: '外注工賃',
		type: 'expense',
		isSystem: true,
		defaultTaxCategory: 'purchase_10',
		createdAt: now
	},
	{
		code: '5016',
		name: '利子割引料',
		type: 'expense',
		isSystem: true,
		defaultTaxCategory: 'exempt',
		createdAt: now
	},
	{
		code: '5017',
		name: '地代家賃',
		type: 'expense',
		isSystem: true,
		defaultTaxCategory: 'purchase_10',
		createdAt: now
	},
	{
		code: '5018',
		name: '貸倒金',
		type: 'expense',
		isSystem: true,
		defaultTaxCategory: 'out_of_scope',
		createdAt: now
	},
	{
		code: '5019',
		name: '雑損失',
		type: 'expense',
		isSystem: true,
		defaultTaxCategory: 'out_of_scope',
		createdAt: now
	},
	{
		code: '5020',
		name: '雑費',
		type: 'expense',
		isSystem: true,
		defaultTaxCategory: 'purchase_10',
		createdAt: now
	},
	{
		code: '5021',
		name: '新聞図書費',
		type: 'expense',
		isSystem: true,
		defaultTaxCategory: 'purchase_10',
		createdAt: now
	},
	{
		code: '5022',
		name: '研修費',
		type: 'expense',
		isSystem: true,
		defaultTaxCategory: 'purchase_10',
		createdAt: now
	},
	{
		code: '5023',
		name: '会議費',
		type: 'expense',
		isSystem: true,
		defaultTaxCategory: 'purchase_10',
		createdAt: now
	},
	{
		code: '5024',
		name: '支払手数料',
		type: 'expense',
		isSystem: true,
		defaultTaxCategory: 'purchase_10',
		createdAt: now
	},
	{
		code: '5025',
		name: '諸会費',
		type: 'expense',
		isSystem: true,
		defaultTaxCategory: 'purchase_10',
		createdAt: now
	}
];
