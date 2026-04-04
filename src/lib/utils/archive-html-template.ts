/**
 * アーカイブ用 検索HTML テンプレート
 * 単一HTMLファイル（JS/CSSインライン）でオフライン動作
 * 電帳法3要件（日付・金額・取引先）の検索に対応
 */

/**
 * アーカイブHTMLに埋め込むデータ構造
 */
export interface ArchiveData {
	meta: {
		appName: string;
		appVersion: string;
		exportedAt: string;
		fiscalYear: number;
		journalCount: number;
		accountCount: number;
		vendorCount: number;
		attachmentCount: number;
	};
	accounts: { code: string; name: string; type: string }[];
	journals: {
		id: string;
		date: string;
		vendor: string;
		description: string;
		lines: {
			type: 'debit' | 'credit';
			accountCode: string;
			accountName: string;
			amount: number;
			taxCategory?: string;
		}[];
		attachments: {
			generatedName: string;
			path: string; // ZIP内相対パス
		}[];
	}[];
}

/**
 * 検索HTMLを生成
 */
export function generateArchiveHtml(data: ArchiveData): string {
	const jsonData = JSON.stringify(data);

	return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>e-shiwake アーカイブ — ${data.meta.fiscalYear}年度</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0f172a;--bg2:#1e293b;--bg3:#334155;
  --text:#e2e8f0;--text2:#94a3b8;--text3:#64748b;
  --accent:#818cf8;--accent2:#6366f1;
  --green:#4ade80;--red:#f87171;--yellow:#fbbf24;
  --border:#475569;--radius:8px;
}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Hiragino Sans",sans-serif;background:var(--bg);color:var(--text);line-height:1.6;min-height:100vh}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}

.container{max-width:1200px;margin:0 auto;padding:16px}

header{background:var(--bg2);border-bottom:1px solid var(--border);padding:16px 0;margin-bottom:24px}
header .container{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px}
header h1{font-size:1.25rem;font-weight:700}
header h1 span{color:var(--accent)}
.meta{font-size:0.8rem;color:var(--text2)}

.header-stats{font-size:0.8rem;color:var(--text2);margin-top:4px}

.filters{background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:24px}
.filters h2{font-size:0.9rem;margin-bottom:12px;color:var(--text2)}
.filter-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
.filter-group{display:flex;flex-direction:column;gap:4px}
.filter-group label{font-size:0.75rem;color:var(--text2)}
.filter-group input,.filter-group select{
  background:var(--bg3);border:1px solid var(--border);border-radius:4px;
  color:var(--text);padding:6px 10px;font-size:0.85rem;width:100%;
}
.filter-group input:focus,.filter-group select:focus{outline:2px solid var(--accent);outline-offset:-1px}
.filter-actions{display:flex;gap:8px;align-items:end}
.btn{
  background:var(--accent2);color:#fff;border:none;border-radius:4px;
  padding:6px 16px;cursor:pointer;font-size:0.85rem;white-space:nowrap;
}
.btn:hover{opacity:0.9}
.btn-outline{background:transparent;border:1px solid var(--border);color:var(--text2)}
.btn-outline:hover{background:var(--bg3)}

.result-info{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:0.85rem;color:var(--text2)}

table{width:100%;border-collapse:collapse;font-size:0.85rem}
thead{background:var(--bg2);position:sticky;top:0;z-index:1}
th{text-align:left;padding:10px 12px;border-bottom:2px solid var(--border);color:var(--text2);font-weight:600;white-space:nowrap}
td{padding:8px 12px;border-bottom:1px solid var(--border);vertical-align:top}
tr:hover td{background:var(--bg2)}
.debit{color:var(--green)}
.credit{color:var(--red)}
.amount{text-align:right;font-variant-numeric:tabular-nums}
.attachments{display:flex;flex-wrap:wrap;gap:4px}
.attachment-link{
  display:inline-flex;align-items:center;gap:2px;
  background:var(--bg3);padding:2px 8px;border-radius:4px;font-size:0.75rem;
}
.no-results{text-align:center;padding:48px 16px;color:var(--text3)}

