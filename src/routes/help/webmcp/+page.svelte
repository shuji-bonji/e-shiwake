<script lang="ts">
	import { HelpNote, HelpSection, HelpTable } from '$lib/components/help';

	const pageDescription =
		'WebMCP（AIエージェント連携）の概要、前提条件、利用可能なツール一覧。 - e-shiwake ヘルプ';

	const codeBasic = `create_journal({
  date: "2026-02-22",
  description: "電車代",
  debitLines: [{accountCode: "5005", amount: 1200, taxCategory: "na"}],
  creditLines: [{accountCode: "1001", amount: 1200, taxCategory: "na"}]
})`;

	const codeTax = `create_journal({
  date: "2026-02-22",
  description: "USBケーブル購入",
  vendor: "Amazon",
  debitLines: [{accountCode: "5011", amount: 3980, taxCategory: "purchase_10"}],
  creditLines: [{accountCode: "2002", amount: 3980, taxCategory: "na"}]
})`;

	const codeRatio = `create_journal({
  date: "2026-02-20",
  description: "携帯電話代",
  vendor: "NTTドコモ",
  debitLines: [
    {accountCode: "5006", amount: 8000, taxCategory: "purchase_10"},
    {accountCode: "3002", amount: 2000, taxCategory: "na"}
  ],
  creditLines: [{accountCode: "1003", amount: 10000, taxCategory: "na"}]
})`;
</script>

<svelte:head>
	<meta name="description" content={pageDescription} />
	<meta property="og:description" content={pageDescription} />
	<meta name="twitter:description" content={pageDescription} />
</svelte:head>

