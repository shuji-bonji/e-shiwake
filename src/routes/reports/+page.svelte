<script lang="ts">
	import { onMount } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import * as Select from '$lib/components/ui/select';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Separator } from '$lib/components/ui/separator';
	import { FileText, Printer, FileArchive, Loader2 } from '@lucide/svelte';
	import {
		initializeDatabase,
		getJournalsByYear,
		getAllAccounts,
		getAvailableYears as getAvailableYearsFromDB
	} from '$lib/db';
	import { generateLedger, getUsedAccounts } from '$lib/utils/ledger';
	import { generateTrialBalance, groupTrialBalance } from '$lib/utils/trial-balance';
	import { generateProfitLoss } from '$lib/utils/profit-loss';
	import { generateBalanceSheet } from '$lib/utils/balance-sheet';
	import { generateConsumptionTax } from '$lib/utils/consumption-tax';
	import { getSelectedYear } from '$lib/stores/fiscalYear.svelte';
	import type { Account, JournalEntry } from '$lib/types';
	import JSZip from 'jszip';

	let isLoading = $state(true);
	let isPrinting = $state(false);
	let isExporting = $state(false);

	let accounts = $state<Account[]>([]);
	let journals = $state<JournalEntry[]>([]);

	// サイドバーで選択中の年度を初期値として使用
	let selectedYear = $state(getSelectedYear());
	let availableYears = $state<number[]>([]);

	// 出力対象の選択
	let selectedReports = $state({
		journal: true, // 仕訳帳
		ledger: true, // 総勘定元帳
		trialBalance: true, // 試算表
		profitLoss: true, // 損益計算書
		balanceSheet: true, // 貸借対照表
		taxSummary: false // 消費税集計表（課税事業者向け）
	});

	// 総勘定元帳の出力オプション
	let ledgerOption = $state<'all' | 'used'>('used'); // all: 全科目, used: 使用科目のみ

	onMount(async () => {
		await initializeDatabase();
		accounts = await getAllAccounts();
		availableYears = await getAvailableYearsFromDB();
		if (!availableYears.includes(selectedYear) && availableYears.length > 0) {
			selectedYear = availableYears[0];
		}
		await loadData();
		isLoading = false;
	});

	async function loadData() {
		journals = await getJournalsByYear(selectedYear);
	}

	async function handleYearChange(year: string) {
		selectedYear = parseInt(year, 10);
		await loadData();
	}

	// 選択された帳簿の数
	const selectedCount = $derived(Object.values(selectedReports).filter(Boolean).length);

	// ========================================
	// 印刷用 HTML 生成
	// ========================================

	function generateJournalHTML(): string {
		const sortedJournals = [...journals].sort((a, b) => a.date.localeCompare(b.date));
		const accountMap = new Map(accounts.map((a) => [a.code, a.name]));

		let rows = '';
		for (const journal of sortedJournals) {
			const debitLines = journal.lines.filter((l) => l.type === 'debit');
			const creditLines = journal.lines.filter((l) => l.type === 'credit');
			const maxLines = Math.max(debitLines.length, creditLines.length);

			for (let i = 0; i < maxLines; i++) {
				const debit = debitLines[i];
				const credit = creditLines[i];
				rows += `
          <tr>
            ${i === 0 ? `<td rowspan="${maxLines}" class="date">${journal.date}</td>` : ''}
            <td class="account">${debit ? accountMap.get(debit.accountCode) || debit.accountCode : ''}</td>
            <td class="amount">${debit ? debit.amount.toLocaleString() : ''}</td>
            <td class="account">${credit ? accountMap.get(credit.accountCode) || credit.accountCode : ''}</td>
            <td class="amount">${credit ? credit.amount.toLocaleString() : ''}</td>
            ${i === 0 ? `<td rowspan="${maxLines}" class="description">${journal.description}</td>` : ''}
          </tr>
        `;
			}
		}

		return `
      <div class="report-section">
        <h2>仕訳帳</h2>
        <p class="period">${selectedYear}年1月1日〜${selectedYear}年12月31日</p>
        <table>
          <thead>
            <tr>
              <th class="date">日付</th>
              <th class="account">借方科目</th>
              <th class="amount">借方金額</th>
              <th class="account">貸方科目</th>
              <th class="amount">貸方金額</th>
              <th class="description">摘要</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
	}

	function generateLedgerHTML(): string {
		const usedAccounts = ledgerOption === 'used' ? getUsedAccounts(journals, accounts) : accounts;

		let html = '';

		for (const account of usedAccounts) {
			const ledger = generateLedger(journals, account.code, accounts, 0);
			if (ledger.entries.length === 0) continue;

			let rows = '';
			for (const entry of ledger.entries) {
				rows += `
          <tr>
            <td class="date">${entry.date.substring(5).replace('-', '/')}</td>
            <td class="description">${entry.description}</td>
            <td class="account">${entry.counterAccount}</td>
            <td class="amount">${entry.debit ? entry.debit.toLocaleString() : ''}</td>
            <td class="amount">${entry.credit ? entry.credit.toLocaleString() : ''}</td>
            <td class="amount balance">${entry.balance.toLocaleString()}</td>
          </tr>
        `;
			}

			rows += `
        <tr class="total-row">
          <td colspan="3">合計</td>
          <td class="amount">${ledger.totalDebit.toLocaleString()}</td>
          <td class="amount">${ledger.totalCredit.toLocaleString()}</td>
          <td class="amount balance">${ledger.closingBalance.toLocaleString()}</td>
        </tr>
      `;

			html += `
        <div class="report-section ledger-account">
          <h3>${account.code} ${account.name}</h3>
          <table>
            <thead>
              <tr>
                <th class="date">日付</th>
                <th class="description">摘要</th>
                <th class="account">相手科目</th>
                <th class="amount">借方</th>
                <th class="amount">貸方</th>
                <th class="amount">残高</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      `;
		}

		return `
      <div class="report-section page-break-before">
        <h2>総勘定元帳</h2>
        <p class="period">${selectedYear}年度</p>
        ${html}
      </div>
    `;
	}

	function generateTrialBalanceHTML(): string {
		const data = generateTrialBalance(journals, accounts);
		const grouped = groupTrialBalance(data);

		let rows = '';
		for (const group of grouped.groups) {
			rows += `<tr class="group-header"><td colspan="5">${group.label}</td></tr>`;

			for (const row of group.rows) {
				rows += `
          <tr>
            <td class="code">${row.accountCode}</td>
            <td class="account">${row.accountName}</td>
            <td class="amount">${row.debitTotal > 0 ? row.debitTotal.toLocaleString() : ''}</td>
            <td class="amount">${row.creditTotal > 0 ? row.creditTotal.toLocaleString() : ''}</td>
            <td class="amount">${row.debitBalance > 0 ? row.debitBalance.toLocaleString() : row.creditBalance > 0 ? `(${row.creditBalance.toLocaleString()})` : ''}</td>
          </tr>
        `;
			}

			rows += `
        <tr class="subtotal-row">
          <td></td>
          <td>${group.label}計</td>
          <td class="amount">${group.subtotalDebit.toLocaleString()}</td>
          <td class="amount">${group.subtotalCredit.toLocaleString()}</td>
          <td></td>
        </tr>
      `;
		}

		rows += `
      <tr class="total-row">
        <td></td>
        <td>合計</td>
        <td class="amount">${grouped.totalDebit.toLocaleString()}</td>
        <td class="amount">${grouped.totalCredit.toLocaleString()}</td>
        <td></td>
      </tr>
    `;

		return `
      <div class="report-section page-break-before">
        <h2>合計残高試算表</h2>
        <p class="period">${selectedYear}年度</p>
        <p class="balance-check ${grouped.isBalanced ? 'balanced' : 'unbalanced'}">
          ${grouped.isBalanced ? '✓ 貸借一致' : '⚠ 貸借不一致'}
        </p>
        <table>
          <thead>
            <tr>
              <th class="code">コード</th>
              <th class="account">勘定科目</th>
              <th class="amount">借方合計</th>
              <th class="amount">貸方合計</th>
              <th class="amount">残高</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
	}

	function generateProfitLossHTML(): string {
		const pl = generateProfitLoss(journals, accounts, selectedYear);

		// 収益行
		let revenueRows = '';
		for (const row of [...pl.salesRevenue, ...pl.otherRevenue]) {
			revenueRows += `
        <tr>
          <td class="code">${row.accountCode}</td>
          <td class="account">${row.accountName}</td>
          <td class="amount">${row.amount.toLocaleString()}</td>
        </tr>
      `;
		}
		revenueRows += `
      <tr class="subtotal-row">
        <td></td>
        <td>収益合計</td>
        <td class="amount">${pl.totalRevenue.toLocaleString()}</td>
      </tr>
    `;

		// 費用行
		let expenseRows = '';
		for (const row of [...pl.costOfSales, ...pl.operatingExpenses]) {
			expenseRows += `
        <tr>
          <td class="code">${row.accountCode}</td>
          <td class="account">${row.accountName}</td>
          <td class="amount">${row.amount.toLocaleString()}</td>
        </tr>
      `;
		}
		expenseRows += `
      <tr class="subtotal-row">
        <td></td>
        <td>費用合計</td>
        <td class="amount">${pl.totalExpenses.toLocaleString()}</td>
      </tr>
    `;

		return `
      <div class="report-section page-break-before">
        <h2>損益計算書</h2>
        <p class="period">${selectedYear}年1月1日〜${selectedYear}年12月31日</p>

        <h3>収益の部</h3>
        <table>
          <thead>
            <tr>
              <th class="code">コード</th>
              <th class="account">勘定科目</th>
              <th class="amount">金額</th>
            </tr>
          </thead>
          <tbody>
            ${revenueRows}
          </tbody>
        </table>

        <h3>費用の部</h3>
        <table>
          <thead>
            <tr>
              <th class="code">コード</th>
              <th class="account">勘定科目</th>
              <th class="amount">金額</th>
            </tr>
          </thead>
          <tbody>
            ${expenseRows}
          </tbody>
        </table>

        <div class="net-income ${pl.netIncome >= 0 ? 'profit' : 'loss'}">
          <span class="label">${pl.netIncome >= 0 ? '当期純利益' : '当期純損失'}</span>
          <span class="value">¥${Math.abs(pl.netIncome).toLocaleString()}</span>
        </div>
      </div>
    `;
	}

	function generateBalanceSheetHTML(): string {
		const pl = generateProfitLoss(journals, accounts, selectedYear);
		const bs = generateBalanceSheet(journals, accounts, selectedYear, pl.netIncome);

		// 資産行
		let assetRows = '';
		for (const row of [...bs.currentAssets, ...bs.fixedAssets]) {
			assetRows += `
        <tr>
          <td class="account">${row.accountName}</td>
          <td class="amount">${row.amount.toLocaleString()}</td>
        </tr>
      `;
		}
		assetRows += `
      <tr class="total-row">
        <td>資産合計</td>
        <td class="amount">${bs.totalAssets.toLocaleString()}</td>
      </tr>
    `;

		// 負債行
		let liabilityRows = '';
		for (const row of [...bs.currentLiabilities, ...bs.fixedLiabilities]) {
			liabilityRows += `
        <tr>
          <td class="account">${row.accountName}</td>
          <td class="amount">${row.amount.toLocaleString()}</td>
        </tr>
      `;
		}
		liabilityRows += `
      <tr class="subtotal-row">
        <td>負債合計</td>
        <td class="amount">${bs.totalLiabilities.toLocaleString()}</td>
      </tr>
    `;

		// 純資産行
		let equityRows = '';
		for (const row of bs.equity) {
			equityRows += `
        <tr>
          <td class="account">${row.accountName}</td>
          <td class="amount">${row.amount.toLocaleString()}</td>
        </tr>
      `;
		}
		equityRows += `
      <tr>
        <td class="account sub">当期純利益</td>
        <td class="amount ${bs.retainedEarnings >= 0 ? 'profit' : 'loss'}">${bs.retainedEarnings.toLocaleString()}</td>
      </tr>
      <tr class="subtotal-row">
        <td>純資産合計</td>
        <td class="amount">${bs.totalEquity.toLocaleString()}</td>
      </tr>
      <tr class="total-row">
        <td>負債・純資産合計</td>
        <td class="amount">${bs.totalLiabilitiesAndEquity.toLocaleString()}</td>
      </tr>
    `;

		const isBalanced = bs.totalAssets === bs.totalLiabilitiesAndEquity;

		return `
      <div class="report-section page-break-before">
        <h2>貸借対照表</h2>
        <p class="period">${selectedYear}年12月31日現在</p>
        <p class="balance-check ${isBalanced ? 'balanced' : 'unbalanced'}">
          ${isBalanced ? '✓ 貸借一致' : '⚠ 貸借不一致'}
        </p>

        <div class="bs-grid">
          <div class="bs-left">
            <h3>資産の部</h3>
            <table>
              <tbody>
                ${assetRows}
              </tbody>
            </table>
          </div>
          <div class="bs-right">
            <h3>負債の部</h3>
            <table>
              <tbody>
                ${liabilityRows}
              </tbody>
            </table>
            <h3>純資産の部</h3>
            <table>
              <tbody>
                ${equityRows}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
	}

	function generateTaxSummaryHTML(): string {
		const tax = generateConsumptionTax(journals, selectedYear);

		// 課税売上行を生成
		let salesRows = '';
		for (const row of tax.salesRows) {
			salesRows += `
        <tr>
          <td>${row.taxCategoryLabel}</td>
          <td class="amount">${row.taxableAmount.toLocaleString()}</td>
          <td class="amount">${row.taxAmount.toLocaleString()}</td>
        </tr>
      `;
		}
		salesRows += `
      <tr class="total-row">
        <td>合計</td>
        <td class="amount">${tax.totalTaxableSales.toLocaleString()}</td>
        <td class="amount">${tax.totalSalesTax.toLocaleString()}</td>
      </tr>
    `;

		// 課税仕入行を生成
		let purchaseRows = '';
		for (const row of tax.purchaseRows) {
			purchaseRows += `
        <tr>
          <td>${row.taxCategoryLabel}</td>
          <td class="amount">${row.taxableAmount.toLocaleString()}</td>
          <td class="amount">${row.taxAmount.toLocaleString()}</td>
        </tr>
      `;
		}
		purchaseRows += `
      <tr class="total-row">
        <td>合計</td>
        <td class="amount">${tax.totalTaxablePurchases.toLocaleString()}</td>
        <td class="amount">${tax.totalPurchaseTax.toLocaleString()}</td>
      </tr>
    `;

		// 簡易課税の概算（サービス業50%で仮計算）
		const simplifiedTax = Math.floor(tax.totalSalesTax * 0.5);

		return `
      <div class="report-section page-break-before">
        <h2>消費税集計表</h2>
        <p class="period">${selectedYear}年1月1日〜${selectedYear}年12月31日</p>

        <h3>課税売上</h3>
        <table>
          <thead>
            <tr>
              <th>区分</th>
              <th class="amount">税抜金額</th>
              <th class="amount">消費税額</th>
            </tr>
          </thead>
          <tbody>
            ${salesRows}
          </tbody>
        </table>

        <h3>課税仕入</h3>
        <table>
          <thead>
            <tr>
              <th>区分</th>
              <th class="amount">税抜金額</th>
              <th class="amount">消費税額</th>
            </tr>
          </thead>
          <tbody>
            ${purchaseRows}
          </tbody>
        </table>

        <h3>納付税額（概算）</h3>
        <table>
          <tbody>
            <tr>
              <td>本則課税（売上税額 − 仕入税額）</td>
              <td class="amount">¥${tax.netTaxPayable.toLocaleString()}</td>
            </tr>
            <tr>
              <td>簡易課税（売上税額 × 50%）</td>
              <td class="amount">¥${simplifiedTax.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
        <p class="note">※ 実際の申告は税理士または e-Tax でご確認ください</p>
      </div>
    `;
	}

	function getPrintStyles(): string {
		return `
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif;
          font-size: 10pt;
          line-height: 1.4;
          color: #333;
          background: #fff;
        }
        .report-section {
          margin-bottom: 30pt;
        }
        .report-section h2 {
          font-size: 14pt;
          margin-bottom: 1rem;
        }
        .report-section h3 {
          font-size: 11pt;
          margin: 15pt 0 5pt 0;
        }
        .period {
          font-size: 10pt;
          color: #666;
          margin-bottom: 10pt;
        }
        /* layout.css のテーブルスタイルと統一 */
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 10pt;
          font-size: 10pt;
        }
        th, td {
          border: 1px solid #ccc;
          padding: 4px 8px;
          text-align: left;
        }
        th {
          background-color: #f5f5f5;
          color: #333;
          font-weight: bold;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .amount {
          text-align: right;
          font-family: monospace;
        }
        .date {
          width: 80pt;
          white-space: nowrap;
          font-family: monospace;
          font-size: 10pt;
        }
        .code {
          width: 50pt;
          font-family: monospace;
        }
        .account {
          width: 120pt;
        }
        .description {
          max-width: 200pt;
        }
        .balance {
          font-weight: bold;
        }
        .group-header td {
          background-color: #e8e8e8;
          font-weight: bold;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .subtotal-row td {
          background-color: #f5f5f5;
          font-weight: bold;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        /* layout.css の print-total と統一 */
        .total-row td {
          background-color: #f0f0f0;
          font-weight: bold;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .balance-check {
          font-size: 10pt;
          margin-bottom: 10pt;
          padding: 5pt 10pt;
          border-radius: 3pt;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .balance-check.balanced {
          background-color: #d4edda;
          color: #155724;
        }
        .balance-check.unbalanced {
          background-color: #f8d7da;
          color: #721c24;
        }
        .net-income {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10pt 15pt;
          margin-top: 15pt;
          border: 2px solid #333;
          font-size: 12pt;
          font-weight: bold;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .net-income.profit {
          background-color: #d4edda;
        }
        .net-income.loss {
          background-color: #f8d7da;
        }
        .bs-grid {
          display: flex;
          gap: 20pt;
        }
        .bs-left, .bs-right {
          flex: 1;
        }
        .profit {
          color: #155724;
        }
        .loss {
          color: #721c24;
        }
        .sub {
          padding-left: 15pt;
          color: #666;
        }
        .note {
          font-size: 8pt;
          color: #666;
          margin-top: 10pt;
        }
        .ledger-account {
          margin-bottom: 20pt;
        }
        .ledger-account h3 {
          background-color: #f5f5f5;
          padding: 5pt 10pt;
          margin-bottom: 5pt;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .page-break-before {
          page-break-before: always;
        }
        tr {
          page-break-inside: avoid;
        }
        thead {
          display: table-header-group;
        }
        /* layout.css の @page と統一 */
        @page {
          margin: 1.5cm;
          size: A4;
        }
      </style>
    `;
	}

	// ========================================
	// 印刷実行
	// ========================================

	async function handlePrint() {
		if (selectedCount === 0) return;
		isPrinting = true;

		try {
			let content = '';

			if (selectedReports.journal) {
				content += generateJournalHTML();
			}
			if (selectedReports.ledger) {
				content += generateLedgerHTML();
			}
			if (selectedReports.trialBalance) {
				content += generateTrialBalanceHTML();
			}
			if (selectedReports.profitLoss) {
				content += generateProfitLossHTML();
			}
			if (selectedReports.balanceSheet) {
				content += generateBalanceSheetHTML();
			}
			if (selectedReports.taxSummary) {
				content += generateTaxSummaryHTML();
			}

			const printWindow = window.open('', '_blank');
			if (!printWindow) {
				alert('ポップアップがブロックされました。ポップアップを許可してください。');
				return;
			}

			printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>帳簿出力 - ${selectedYear}年度</title>
          ${getPrintStyles()}
        </head>
        <body>
          ${content}
        </body>
        </html>
      `);

			printWindow.document.close();
			printWindow.focus();

			// 少し待ってから印刷ダイアログを開く
			setTimeout(() => {
				printWindow.print();
			}, 500);
		} finally {
			isPrinting = false;
		}
	}

	// ========================================
	// CSV 一括エクスポート（ZIP）
	// ========================================

	function generateJournalCSV(): string {
		const sortedJournals = [...journals].sort((a, b) => a.date.localeCompare(b.date));
		const accountMap = new Map(accounts.map((a) => [a.code, a.name]));

		const rows: string[][] = [
			['日付', '借方科目', '借方金額', '貸方科目', '貸方金額', '摘要', '取引先']
		];

		for (const journal of sortedJournals) {
			const debitLines = journal.lines.filter((l) => l.type === 'debit');
			const creditLines = journal.lines.filter((l) => l.type === 'credit');
			const maxLines = Math.max(debitLines.length, creditLines.length);

			for (let i = 0; i < maxLines; i++) {
				const debit = debitLines[i];
				const credit = creditLines[i];
				rows.push([
					i === 0 ? journal.date : '',
					debit ? accountMap.get(debit.accountCode) || debit.accountCode : '',
					debit ? debit.amount.toString() : '',
					credit ? accountMap.get(credit.accountCode) || credit.accountCode : '',
					credit ? credit.amount.toString() : '',
					i === 0 ? journal.description : '',
					i === 0 ? journal.vendor : ''
				]);
			}
		}

		return '\uFEFF' + rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
	}

	function generateLedgerCSV(): string {
		const usedAccounts = ledgerOption === 'used' ? getUsedAccounts(journals, accounts) : accounts;

		const rows: string[][] = [
			['科目コード', '科目名', '日付', '摘要', '相手科目', '借方', '貸方', '残高']
		];

		for (const account of usedAccounts) {
			const ledger = generateLedger(journals, account.code, accounts, 0);
			if (ledger.entries.length === 0) continue;

			for (const entry of ledger.entries) {
				rows.push([
					account.code,
					account.name,
					entry.date,
					entry.description,
					entry.counterAccount,
					entry.debit?.toString() || '',
					entry.credit?.toString() || '',
					entry.balance.toString()
				]);
			}
		}

		return '\uFEFF' + rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
	}

	function generateTrialBalanceCSV(): string {
		const data = generateTrialBalance(journals, accounts);
		const grouped = groupTrialBalance(data);

		const rows: string[][] = [
			['科目コード', '科目名', '借方合計', '貸方合計', '借方残高', '貸方残高']
		];

		for (const group of grouped.groups) {
			rows.push([`【${group.label}】`, '', '', '', '', '']);
			for (const row of group.rows) {
				rows.push([
					row.accountCode,
					row.accountName,
					row.debitTotal.toString(),
					row.creditTotal.toString(),
					row.debitBalance.toString(),
					row.creditBalance.toString()
				]);
			}
			rows.push([
				'',
				`${group.label}計`,
				group.subtotalDebit.toString(),
				group.subtotalCredit.toString(),
				group.subtotalDebitBalance.toString(),
				group.subtotalCreditBalance.toString()
			]);
		}

		rows.push([
			'',
			'合計',
			grouped.totalDebit.toString(),
			grouped.totalCredit.toString(),
			grouped.totalDebitBalance.toString(),
			grouped.totalCreditBalance.toString()
		]);

		return '\uFEFF' + rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
	}

	function generateProfitLossCSV(): string {
		const pl = generateProfitLoss(journals, accounts, selectedYear);

		const rows: string[][] = [
			['損益計算書', `${selectedYear}年度`],
			[],
			['【収益の部】'],
			['科目コード', '科目名', '金額']
		];

		for (const row of [...pl.salesRevenue, ...pl.otherRevenue]) {
			rows.push([row.accountCode, row.accountName, row.amount.toString()]);
		}
		rows.push(['', '収益合計', pl.totalRevenue.toString()]);

		rows.push([]);
		rows.push(['【費用の部】']);
		rows.push(['科目コード', '科目名', '金額']);

		for (const row of [...pl.costOfSales, ...pl.operatingExpenses]) {
			rows.push([row.accountCode, row.accountName, row.amount.toString()]);
		}
		rows.push(['', '費用合計', pl.totalExpenses.toString()]);

		rows.push([]);
		rows.push(['', '当期純利益', pl.netIncome.toString()]);

		return '\uFEFF' + rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
	}

	function generateBalanceSheetCSV(): string {
		const pl = generateProfitLoss(journals, accounts, selectedYear);
		const bs = generateBalanceSheet(journals, accounts, selectedYear, pl.netIncome);

		const rows: string[][] = [
			['貸借対照表', `${selectedYear}年12月31日現在`],
			[],
			['【資産の部】'],
			['科目コード', '科目名', '金額']
		];

		for (const row of [...bs.currentAssets, ...bs.fixedAssets]) {
			rows.push([row.accountCode, row.accountName, row.amount.toString()]);
		}
		rows.push(['', '資産合計', bs.totalAssets.toString()]);

		rows.push([]);
		rows.push(['【負債の部】']);

		for (const row of [...bs.currentLiabilities, ...bs.fixedLiabilities]) {
			rows.push([row.accountCode, row.accountName, row.amount.toString()]);
		}
		rows.push(['', '負債合計', bs.totalLiabilities.toString()]);

		rows.push([]);
		rows.push(['【純資産の部】']);

		for (const row of bs.equity) {
			rows.push([row.accountCode, row.accountName, row.amount.toString()]);
		}
		rows.push(['', '当期純利益', bs.retainedEarnings.toString()]);
		rows.push(['', '純資産合計', bs.totalEquity.toString()]);

		rows.push([]);
		rows.push(['', '負債・純資産合計', bs.totalLiabilitiesAndEquity.toString()]);

		return '\uFEFF' + rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
	}

	function generateTaxSummaryCSV(): string {
		const tax = generateConsumptionTax(journals, selectedYear);
		const simplifiedTax = Math.floor(tax.totalSalesTax * 0.5);

		const rows: string[][] = [
			['消費税集計表', `${selectedYear}年度`],
			['期間', `${selectedYear}年1月1日 〜 ${selectedYear}年12月31日`],
			[],
			['【課税売上】'],
			['区分', '税抜金額', '税額']
		];

		for (const row of tax.salesRows) {
			rows.push([row.taxCategoryLabel, row.taxableAmount.toString(), row.taxAmount.toString()]);
		}
		rows.push(['合計', tax.totalTaxableSales.toString(), tax.totalSalesTax.toString()]);

		rows.push([]);
		rows.push(['【課税仕入】']);
		rows.push(['区分', '税抜金額', '税額']);

		for (const row of tax.purchaseRows) {
			rows.push([row.taxCategoryLabel, row.taxableAmount.toString(), row.taxAmount.toString()]);
		}
		rows.push(['合計', tax.totalTaxablePurchases.toString(), tax.totalPurchaseTax.toString()]);

		rows.push([]);
		rows.push(['【納付税額（概算）】']);
		rows.push(['本則課税', '', tax.netTaxPayable.toString()]);
		rows.push(['簡易課税', '', simplifiedTax.toString()]);

		return '\uFEFF' + rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
	}

	async function handleExportCSV() {
		if (selectedCount === 0) return;
		isExporting = true;

		try {
			const zip = new JSZip();

			if (selectedReports.journal) {
				zip.file(`仕訳帳_${selectedYear}.csv`, generateJournalCSV());
			}
			if (selectedReports.ledger) {
				zip.file(`総勘定元帳_${selectedYear}.csv`, generateLedgerCSV());
			}
			if (selectedReports.trialBalance) {
				zip.file(`試算表_${selectedYear}.csv`, generateTrialBalanceCSV());
			}
			if (selectedReports.profitLoss) {
				zip.file(`損益計算書_${selectedYear}.csv`, generateProfitLossCSV());
			}
			if (selectedReports.balanceSheet) {
				zip.file(`貸借対照表_${selectedYear}.csv`, generateBalanceSheetCSV());
			}
			if (selectedReports.taxSummary) {
				zip.file(`消費税集計表_${selectedYear}.csv`, generateTaxSummaryCSV());
			}

			const blob = await zip.generateAsync({ type: 'blob' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `帳簿_${selectedYear}.zip`;
			a.click();
			URL.revokeObjectURL(url);
		} finally {
			isExporting = false;
		}
	}

	// 全選択/全解除
	function selectAll() {
		selectedReports = {
			journal: true,
			ledger: true,
			trialBalance: true,
			profitLoss: true,
			balanceSheet: true,
			taxSummary: true
		};
	}

	function deselectAll() {
		selectedReports = {
			journal: false,
			ledger: false,
			trialBalance: false,
			profitLoss: false,
			balanceSheet: false,
			taxSummary: false
		};
	}
</script>

<div class="container mx-auto max-w-3xl space-y-6 px-4 pb-4">
	<div
		class="sticky top-14 z-10 -mx-4 flex items-center justify-between border-b bg-background px-4 pt-4 pb-3 group-has-data-[collapsible=icon]/sidebar-wrapper:top-12"
	>
		<h1 class="flex items-center gap-2 text-2xl font-bold">
			<FileText class="size-6" />
			帳簿出力
		</h1>

		<Select.Root
			type="single"
			value={selectedYear.toString()}
			onValueChange={(v) => v && handleYearChange(v)}
		>
			<Select.Trigger class="w-32">
				{selectedYear}年度
			</Select.Trigger>
			<Select.Content>
				{#each availableYears as year (year)}
					<Select.Item value={year.toString()}>{year}年度</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	</div>

	{#if isLoading}
		<div class="flex h-64 items-center justify-center">
			<p class="text-muted-foreground">読み込み中...</p>
		</div>
	{:else}
		<Card.Root>
			<Card.Header>
				<Card.Title>出力する帳簿を選択</Card.Title>
				<Card.Description>
					各種帳簿の印刷・PDF保存はこのページから行います。確定申告や税理士提出用に、複数の帳簿を一括で出力できます。
				</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<!-- 全選択/全解除 -->
				<div class="flex gap-2">
					<Button variant="outline" size="sm" onclick={selectAll}>全て選択</Button>
					<Button variant="outline" size="sm" onclick={deselectAll}>全て解除</Button>
				</div>

				<Separator />

				<!-- 帳簿チェックボックス -->
				<div class="space-y-3">
					<div class="flex items-center space-x-3">
						<Checkbox id="journal" bind:checked={selectedReports.journal} />
						<Label for="journal" class="cursor-pointer font-normal">
							仕訳帳
							<span class="ml-2 text-sm text-muted-foreground">
								（{journals.length}件）
							</span>
						</Label>
					</div>

					<div class="flex items-center space-x-3">
						<Checkbox id="ledger" bind:checked={selectedReports.ledger} />
						<Label for="ledger" class="cursor-pointer font-normal">総勘定元帳</Label>
						{#if selectedReports.ledger}
							<Select.Root
								type="single"
								value={ledgerOption}
								onValueChange={(v) => v && (ledgerOption = v as 'all' | 'used')}
							>
								<Select.Trigger class="h-8 w-40 text-sm">
									{ledgerOption === 'used' ? '使用科目のみ' : '全科目'}
								</Select.Trigger>
								<Select.Content>
									<Select.Item value="used">使用科目のみ</Select.Item>
									<Select.Item value="all">全科目</Select.Item>
								</Select.Content>
							</Select.Root>
						{/if}
					</div>

					<div class="flex items-center space-x-3">
						<Checkbox id="trialBalance" bind:checked={selectedReports.trialBalance} />
						<Label for="trialBalance" class="cursor-pointer font-normal">試算表</Label>
					</div>

					<Separator />

					<div class="flex items-center space-x-3">
						<Checkbox id="profitLoss" bind:checked={selectedReports.profitLoss} />
						<Label for="profitLoss" class="cursor-pointer font-normal">損益計算書</Label>
					</div>

					<div class="flex items-center space-x-3">
						<Checkbox id="balanceSheet" bind:checked={selectedReports.balanceSheet} />
						<Label for="balanceSheet" class="cursor-pointer font-normal">貸借対照表</Label>
					</div>

					<Separator />

					<div class="flex items-center space-x-3">
						<Checkbox id="taxSummary" bind:checked={selectedReports.taxSummary} />
						<Label for="taxSummary" class="cursor-pointer font-normal">
							消費税集計表
							<span class="ml-2 text-sm text-muted-foreground"> （課税事業者向け） </span>
						</Label>
					</div>
				</div>
			</Card.Content>
			<Card.Footer class="flex justify-between">
				<p class="text-sm text-muted-foreground">
					{selectedCount}件選択中
				</p>
				<div class="flex gap-2">
					<Button
						variant="outline"
						onclick={handleExportCSV}
						disabled={selectedCount === 0 || isExporting}
					>
						{#if isExporting}
							<Loader2 class="mr-2 size-4 animate-spin" />
						{:else}
							<FileArchive class="mr-2 size-4" />
						{/if}
						CSV一括ダウンロード
					</Button>
					<Button onclick={handlePrint} disabled={selectedCount === 0 || isPrinting}>
						{#if isPrinting}
							<Loader2 class="mr-2 size-4 animate-spin" />
						{:else}
							<Printer class="mr-2 size-4" />
						{/if}
						一括印刷
					</Button>
				</div>
			</Card.Footer>
		</Card.Root>

		<!-- 使い方の説明 -->
		<Card.Root>
			<Card.Header>
				<Card.Title class="text-base">使い方</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-2 text-sm text-muted-foreground">
				<p>
					<strong>一括印刷:</strong> 選択した帳簿をまとめて印刷します。印刷ダイアログで「PDFとして保存」を選ぶと、1つのPDFファイルに全帳簿を含めることができます。
				</p>
				<p>
					<strong>CSV一括ダウンロード:</strong> 選択した帳簿をCSVファイルとしてZIPにまとめてダウンロードします。ExcelやGoogleスプレッドシートで開けます。
				</p>
				<p class="pt-2 text-xs">
					※
					各帳簿ページ（仕訳帳、試算表など）からはCSV出力のみ可能です。印刷・PDF保存はこのページから行ってください。
				</p>
			</Card.Content>
		</Card.Root>
	{/if}
</div>
