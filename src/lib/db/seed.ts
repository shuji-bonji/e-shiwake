import type { Account } from '$lib/types';

const now = new Date().toISOString();

/**
 * デフォルトの勘定科目
 * 個人事業主（青色申告）向けの一般的な勘定科目
 */
export const defaultAccounts: Account[] = [
	// ========== 資産 ==========
	{ code: '100', name: '現金', type: 'asset', isSystem: true, createdAt: now },
	{ code: '101', name: '当座預金', type: 'asset', isSystem: true, createdAt: now },
	{ code: '102', name: '普通預金', type: 'asset', isSystem: true, createdAt: now },
	{ code: '103', name: '定期預金', type: 'asset', isSystem: true, createdAt: now },
	{ code: '110', name: '売掛金', type: 'asset', isSystem: true, createdAt: now },
	{ code: '111', name: '未収入金', type: 'asset', isSystem: true, createdAt: now },
	{ code: '120', name: '棚卸資産', type: 'asset', isSystem: true, createdAt: now },
	{ code: '130', name: '前払費用', type: 'asset', isSystem: true, createdAt: now },
	{ code: '131', name: '前払金', type: 'asset', isSystem: true, createdAt: now },
	{ code: '140', name: '立替金', type: 'asset', isSystem: true, createdAt: now },
	{ code: '150', name: '仮払金', type: 'asset', isSystem: true, createdAt: now },
	{ code: '151', name: '仮払消費税', type: 'asset', isSystem: true, createdAt: now },
	{ code: '160', name: '貸付金', type: 'asset', isSystem: true, createdAt: now },
	{ code: '170', name: '建物', type: 'asset', isSystem: true, createdAt: now },
	{ code: '171', name: '建物附属設備', type: 'asset', isSystem: true, createdAt: now },
	{ code: '172', name: '機械装置', type: 'asset', isSystem: true, createdAt: now },
	{ code: '173', name: '車両運搬具', type: 'asset', isSystem: true, createdAt: now },
	{ code: '174', name: '工具器具備品', type: 'asset', isSystem: true, createdAt: now },
	{ code: '175', name: '土地', type: 'asset', isSystem: true, createdAt: now },
	{ code: '180', name: 'ソフトウェア', type: 'asset', isSystem: true, createdAt: now },
	{ code: '190', name: '敷金・保証金', type: 'asset', isSystem: true, createdAt: now },

	// ========== 負債 ==========
	{ code: '200', name: '買掛金', type: 'liability', isSystem: true, createdAt: now },
	{ code: '210', name: '短期借入金', type: 'liability', isSystem: true, createdAt: now },
	{ code: '211', name: '長期借入金', type: 'liability', isSystem: true, createdAt: now },
	{ code: '220', name: '未払金', type: 'liability', isSystem: true, createdAt: now },
	{ code: '221', name: '未払費用', type: 'liability', isSystem: true, createdAt: now },
	{ code: '222', name: '未払消費税', type: 'liability', isSystem: true, createdAt: now },
	{ code: '230', name: '前受金', type: 'liability', isSystem: true, createdAt: now },
	{ code: '240', name: '預り金', type: 'liability', isSystem: true, createdAt: now },
	{ code: '241', name: '源泉所得税預り金', type: 'liability', isSystem: true, createdAt: now },
	{ code: '250', name: '仮受金', type: 'liability', isSystem: true, createdAt: now },
	{ code: '251', name: '仮受消費税', type: 'liability', isSystem: true, createdAt: now },

	// ========== 純資産 ==========
	{ code: '300', name: '元入金', type: 'equity', isSystem: true, createdAt: now },
	{ code: '301', name: '事業主貸', type: 'equity', isSystem: true, createdAt: now },
	{ code: '302', name: '事業主借', type: 'equity', isSystem: true, createdAt: now },

	// ========== 収益 ==========
	{ code: '400', name: '売上高', type: 'revenue', isSystem: true, createdAt: now },
	{ code: '410', name: '雑収入', type: 'revenue', isSystem: true, createdAt: now },
	{ code: '420', name: '受取利息', type: 'revenue', isSystem: true, createdAt: now },

	// ========== 費用 ==========
	{ code: '500', name: '仕入高', type: 'expense', isSystem: true, createdAt: now },
	{ code: '510', name: '租税公課', type: 'expense', isSystem: true, createdAt: now },
	{ code: '511', name: '荷造運賃', type: 'expense', isSystem: true, createdAt: now },
	{ code: '512', name: '水道光熱費', type: 'expense', isSystem: true, createdAt: now },
	{ code: '513', name: '旅費交通費', type: 'expense', isSystem: true, createdAt: now },
	{ code: '514', name: '通信費', type: 'expense', isSystem: true, createdAt: now },
	{ code: '515', name: '広告宣伝費', type: 'expense', isSystem: true, createdAt: now },
	{ code: '516', name: '接待交際費', type: 'expense', isSystem: true, createdAt: now },
	{ code: '517', name: '損害保険料', type: 'expense', isSystem: true, createdAt: now },
	{ code: '518', name: '修繕費', type: 'expense', isSystem: true, createdAt: now },
	{ code: '519', name: '消耗品費', type: 'expense', isSystem: true, createdAt: now },
	{ code: '520', name: '減価償却費', type: 'expense', isSystem: true, createdAt: now },
	{ code: '521', name: '福利厚生費', type: 'expense', isSystem: true, createdAt: now },
	{ code: '522', name: '給料賃金', type: 'expense', isSystem: true, createdAt: now },
	{ code: '523', name: '外注工賃', type: 'expense', isSystem: true, createdAt: now },
	{ code: '524', name: '利子割引料', type: 'expense', isSystem: true, createdAt: now },
	{ code: '525', name: '地代家賃', type: 'expense', isSystem: true, createdAt: now },
	{ code: '526', name: '貸倒金', type: 'expense', isSystem: true, createdAt: now },
	{ code: '527', name: '雑損失', type: 'expense', isSystem: true, createdAt: now },
	{ code: '528', name: '雑費', type: 'expense', isSystem: true, createdAt: now },
	{ code: '530', name: '新聞図書費', type: 'expense', isSystem: true, createdAt: now },
	{ code: '531', name: '研修費', type: 'expense', isSystem: true, createdAt: now },
	{ code: '532', name: '会議費', type: 'expense', isSystem: true, createdAt: now },
	{ code: '533', name: '支払手数料', type: 'expense', isSystem: true, createdAt: now },
	{ code: '534', name: '諸会費', type: 'expense', isSystem: true, createdAt: now }
];