.pagination{display:flex;justify-content:center;align-items:center;gap:8px;margin-top:16px;font-size:0.85rem}

.report-nav{background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:24px}
.report-nav h2{font-size:0.9rem;margin-bottom:12px;color:var(--text2)}
.report-links{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px}
.report-link{display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg3);border-radius:4px;color:var(--text);font-size:0.85rem;transition:background 0.15s}
.report-link:hover{background:var(--accent2);text-decoration:none}
.report-link .icon{font-size:1rem}

footer{margin-top:48px;padding:16px 0;border-top:1px solid var(--border);text-align:center;font-size:0.75rem;color:var(--text3)}

@media print{
  body{background:#fff;color:#000}
  .filters,.pagination,.btn{display:none}
  header{background:#fff;border-color:#ccc}
  header h1 span{color:#333}
  table{font-size:0.7rem}
  th{border-color:#ccc;color:#333}
  td{border-color:#eee}
  .debit{color:#16a34a}
  .credit{color:#dc2626}
  tr:hover td{background:transparent}
  .attachment-link{background:#eee;color:#333}
  footer{color:#999}
}
@media(max-width:768px){
  .filter-grid{grid-template-columns:1fr 1fr}
  table{font-size:0.75rem}
  th,td{padding:6px 8px}
}
@media(max-width:480px){
  .filter-grid{grid-template-columns:1fr}
}
</style>
</head>
<body>

<header>
  <div class="container">
    <h1><span>e-shiwake</span> アーカイブ — ${data.meta.fiscalYear}年度</h1>
    <div class="meta">作成日: ${new Date(data.meta.exportedAt).toLocaleDateString('ja-JP')} | ${data.meta.appName} v${data.meta.appVersion}</div>
  </div>
  <div class="container">
    <div class="header-stats" id="stats"></div>
  </div>
</header>

<div class="container">

  <div class="report-nav">
    <h2>帳簿レポート（HTML・CSV）</h2>
    <div class="report-links">
      <a class="report-link" href="reports/html/仕訳帳_${data.meta.fiscalYear}.html"><span class="icon">📒</span>仕訳帳</a>
      <a class="report-link" href="reports/html/総勘定元帳_${data.meta.fiscalYear}.html"><span class="icon">📖</span>総勘定元帳</a>
      <a class="report-link" href="reports/html/試算表_${data.meta.fiscalYear}.html"><span class="icon">⚖️</span>試算表</a>
      <a class="report-link" href="reports/html/損益計算書_${data.meta.fiscalYear}.html"><span class="icon">📈</span>損益計算書</a>
      <a class="report-link" href="reports/html/貸借対照表_${data.meta.fiscalYear}.html"><span class="icon">🏛️</span>貸借対照表</a>
      <a class="report-link" href="reports/html/消費税集計_${data.meta.fiscalYear}.html"><span class="icon">🧾</span>消費税集計</a>
    </div>
    <p style="margin-top:8px;font-size:0.75rem;color:var(--text3)">CSV版は reports/csv/ フォルダ内にあります</p>
  </div>

  <div class="filters">
    <h2>検索フィルタ（電帳法対応: 日付・金額・取引先）</h2>
    <div class="filter-grid">
      <div class="filter-group">
        <label for="f-date-from">日付（開始）</label>
        <input type="date" id="f-date-from">
      </div>
      <div class="filter-group">
        <label for="f-date-to">日付（終了）</label>
        <input type="date" id="f-date-to">
      </div>
      <div class="filter-group">
        <label for="f-amount-min">金額（最小）</label>
        <input type="number" id="f-amount-min" placeholder="0" min="0">
      </div>
      <div class="filter-group">
        <label for="f-amount-max">金額（最大）</label>
        <input type="number" id="f-amount-max" placeholder="" min="0">
      </div>
      <div class="filter-group">
        <label for="f-vendor">取引先</label>
        <input type="text" id="f-vendor" placeholder="取引先名で検索">
      </div>
      <div class="filter-group">
        <label for="f-desc">摘要</label>
        <input type="text" id="f-desc" placeholder="摘要で検索">
      </div>
      <div class="filter-group">
        <label for="f-account">勘定科目</label>
        <select id="f-account"><option value="">すべて</option></select>
      </div>
      <div class="filter-actions">
        <button class="btn" onclick="applyFilter()">検索</button>
        <button class="btn btn-outline" onclick="clearFilter()">クリア</button>
      </div>
    </div>
  </div>

  <div class="result-info">
    <span id="result-count"></span>
    <span id="total-amount"></span>
  </div>

  <div style="overflow-x:auto">
    <table>
      <thead>
        <tr>
          <th>日付</th>
          <th>摘要</th>
          <th>取引先</th>
          <th>借方科目</th>
          <th class="amount">借方金額</th>
          <th>貸方科目</th>
          <th class="amount">貸方金額</th>
          <th>証憑</th>
        </tr>
      </thead>
      <tbody id="journal-body"></tbody>
    </table>
  </div>

  <div id="no-results" class="no-results" style="display:none">
    検索条件に一致する仕訳はありません。
  </div>

  <div class="pagination" id="pagination"></div>
</div>

<footer>
  <div class="container">
    e-shiwake アーカイブ（${data.meta.fiscalYear}年度）— 読み取り専用。このファイルはオフラインで動作します。
  </div>
</footer>

<script>
(function(){
  var DATA = ${jsonData};
  var PAGE_SIZE = 50;
  var currentPage = 1;
  var filtered = DATA.journals;
  var accountMap = {};
  DATA.accounts.forEach(function(a){ accountMap[a.code] = a.name; });

  // 統計表示（ヘッダー内にインライン）
  var statsEl = document.getElementById('stats');
  statsEl.textContent = '仕訳: ' + DATA.meta.journalCount + '、勘定科目: ' + DATA.meta.accountCount + '、取引先: ' + DATA.meta.vendorCount + '、証憑: ' + DATA.meta.attachmentCount;

  // 勘定科目セレクト
  var sel = document.getElementById('f-account');
  DATA.accounts.slice().sort(function(a,b){ return a.code.localeCompare(b.code); }).forEach(function(a){
    var opt = document.createElement('option');
    opt.value = a.code;
    opt.textContent = a.code + ' ' + a.name;
    sel.appendChild(opt);
  });

  function esc(s){ var d=document.createElement('div');d.textContent=s;return d.innerHTML; }

  function fmt(n){
    return n.toLocaleString('ja-JP');
  }

  function maxAmount(journal){
    var m = 0;
    journal.lines.forEach(function(l){ if(l.amount > m) m = l.amount; });
    return m;
  }

  window.applyFilter = function(){
    var dateFrom = document.getElementById('f-date-from').value;
    var dateTo = document.getElementById('f-date-to').value;
    var amountMin = document.getElementById('f-amount-min').value;
    var amountMax = document.getElementById('f-amount-max').value;
    var vendor = document.getElementById('f-vendor').value.toLowerCase();
    var desc = document.getElementById('f-desc').value.toLowerCase();
    var account = document.getElementById('f-account').value;

    filtered = DATA.journals.filter(function(j){
      if(dateFrom && j.date < dateFrom) return false;
      if(dateTo && j.date > dateTo) return false;
      if(vendor && j.vendor.toLowerCase().indexOf(vendor) === -1) return false;
      if(desc && j.description.toLowerCase().indexOf(desc) === -1) return false;
      if(account){
        var hasAccount = false;
        j.lines.forEach(function(l){ if(l.accountCode === account) hasAccount = true; });
        if(!hasAccount) return false;
      }
      var ma = maxAmount(j);
      if(amountMin && ma < Number(amountMin)) return false;
      if(amountMax && ma > Number(amountMax)) return false;
      return true;
    });
    currentPage = 1;
    render();
  };

  window.clearFilter = function(){
    document.getElementById('f-date-from').value = '';
    document.getElementById('f-date-to').value = '';
    document.getElementById('f-amount-min').value = '';
    document.getElementById('f-amount-max').value = '';
    document.getElementById('f-vendor').value = '';
    document.getElementById('f-desc').value = '';
    document.getElementById('f-account').value = '';
    filtered = DATA.journals;
    currentPage = 1;
    render();
  };

  window.goPage = function(p){
    currentPage = p;
    render();
    window.scrollTo(0, document.querySelector('table').offsetTop - 16);
  };

  function render(){
    var total = filtered.length;
    var pages = Math.ceil(total / PAGE_SIZE);
    if(currentPage > pages) currentPage = pages || 1;
    var start = (currentPage - 1) * PAGE_SIZE;
    var pageItems = filtered.slice(start, start + PAGE_SIZE);

    // 結果件数
    var totalDebit = 0;
    filtered.forEach(function(j){
      j.lines.forEach(function(l){ if(l.type === 'debit') totalDebit += l.amount; });
    });
    document.getElementById('result-count').textContent = total + '件の仕訳' + (total !== DATA.journals.length ? '（' + DATA.journals.length + '件中）' : '');
    document.getElementById('total-amount').textContent = '借方合計: ¥' + fmt(totalDebit);

    // テーブル
    var body = document.getElementById('journal-body');
    var html = '';
    pageItems.forEach(function(j){
      var debits = j.lines.filter(function(l){return l.type==='debit'});
      var credits = j.lines.filter(function(l){return l.type==='credit'});
      var rowCount = Math.max(debits.length, credits.length, 1);

      for(var i=0; i<rowCount; i++){
        html += '<tr>';
        if(i===0){
          html += '<td rowspan="'+rowCount+'">'+esc(j.date)+'</td>';
          html += '<td rowspan="'+rowCount+'">'+esc(j.description)+'</td>';
          html += '<td rowspan="'+rowCount+'">'+esc(j.vendor)+'</td>';
        }
        var d = debits[i];
        var c = credits[i];
        html += '<td class="debit">'+(d ? esc(d.accountName) : '')+'</td>';
        html += '<td class="amount debit">'+(d ? '¥'+fmt(d.amount) : '')+'</td>';
        html += '<td class="credit">'+(c ? esc(c.accountName) : '')+'</td>';
        html += '<td class="amount credit">'+(c ? '¥'+fmt(c.amount) : '')+'</td>';
        if(i===0){
          html += '<td rowspan="'+rowCount+'">';
          if(j.attachments.length > 0){
            html += '<div class="attachments">';
            j.attachments.forEach(function(a){
              html += '<a class="attachment-link" href="'+esc(a.path)+'" target="_blank" title="'+esc(a.generatedName)+'">📎 '+esc(a.generatedName.length > 30 ? a.generatedName.substring(0,27)+'...' : a.generatedName)+'</a>';
            });
            html += '</div>';
          }
          html += '</td>';
        }
        html += '</tr>';
      }
    });
    body.innerHTML = html;

    // no results
    document.getElementById('no-results').style.display = total === 0 ? 'block' : 'none';

    // pagination
    var pagEl = document.getElementById('pagination');
    if(pages <= 1){ pagEl.innerHTML = ''; return; }
    var ph = '';
    if(currentPage > 1) ph += '<button class="btn btn-outline" onclick="goPage('+(currentPage-1)+')">← 前</button>';
    ph += '<span>' + currentPage + ' / ' + pages + '</span>';
    if(currentPage < pages) ph += '<button class="btn btn-outline" onclick="goPage('+(currentPage+1)+')">次 →</button>';
    pagEl.innerHTML = ph;
  }

  // Enterキーで検索
  document.querySelectorAll('.filters input').forEach(function(el){
    el.addEventListener('keydown', function(e){ if(e.key === 'Enter') window.applyFilter(); });
  });

  render();
})();
</script>
</body>
</html>`;
}
