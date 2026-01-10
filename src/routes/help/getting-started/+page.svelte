<script lang="ts">
	import { HelpNote, HelpSection } from '$lib/components/help';

	const pageDescription =
		'e-shiwakeの概要と基本的な使い方。初めての方はこちらから。 - e-shiwake ヘルプ';
</script>

<svelte:head>
	<meta name="description" content={pageDescription} />
	<meta property="og:description" content={pageDescription} />
	<meta name="twitter:description" content={pageDescription} />
</svelte:head>

<div>
	<h1 class="mb-6 text-2xl font-bold">はじめに</h1>

	<HelpSection title="e-shiwake とは">
		<p>e-shiwake（電子仕訳）は、フリーランス・個人事業主向けの仕訳入力＆証憑管理アプリです。</p>
		<p>以下の特徴があります。</p>
		<ul class="ml-4 list-disc space-y-1">
			<li><strong>ローカルファースト</strong>：サーバー不要、データはブラウザ内に保存</li>
			<li><strong>電帳法対応</strong>：日本の電子帳簿保存法の検索要件に準拠</li>
			<li><strong>証憑管理</strong>：PDFファイルを仕訳に紐付けて管理</li>
			<li><strong>PWA対応</strong>：オフラインでも動作、アプリとしてインストール可能</li>
		</ul>
	</HelpSection>

	<HelpSection title="対象ユーザー">
		<ul class="ml-4 list-disc space-y-1">
			<li>日本のフリーランス・個人事業主</li>
			<li>確定申告を自分で行う方</li>
			<li>クラウド会計の月額課金を避けたい方</li>
			<li>シンプルな仕訳入力ツールを探している方</li>
		</ul>
	</HelpSection>

	<HelpSection title="基本的な使い方">
		<ol class="ml-4 list-decimal space-y-2">
			<li>
				<strong>年度を選択</strong>
				<p class="text-sm">サイドバーから対象の会計年度を選択します。</p>
			</li>
			<li>
				<strong>仕訳を入力</strong>
				<p class="text-sm">「新規仕訳」ボタンから仕訳を追加します。</p>
			</li>
			<li>
				<strong>証憑を紐付け</strong>
				<p class="text-sm">
					PDFファイルをドラッグ＆ドロップで仕訳に紐付けます（元ファイルはそのまま残ります）。
				</p>
			</li>
			<li>
				<strong>データをエクスポート</strong>
				<p class="text-sm">必要に応じてJSON/CSV形式でエクスポートします。</p>
			</li>
		</ol>
	</HelpSection>

	<HelpSection title="データの保存について">
		<HelpNote type="info">
			<p>
				e-shiwakeのデータはすべてブラウザ内（IndexedDB）に保存されます。サーバーへの通信は行いません。
			</p>
		</HelpNote>
		<HelpNote type="warning">
			<p>
				ブラウザのデータを消去すると、仕訳データも削除されます。定期的なバックアップをお勧めします。
			</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="推奨環境">
		<ul class="ml-4 list-disc space-y-1">
			<li>Chrome / Edge（最新版）</li>
			<li>Safari（最新版）</li>
			<li>Firefox（最新版）</li>
		</ul>
		<p class="mt-2 text-sm">
			※ 一部の機能（証憑PDFファイル保存先の選択など）はChrome/Edgeでのみ利用可能です
		</p>
	</HelpSection>
</div>
