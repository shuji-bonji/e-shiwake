<script lang="ts">
	import { HelpSection, HelpNote, HelpTable } from '$lib/components/help';

	const pageDescription =
		'データのエクスポート・インポート・バックアップ方法。JSON/ZIP対応。 - e-shiwake ヘルプ';
</script>

<svelte:head>
	<meta name="description" content={pageDescription} />
	<meta property="og:description" content={pageDescription} />
	<meta name="twitter:description" content={pageDescription} />
</svelte:head>

<div>
	<h1 class="mb-6 text-2xl font-bold">設定・データ管理</h1>

	<p class="mb-8 text-muted-foreground">
		アプリの設定とデータ管理はサイドバーの「設定・データ管理」から行えます。
	</p>

	<HelpSection title="証憑保存設定">
		<p>PDFファイルの保存方法を選択できます。</p>
		<HelpTable
			headers={['保存先', '対応ブラウザ', '特徴']}
			rows={[
				['ローカルフォルダ', 'Chrome, Edge', 'ファイルとして直接保存。フォルダ選択が必要'],
				['ブラウザ内', 'すべて', 'IndexedDBに保存。Safari/Firefox対応。エクスポートで取り出し可能']
			]}
		/>
		<HelpNote type="info">
			<p>
				Chrome/Edgeをお使いの場合は「ローカルフォルダ」がおすすめです。
				Safari/Firefoxでは「ブラウザ内」が自動選択されます。
			</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="データの保存場所">
		<p>
			e-shiwakeのデータは、ブラウザ内のIndexedDBに保存されます。
			サーバーへのデータ送信は行いません。
		</p>
		<HelpNote type="warning">
			<p>
				ブラウザのデータ消去やシークレットモードでは、データが失われる可能性があります。
				定期的なバックアップをお勧めします。
			</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="エクスポート">
		<p>データを外部ファイルとして保存できます。年度ごとにエクスポートできます。</p>

		<h3 class="mt-4 mb-2 text-sm font-semibold">エクスポート形式と含まれるデータ</h3>
		<HelpTable
			headers={['データ', '.csv', '.json', '.zip']}
			rows={[
				['仕訳', '✅', '✅', '✅'],
				['勘定科目・取引先', '―', '✅', '✅'],
				['固定資産台帳', '―', '✅', '✅'],
				['請求書', '―', '✅', '✅'],
				['事業者情報・青色申告設定', '―', '✅', '✅'],
				['証憑PDF', '―', '―', '✅']
			]}
		/>

		<h3 class="mt-4 mb-2 text-sm font-semibold">各ボタンの用途</h3>
		<HelpTable
			headers={['ボタン', '用途']}
			rows={[
				[
					'仕訳のエクスポート (.csv)',
					'Excelでの確認や他の会計ソフトへの連携。仕訳のみのフラット形式'
				],
				[
					'データのエクスポート (.json)',
					'バックアップ、他端末への移行。証憑PDF以外の全データを含む'
				],
				[
					'データと証憑のエクスポート (.zip)',
					'完全バックアップ。JSON + 証憑PDFをまとめてダウンロード。年次アーカイブに最適'
				]
			]}
		/>
		<HelpNote type="tip">
			<p>
				確定申告後の年次アーカイブにはZIP形式がおすすめです。仕訳データと証憑PDFを一つのファイルにまとめて保存できます。
			</p>
		</HelpNote>
		<HelpNote type="info">
			<p>
				ブラウザ内保存モードでは、「ストレージ使用量」セクションから証憑PDFを年度別に個別ダウンロードすることもできます。
			</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="インポート">
		<p>JSONまたはZIPファイルからデータを復元できます。</p>
		<ol class="ml-4 list-decimal space-y-2">
			<li>「設定・データ管理」ページを開く</li>
			<li>「インポート」セクションで「ファイルを選択」</li>
			<li>エクスポートしたJSON/ZIPファイルを選択</li>
			<li>プレビューを確認後、インポートモードを選択して実行</li>
		</ol>

		<h3 class="mt-4 mb-2 text-sm font-semibold">インポートモード</h3>
		<HelpTable
			headers={['モード', '動作']}
			rows={[
				['マージ（推奨）', '既存のデータを残し、新規データのみ追加。同じIDの仕訳は上書きしない'],
				['上書き', '対象年度の既存仕訳を削除して、インポートデータで置き換え']
			]}
		/>

		<h3 class="mt-4 mb-2 text-sm font-semibold">ZIPインポート時の証憑復元</h3>
		<p>ZIPファイルに含まれる証憑PDFは、現在の保存設定に従って復元されます。</p>
		<HelpTable
			headers={['保存設定', '証憑の復元先']}
			rows={[
				[
					'ローカルフォルダ（フォルダ選択済み）',
					'指定フォルダ内の年度別サブフォルダにPDFファイルとして保存'
				],
				['ローカルフォルダ（未選択）', 'ブラウザ内（IndexedDB）に一時保存'],
				['ブラウザ内', 'IndexedDBにBlob形式で保存']
			]}
		/>
		<HelpNote type="warning">
			<p>
				JSONインポートでは証憑PDFは復元されません。証憑も含めて完全に復元するにはZIPファイルを使用してください。
			</p>
		</HelpNote>
		<HelpNote type="info">
			<p>
				ブラウザ内保存モードでは、証憑PDFの合計サイズがブラウザの容量制限を超える場合があります。大量の証憑がある場合は「ローカルフォルダ」設定での復元をおすすめします。
			</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="年度アーカイブ">
		<p>過去の年度データをZIP形式でアーカイブできます。</p>
		<ul class="ml-4 list-disc space-y-1">
			<li>仕訳データ（JSON）</li>
			<li>紐付けられたPDF証憑</li>
			<li>勘定科目・取引先マスタ</li>
			<li>固定資産台帳・請求書</li>
			<li>事業者情報・青色申告設定</li>
		</ul>
		<HelpNote type="info">
			<p>電帳法により証憑は7年間の保存が必要です。年次アーカイブをお勧めします。</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="帳簿出力">
		<p>
			サイドバーの「帳簿出力」から、複数の帳簿をまとめて印刷・CSV出力できます。
			確定申告時に必要な帳簿を一括で出力する際に便利です。
		</p>
		<HelpTable
			headers={['機能', '内容']}
			rows={[
				['一括印刷', '選択した帳簿を新しいウィンドウでまとめて印刷/PDF保存'],
				['CSV ZIP出力', '選択した帳簿のCSVファイルをZIPにまとめてダウンロード']
			]}
		/>
		<p class="mt-4">対応している帳簿:</p>
		<ul class="ml-4 list-disc space-y-1">
			<li>仕訳帳</li>
			<li>総勘定元帳（全科目 or 取引のある科目のみ）</li>
			<li>試算表（合計残高試算表）</li>
			<li>損益計算書</li>
			<li>貸借対照表</li>
			<li>消費税集計</li>
		</ul>
		<HelpNote type="tip">
			<p>
				総勘定元帳は「全ての勘定科目」または「取引のある科目のみ」を選択できます。
				印刷時間を短縮したい場合は「取引のある科目のみ」がおすすめです。
			</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="ストレージ使用量">
		<p>
			IndexedDBの容量は、ブラウザやデバイスによって異なります。
			現在の使用量は「設定・データ管理」ページで確認できます。
		</p>
		<HelpTable
			headers={['ブラウザ', '容量目安']}
			rows={[
				['Chrome / Edge', 'ディスク空き容量の約80%'],
				['Safari', '約1GB'],
				['Firefox', 'ディスク空き容量の約50%']
			]}
		/>
		<HelpNote type="tip">
			<p>
				容量を節約するには、古い年度のデータをエクスポート後に削除することを検討してください。ローカルフォルダ保存に切り替えると、ブラウザ容量を消費せずに証憑を保存できます。
			</p>
		</HelpNote>
	</HelpSection>
</div>
