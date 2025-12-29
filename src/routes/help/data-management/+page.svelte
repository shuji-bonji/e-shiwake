<script lang="ts">
	import { HelpSection, HelpNote, HelpTable } from '$lib/components/help';
</script>

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
		<p>データを外部ファイルとして保存できます。</p>
		<HelpTable
			headers={['形式', '内容', '用途']}
			rows={[
				['JSON', '仕訳・勘定科目・取引先・設定', 'バックアップ、移行'],
				['CSV', '仕訳のみ（フラット形式）', '他ソフトとの連携'],
				['ZIP', 'JSON + PDF証憑', '完全バックアップ、年次アーカイブ']
			]}
		/>
		<HelpNote type="tip">
			<p>年度ごとにエクスポートできます。「設定・データ管理」ページから実行してください。</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="インポート">
		<p>JSONファイルからデータを復元できます。</p>
		<ol class="ml-4 list-decimal space-y-2">
			<li>「設定・データ管理」ページを開く</li>
			<li>「データインポート」セクションで「ファイルを選択」</li>
			<li>エクスポートしたJSONファイルを選択</li>
			<li>確認後、インポート実行</li>
		</ol>
		<HelpNote type="warning">
			<p>インポートすると既存データが上書きされます。事前にバックアップを取ってください。</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="年度アーカイブ">
		<p>過去の年度データをZIP形式でアーカイブできます。</p>
		<ul class="ml-4 list-disc space-y-1">
			<li>仕訳データ（JSON）</li>
			<li>紐付けられたPDF証憑</li>
			<li>勘定科目・取引先マスタ</li>
		</ul>
		<HelpNote type="info">
			<p>電帳法により証憑は7年間の保存が必要です。年次アーカイブをお勧めします。</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="ストレージ使用量">
		<p>
			IndexedDBの容量は、ブラウザやデバイスによって異なります。通常、数GB程度まで使用可能です。
			現在の使用量は「設定・データ管理」ページで確認できます。
		</p>
		<HelpNote type="tip">
			<p>容量を節約するには、古い年度のデータをエクスポート後に削除することを検討してください。</p>
		</HelpNote>
	</HelpSection>
</div>
