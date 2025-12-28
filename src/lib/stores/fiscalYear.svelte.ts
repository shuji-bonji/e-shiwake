/**
 * 年度管理ストア
 * サイドバーと仕訳帳ページで共有
 */

// 選択中の年度
let selectedYear = $state(new Date().getFullYear());

// 利用可能な年度リスト
let availableYears = $state<number[]>([]);

/**
 * 選択中の年度を取得
 */
export function getSelectedYear(): number {
	return selectedYear;
}

/**
 * 年度を選択
 */
export function setSelectedYear(year: number): void {
	selectedYear = year;
}

/**
 * 利用可能な年度リストを取得
 */
export function getAvailableYears(): number[] {
	return availableYears;
}

/**
 * 利用可能な年度リストを設定
 */
export function setAvailableYears(years: number[]): void {
	availableYears = years;
	// 選択中の年度が利用可能な年度に含まれていない場合、最新年度を選択
	if (years.length > 0 && !years.includes(selectedYear)) {
		selectedYear = years[0];
	}
}

/**
 * 年度ストアの状態をリアクティブに取得するためのゲッター
 */
export function useFiscalYear() {
	return {
		get selectedYear() {
			return selectedYear;
		},
		get availableYears() {
			return availableYears;
		}
	};
}
