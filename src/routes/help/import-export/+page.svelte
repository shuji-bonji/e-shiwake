<script lang="ts">
	import { base } from '$app/paths';
	import { HelpSection, HelpNote, HelpTable } from '$lib/components/help';

	const pageDescription =
		'CSV・JSON形式でのデータエクスポート。Excelでの確認や他ソフトとの連携に。 - e-shiwake ヘルプ';
</script>

<svelte:head>
	<meta name="description" content={pageDescription} />
	<meta property="og:description" content={pageDescription} />
	<meta name="twitter:description" content={pageDescription} />
</svelte:head>

<div>
	<h1 class="mb-6 text-2xl font-bold">エクスポート</h1>

	<p class="mb-8 text-muted-foreground">
		仕訳データをCSVやJSON形式で出力します。Excelでの確認や他の会計ソフトへの連携に使用してください。
	</p>

	<HelpSection title="概要">
		<p>e-shiwakeのデータ出力は3つのレイヤーに分かれています。エクスポートはそのうちの1つです。</p>
		<HelpTable
			headers={['レイヤー', 'スコープ', '含む内容', 'リストア']}
			rows={[
				[
					'バックアップ',
					'全年度・全データ',
					'仕訳+証憑PDF+勘定科目+取引先+固定資産+請求書+設定',
					'上書きリストア'
				],
				[
					'アーカイブ',
					'年度別',
					'仕訳+証憑+帳簿レポート+検索HTML',
					'マージリストア（仕訳+証憑のみ）'
				],
				['エクスポート', '年度別', '仕訳データのCSV/JSON出力', 'リストア不可']
			]}
		/>
		<p class="mt-3">
			エクスポートは、Excelでの確認や他の会計ソフトへの連携など、<strong
				>外部利用を目的としたデータ出力</strong
			>です。
		</p>
		<HelpTable
			headers={['機能', '目的']}
			rows={[
				['CSVエクスポート', 'Excelでの確認、他の会計ソフトへの連携'],
				['JSONエクスポート', '仕訳データの外部保存（証憑を含まない）']
			]}
		/>
		<HelpNote type="info">
			<p>
				データの完全な復元にはZIPバックアップを使用してください。エクスポートしたJSON/CSVからのインポート（復元）機能はありません。データの復元には「バックアップ・リストア」を使用してください。
			</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="エクスポート形式">
		<h3 class="mt-4 mb-2 text-sm font-semibold">CSV（.csv）</h3>
		<p>仕訳データのみをフラット形式で出力します。</p>
		<HelpTable
			headers={['含まれるデータ', '含まれないデータ']}
			rows={[
				['仕訳（日付・借方・貸方・金額等）', '勘定科目マスタ'],
				['', '取引先マスタ'],
				['', '固定資産・請求書'],
				['', '証憑PDF'],
				['', '設定']
			]}
		/>
		<HelpNote type="tip">
			<p>Excelで開いて確認する場合や、弥生会計・freee等へのデータ連携に便利です。</p>
		</HelpNote>

		<h3 class="mt-4 mb-2 text-sm font-semibold">JSON（.json）</h3>
		<p>仕訳・勘定科目・取引先・設定を含むデータファイルです。証憑PDFは含みません。</p>
		<HelpTable
			headers={['含まれるデータ', '含まれないデータ']}
			rows={[
				['仕訳', '証憑PDF'],
				['勘定科目（ユーザー追加）', ''],
				['取引先', ''],
				['固定資産台帳', ''],
				['請求書', ''],
				['事業者情報・設定', '']
			]}
		/>
		<HelpNote type="info">
			<p>
				証憑PDFも含めて保存したい場合は、「バックアップ・リストア」のZIPバックアップを使用してください。
			</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="ユースケース">
		<h3 class="mt-4 mb-2 text-sm font-semibold">Excelで仕訳を確認する</h3>
		<div class="my-4 rounded-lg bg-slate-900 p-4">
			<img
				src="{base}/images/help/import-export/csv-excel.svg"
				alt="e-shiwakeからCSVエクスポートしてExcelで仕訳データを確認"
				class="w-full max-w-2xl"
			/>
		</div>
	</HelpSection>
</div>