<div>
	<h1 class="mb-6 text-2xl font-bold">WebMCP - AIエージェント連携</h1>

	<HelpSection title="WebMCPとは">
		<p>
			e-shiwake は WebMCP（Web Model Context Protocol）に対応しています。WebMCP
			を使うと、AIエージェントがブラウザ上の e-shiwake
			に直接アクセスし、仕訳の検索・作成・帳簿の生成などを実行できます。
		</p>
		<p class="mt-2">
			WebMCP は W3C で標準化が進められているブラウザAPIです。Webアプリが
			<code>navigator.modelContext.registerTool()</code>
			でツールを登録すると、AIエージェント（Chrome内蔵AIなど）がそのツールを認識・実行できるようになります。
		</p>
		<HelpNote type="info">
			<p>
				従来のスクリーンショットベースの操作と比べて、トークン使用量が約89%削減され、高速かつ正確な操作が可能です。
			</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="前提条件">
		<ol class="ml-4 list-decimal space-y-2">
			<li>
				<strong>Chrome 146 以上</strong>をインストール（2026年3月安定版リリース予定）
			</li>
			<li>
				<code>chrome://flags</code> →「<strong>WebMCP for testing</strong>」を Enabled に設定
			</li>
			<li>ブラウザ再起動後、e-shiwake を開く</li>
		</ol>
		<HelpNote type="tip">
			<p>
				Chrome 拡張「<a
					href="https://chromewebstore.google.com/detail/model-context-tool-inspec/gbpdfapgefenggkahomfgkhfehlcenpd"
					target="_blank"
					rel="noopener noreferrer"
					class="text-primary underline">Model Context Tool Inspector</a
				>」をインストールすると、サイドパネルからツールを直接実行できます。
			</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="ツール概要">
		<p>
			e-shiwake は起動時に <strong>17個のツール</strong>
			を自動登録します。データ操作型（12個）とUI操作型（5個）の2種類があります。
		</p>
		<HelpTable
			headers={['種別', 'ツール数', '説明']}
			rows={[
				['データ操作型', '12個', 'データの読み書きを直接実行（検索、作成、削除、帳簿生成）'],
				[
					'UI操作型',
					'5個',
					'UIを操作してユーザーに確認させる（フォーム表示、ナビゲーション、削除確認）'
				]
			]}
		/>
		<HelpNote type="info">
			<p>
				UI操作型ツールは Human-in-the-Loop
				パターンです。AIがフォームをプリフィルし、ユーザーが内容を確認してから確定します。
			</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="データ操作型ツール">
		<h3 class="mt-2 mb-2 font-medium">仕訳管理</h3>
		<HelpTable
			headers={['ツール名', '用途', '主な引数']}
			rows={[
				['search_journals', '仕訳検索（全年度横断）', 'query, fiscalYear?'],
				['get_journals_by_year', '年度別仕訳取得', 'year'],
				['create_journal', '仕訳作成', 'date, description, debitLines, creditLines'],
				['delete_journal', '仕訳削除', 'id']
			]}
		/>

		<h3 class="mt-4 mb-2 font-medium">マスタ参照</h3>
		<HelpTable
			headers={['ツール名', '用途', '主な引数']}
			rows={[
				['list_accounts', '勘定科目一覧', 'type?'],
				['list_vendors', '取引先一覧', 'query?']
			]}
		/>

		<h3 class="mt-4 mb-2 font-medium">帳簿生成</h3>
		<HelpTable
			headers={['ツール名', '用途', '主な引数']}
			rows={[
				['generate_ledger', '総勘定元帳', 'accountCode, fiscalYear'],
				['generate_trial_balance', '試算表', 'fiscalYear'],
				['generate_profit_loss', '損益計算書', 'fiscalYear'],
				['generate_balance_sheet', '貸借対照表', 'fiscalYear']
			]}
		/>

		<h3 class="mt-4 mb-2 font-medium">税務・ユーティリティ</h3>
		<HelpTable
			headers={['ツール名', '用途', '主な引数']}
			rows={[
				['calculate_consumption_tax', '消費税集計', 'fiscalYear'],
				['get_available_years', '年度一覧', '（引数なし）']
			]}
		/>
	</HelpSection>

	<HelpSection title="UI操作型ツール">
		<p>AIがUIを操作し、ユーザーが確認・確定するパターンです。</p>
		<HelpTable
			headers={['ツール名', '用途', '主な引数']}
			rows={[
				['navigate_to', 'ページ遷移', 'page'],
				[
					'open_journal_editor',
					'仕訳入力フォームをプリフィルして表示',
					'date?, description?, vendor?, debitLines?, creditLines?'
				],
				['set_search_query', '検索クエリをセット', 'query'],
				['confirm_delete_journal', '仕訳の削除確認ダイアログを表示', 'journalId'],
				[
					'open_invoice_editor',
					'請求書エディタをプリフィルして表示',
					'invoiceId, vendorId?, dueDate?, items?'
				]
			]}
		/>
		<HelpNote type="warning">
			<p>
				UI操作型ツールは直接データを変更しません。AIがフォームに値を入力し、ユーザーが確認して「確定」ボタンを押すまで保存されません。
			</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="仕訳の例">
		<h3 class="mt-2 mb-2 font-medium">基本的な仕訳</h3>
		<p>電車代1,200円を現金で支払い：</p>
		<pre class="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-sm"><code>{codeBasic}</code></pre>

		<h3 class="mt-4 mb-2 font-medium">消費税あり</h3>
		<p>Amazonで事務用品3,980円をクレジットカードで購入：</p>
		<pre class="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-sm"><code>{codeTax}</code></pre>

		<h3 class="mt-4 mb-2 font-medium">家事按分（複合仕訳）</h3>
		<p>携帯電話代10,000円（事業80%、家事20%）：</p>
		<pre class="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-sm"><code>{codeRatio}</code></pre>
	</HelpSection>

	<HelpSection title="消費税区分">
		<HelpTable
			headers={['コード', '名称', '用途']}
			rows={[
				['sales_10', '課税売上10%', '通常の売上'],
				['sales_8', '課税売上8%', '軽減税率対象の売上'],
				['purchase_10', '課税仕入10%', '通常の経費'],
				['purchase_8', '課税仕入8%', '軽減税率対象の仕入（書籍等）'],
				['exempt', '非課税', '土地賃借料、社会保険料等'],
				['out_of_scope', '不課税', '給与、配当金等'],
				['na', '対象外', '事業主勘定、現金・預金の増減等']
			]}
		/>
	</HelpSection>

	<HelpSection title="動作確認">
		<p>
			e-shiwake を開いた状態でブラウザの DevTools Console
			を確認してください。WebMCPが有効な環境では以下のログが表示されます：
		</p>
		<pre class="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-sm"><code
				>[e-shiwake] WebMCP: 17 ツールをAIエージェントに公開しました</code
			></pre>
		<p class="mt-2">
			WebMCPが無効な環境では、以下のメッセージが表示されます（アプリの動作に影響はありません）：
		</p>
		<pre class="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-sm"><code
				>[e-shiwake WebMCP] navigator.modelContext が利用できません。WebMCP は無効です。</code
			></pre>
	</HelpSection>
</div>
