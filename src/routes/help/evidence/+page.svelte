<script lang="ts">
	import { HelpSection, HelpNote, HelpTable } from '$lib/components/help';
</script>

<div>
	<h1 class="mb-6 text-2xl font-bold">証憑管理</h1>

	<HelpSection title="証憑とは">
		<p>
			証憑とは、取引の証拠となる書類のことです。請求書、領収書、契約書などが該当します。
			e-shiwakeでは、PDFファイルを仕訳に紐付けて管理できます。
		</p>
	</HelpSection>

	<HelpSection title="証憑の紐付け方法">
		<ol class="ml-4 list-decimal space-y-2">
			<li>紐付けたい仕訳行を確認</li>
			<li>PDFファイルを仕訳行にドラッグ＆ドロップ</li>
			<li>取引先名が未入力の場合は入力を促されます</li>
			<li>紐付け完了後、証跡アイコンが変わります</li>
		</ol>
		<HelpNote type="info">
			<p>紐付け後、ファイルは電帳法準拠の命名規則で自動リネームされます。</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="ファイル命名規則">
		<p>紐付けられたファイルは以下の形式で自動リネームされます：</p>
		<code class="mt-2 block rounded bg-muted p-3 text-sm">
			{'{日付}_{種類}_{勘定科目}_{金額}円_{取引先}.pdf'}
		</code>
		<p class="mt-2"><strong>例：</strong></p>
		<ul class="ml-4 list-disc text-sm">
			<li>2024-01-15_領収書_消耗品費_3,980円_Amazon.pdf</li>
			<li>2024-01-15_請求書発行_売上_100,000円_クライアントA.pdf</li>
		</ul>
		<HelpNote type="tip">
			<p>
				この命名規則により、ファイル名だけで電帳法の検索要件（日付・金額・取引先）をクリアできます。
			</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="証跡ステータス">
		<HelpTable
			headers={['アイコン', 'ステータス', '説明']}
			rows={[
				['○（グレー）', '証跡なし', '証憑の紐付けなし'],
				['紙アイコン', '紙で保管', '紙の領収書等で保管'],
				['クリップ', '電子データ', 'PDFファイル紐付け済み']
			]}
		/>
		<p class="mt-2">アイコンをクリックすることで、ステータスを切り替えられます。</p>
	</HelpSection>

	<HelpSection title="証憑の表示">
		<p>証跡アイコン（クリップ）をクリックすると、紐付けられたPDFをプレビュー表示できます。</p>
	</HelpSection>

	<HelpSection title="電帳法について">
		<HelpNote type="info">
			<p>
				電子帳簿保存法（電帳法）では、電子で受け取った請求書・領収書等を電子データのまま保存することが義務付けられています（2024年1月〜完全義務化）。
			</p>
		</HelpNote>
		<p class="mt-4"><strong>検索要件（3項目）：</strong></p>
		<ul class="ml-4 list-disc">
			<li>取引年月日</li>
			<li>取引金額</li>
			<li>取引先名</li>
		</ul>
		<p class="mt-2 text-sm">e-shiwakeの証憑管理機能は、これらの検索要件に対応しています。</p>
		<HelpNote type="warning">
			<p>証憑は7年間の保存が必要です。定期的なバックアップをお勧めします。</p>
		</HelpNote>
	</HelpSection>
</div>
