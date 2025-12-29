<script lang="ts">
	import { HelpNote, HelpSection, HelpTable } from '$lib/components/help';
</script>

<div>
	<h1 class="mb-6 text-2xl font-bold">PWA・オフライン</h1>

	<HelpSection title="PWAとは">
		<p>
			PWA（Progressive Web App）は、Webサイトをアプリのようにインストールして使える技術です。
			e-shiwakeはPWA対応しており、以下のメリットがあります。
		</p>
		<ul class="ml-4 list-disc space-y-1">
			<li>ホーム画面から直接起動</li>
			<li>オフラインでも動作</li>
			<li>ブラウザのアドレスバーなしで使用</li>
		</ul>
	</HelpSection>

	<HelpSection title="インストール方法">
		<h3 class="mt-4 font-medium">Chrome / Edge（PC）</h3>
		<ol class="ml-4 list-decimal space-y-1">
			<li>アドレスバー右端のインストールアイコンをクリック</li>
			<li>「インストール」をクリック</li>
		</ol>

		<h3 class="mt-4 font-medium">Chrome（Android）</h3>
		<ol class="ml-4 list-decimal space-y-1">
			<li>メニュー（︙）を開く</li>
			<li>「アプリをインストール」または「ホーム画面に追加」をタップ</li>
		</ol>

		<h3 class="mt-4 font-medium">Safari（iOS / iPadOS）</h3>
		<ol class="ml-4 list-decimal space-y-1">
			<li>共有ボタン（□↑）をタップ</li>
			<li>「ホーム画面に追加」をタップ</li>
			<li>「追加」をタップ</li>
		</ol>
		<HelpNote type="info">
			<p>iOSでは「ホーム画面に追加」という名称ですが、PWAとして動作します。</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="オフライン利用">
		<p>
			e-shiwakeはオフラインでも完全に動作します。
			データはローカル（IndexedDB）に保存されるため、インターネット接続は不要です。
		</p>
		<HelpNote type="tip">
			<p>
				初回アクセス時にアプリのファイルがキャッシュされます。
				2回目以降はオフラインでも起動できます。
			</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="プラットフォーム別の機能差">
		<HelpTable
			headers={['機能', 'Chrome/Edge', 'Safari']}
			rows={[
				['PWAインストール', '○', '○（ホーム画面に追加）'],
				['オフライン動作', '○', '○'],
				['ファイル保存先選択', '○', '×'],
				['PDF直接保存', '○', '×（ダウンロード）']
			]}
		/>
		<HelpNote type="info">
			<p>SafariではFile System Access APIが未対応のため、 PDFはIndexedDB内に保存されます。</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="データの同期">
		<p>e-shiwakeはローカルファーストのアプリのため、 デバイス間の自動同期機能はありません。</p>
		<p class="mt-2">
			別のデバイスでデータを使用する場合は、 エクスポート/インポート機能をご利用ください。
		</p>
	</HelpSection>
</div>
