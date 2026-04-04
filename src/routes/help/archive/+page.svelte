<script lang="ts">
	import { base } from '$app/paths';
	import { HelpSection, HelpNote, HelpTable } from '$lib/components/help';

	const pageDescription =
		'確定申告後の年度データを帳簿レポート・証憑PDF・検索HTMLとともにZIPで長期保存する「年度決算パッケージ」。 - e-shiwake ヘルプ';
</script>

<svelte:head>
	<meta name="description" content={pageDescription} />
	<meta property="og:description" content={pageDescription} />
	<meta name="twitter:description" content={pageDescription} />
</svelte:head>

<div>
	<h1 class="mb-6 text-2xl font-bold">検索機能付アーカイブ保存</h1>

	<p class="mb-8 text-muted-foreground">
		確定申告後に年度データを「封印」し、長期保存するための機能です。
	</p>

	<HelpSection title="概要">
		<p>
			検索機能付アーカイブは、仕訳データ・証憑PDF・帳簿レポートを検索可能なHTMLファイルとともにZIPにまとめて保存する「年度決算パッケージ」です。
			アプリにデータをインポートせずに、ZIPを展開するだけで過去のデータを検索・閲覧できます。
		</p>
		<p class="mt-2">
			帳簿出力（<code>/reports</code
			>）が年度途中でも利用する「現在の帳簿」であるのに対し、アーカイブは確定申告後の「確定済み帳簿」をワンセットで長期保存するためのものです。
		</p>
		<HelpNote type="tip">
			<p>
				アーカイブからリストアすると、年度の仕訳＋証憑をアプリに復活させることができます。フルバックアップからの復元も可能です。
			</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="バックアップとの違い">
		<HelpTable
			headers={['項目', 'バックアップ', '検索機能付アーカイブ']}
			rows={[
				['目的', '復元（リストア）するため', '閲覧・検索するため / 年度データ復活'],
				['証憑PDF', '✅ 含む', '✅ 含む'],
				['検索HTML', '―', '✅ 含む'],
				['帳簿レポート', '―', '✅ HTML + CSV（6帳簿）'],
				['リストア対象', '全データ（上書き）', '仕訳＋証憑のみ（マージ）'],
				['アプリへの再取り込み', '✅ フルリストア', '✅ アーカイブリストア / 閲覧'],
				['編集', 'リストア後に編集可能', 'リストアすれば編集可能 / ZIP内は読み取り専用'],
				['主な用途', '端末移行、事故対策', '年度締め、データ復活、税務調査対応']
			]}
		/>
	</HelpSection>

	<HelpSection title="アーカイブの構成">
		<p>検索機能付アーカイブは以下の構成でZIPにまとめられます:</p>
		<pre class="overflow-auto rounded bg-muted p-3 text-sm"><code
				>{`e-shiwake_2024_archive.zip
├── index.html              ← 検索・閲覧用HTML（オフライン動作）
├── data.json               ← 仕訳データ（機械可読）
├── reports/
│   ├── html/
│   │   ├── 仕訳帳_2024.html
│   │   ├── 総勘定元帳_2024.html
│   │   ├── 試算表_2024.html
│   │   ├── 損益計算書_2024.html
│   │   ├── 貸借対照表_2024.html
│   │   └── 消費税集計_2024.html
│   └── csv/
│       ├── 仕訳帳_2024.csv
│       ├── 総勘定元帳_2024.csv
│       ├── 試算表_2024.csv
│       ├── 損益計算書_2024.csv
│       ├── 貸借対照表_2024.csv
│       └── 消費税集計_2024.csv
└── evidences/
    └── 2024/
        ├── {仕訳ID}/{添付ID}/2024-01-15_領収書_通信費_8800円_NTT.pdf
        ├── {仕訳ID}/{添付ID}/2024-02-03_請求書_サーバー代_13200円_さくら.pdf
        └── ...`}</code
			></pre>
	</HelpSection>

	<HelpSection title="検索HTMLの機能">
		<ul class="ml-4 list-disc space-y-1">
			<li>仕訳の一覧表示と検索（日付・金額・取引先・摘要）</li>
			<li>勘定科目でのフィルタ</li>
			<li>証憑PDFへのリンク（ZIP内の相対パス）</li>
			<li>帳簿レポートへのリンク（HTML版）</li>
			<li>完全オフライン動作（外部サーバー不要）</li>
			<li>レスポンシブデザイン（PC・タブレット対応）</li>
			<li>印刷対応</li>
		</ul>
	</HelpSection>

	<HelpSection title="同梱される帳簿レポート">
		<HelpTable
			headers={['帳簿', 'HTML（印刷用）', 'CSV（データ連携用）']}
			rows={[
				['仕訳帳', '✅', '✅'],
				['総勘定元帳', '✅（使用科目）', '✅'],
				['試算表', '✅', '✅'],
				['損益計算書', '✅', '✅'],
				['貸借対照表', '✅', '✅'],
				['消費税集計', '✅', '✅']
			]}
		/>
		<HelpNote type="info">
			<p>
				帳簿HTMLはブラウザで直接開いて印刷できます。CSVはExcelや他の会計ソフトへの連携に利用できます。
			</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="アーカイブ後の年度データ削除">
		<p>
			アーカイブZIP作成後、ブラウザのストレージ容量を節約するためにその年度のデータを削除できます。
		</p>
		<ul class="ml-4 list-disc space-y-1">
			<li>アーカイブ完了時に「年度データを削除」ボタンが表示されます</li>
			<li>削除前に確認ダイアログが表示されます</li>
			<li>
				削除は取り消せません。削除前にアーカイブZIPまたはバックアップZIPが安全な場所に保存されていることを確認してください
			</li>
		</ul>
		<HelpNote type="tip">
			<p>
				削除後に再編集が必要になった場合は、アーカイブからリストアで年度データを復活させてください。
			</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="アーカイブからリストア">
		<p>アーカイブZIP（または旧バックアップZIP）から年度の仕訳＋証憑を復元できます。</p>

		<h3 class="mt-4 mb-2 text-sm font-semibold">リストア手順</h3>
		<ol class="ml-4 list-decimal space-y-2">
			<li>アーカイブページの「アーカイブからリストア」セクションで「ZIPファイルを選択」</li>
			<li>アーカイブZIPファイルを選択</li>
			<li>プレビューを確認（年度・仕訳件数・新規追加数）</li>
			<li>証憑PDFの復元先を選択（証憑がある場合）</li>
			<li>「仕訳を復元」ボタンをクリック</li>
		</ol>

		<h3 class="mt-4 mb-2 text-sm font-semibold">リストアの動作</h3>
		<ul class="ml-4 list-disc space-y-1">
			<li><strong>仕訳＋証憑のみ</strong>をマージ復元します</li>
			<li>既存の仕訳IDと重複するものはスキップされます（上書きしない）</li>
			<li><strong>グローバルデータ</strong>（勘定科目・取引先・固定資産・設定）は一切触りません</li>
		</ul>
		<HelpNote type="warning">
			<p>
				削除してからアーカイブリストアした場合、仕訳で使用している勘定科目や取引先が現在の登録と異なる可能性があります。リストア後にデータの整合性をご確認ください。
			</p>
		</HelpNote>

		<h3 class="mt-4 mb-2 text-sm font-semibold">旧バックアップZIPの扱い</h3>
		<p>
			v0.3.x以前の旧バックアップZIPもアーカイブリストアとして読み込めます。グローバルデータ（勘定科目・取引先・設定等）は無視され、仕訳＋証憑のみ復元されます。
		</p>
		<HelpNote type="warning">
			<p>
				旧ZIPを読み込んだ場合、プレビュー画面に「v0.3.x以前のデータです」という目立つ警告が表示されます。事業者情報・勘定科目などの設定データを含む完全な復元が必要な場合は、先にデータ管理ページで<strong
					>フルバックアップを作成</strong
				>してください。
			</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="ユースケース">
		<h3 class="mt-4 mb-2 text-sm font-semibold">確定申告後の年度締め</h3>
		<div class="my-4 rounded-lg bg-slate-900 p-4">
			<img
				src="{base}/images/help/archive/year-close.svg"
				alt="確定申告完了後に年度アーカイブを作成して安全な場所に保存"
				class="w-full max-w-2xl"
			/>
		</div>

		<h3 class="mt-4 mb-2 text-sm font-semibold">税務調査時の証憑提示</h3>
		<div class="my-4 rounded-lg bg-slate-900 p-4">
			<img
				src="{base}/images/help/archive/tax-audit.svg"
				alt="税務署からの証憑確認要求にアーカイブZIPのHTMLで対応"
				class="w-full max-w-2xl"
			/>
		</div>

		<h3 class="mt-4 mb-2 text-sm font-semibold">過去データの参照</h3>
		<div class="my-4 rounded-lg bg-slate-900 p-4">
			<img
				src="{base}/images/help/archive/past-reference.svg"
				alt="アーカイブZIPのHTMLで過去の仕訳データを検索して参照"
				class="w-full max-w-2xl"
			/>
		</div>
	</HelpSection>

	<HelpSection title="電子帳簿保存法との関係">
		<p>電帳法には2つの保存制度があり、アーカイブは両方に対応しています。</p>

		<h3 class="mt-4 mb-2 text-sm font-semibold">電子取引データ保存（第7条・義務）</h3>
		<p>電子取引データ（メール添付の請求書PDF等）は電子データのまま保存が必要です。</p>
		<HelpTable
			headers={['要件', '対応']}
			rows={[
				['取引年月日での検索', '✅ 仕訳日付で検索可能'],
				['取引金額での検索', '✅ 金額での検索・範囲指定'],
				['取引先での検索', '✅ 取引先名で検索可能'],
				['データの真実性確保', 'ファイル名に日付・金額・取引先を含む'],
				['7年間の保存', 'ZIPファイルとして長期保存可能']
			]}
		/>

		<h3 class="mt-4 mb-2 text-sm font-semibold">電子帳簿保存（第4条・任意）</h3>
		<p>
			電子的に作成した帳簿の保存に対応。アーカイブには印刷可能なHTML形式とCSV形式の帳簿レポートが含まれます。
		</p>
		<HelpTable
			headers={['帳簿', '対応']}
			rows={[
				['仕訳帳', '✅ HTML + CSV'],
				['総勘定元帳', '✅ HTML + CSV'],
				['試算表', '✅ HTML + CSV'],
				['損益計算書', '✅ HTML + CSV'],
				['貸借対照表', '✅ HTML + CSV'],
				['消費税集計', '✅ HTML + CSV']
			]}
		/>

		<HelpNote type="warning">
			<p>
				電帳法の要件を完全に満たすには、タイムスタンプの付与や訂正削除の履歴管理が必要な場合があります。詳細は税理士にご相談ください。
			</p>
		</HelpNote>
	</HelpSection>
</div>
