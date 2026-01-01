<script lang="ts">
	import { HelpNote, HelpSection, HelpTable } from '$lib/components/help';
</script>

<div>
	<h1 class="mb-6 text-2xl font-bold">総勘定元帳</h1>

	<HelpSection title="総勘定元帳とは">
		<p>
			総勘定元帳は、勘定科目ごとに取引を時系列で一覧表示し、残高の推移を確認できる帳簿です。
			仕訳帳に記録された取引を、科目別に整理して表示します。
		</p>
		<HelpNote type="info">
			<p>確定申告や決算時に、各科目の取引履歴と残高を確認するために使用します。</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="基本的な使い方">
		<ol class="ml-4 list-decimal space-y-2">
			<li>サイドバーから「総勘定元帳」を選択</li>
			<li>画面上部のドロップダウンで年度を選択</li>
			<li>勘定科目を選択すると、その科目の取引一覧が表示されます</li>
		</ol>
	</HelpSection>

	<HelpSection title="科目の切り替え">
		<p>以下の方法で表示する科目を切り替えられます。</p>
		<ul class="mt-2 ml-4 list-disc space-y-1">
			<li>ドロップダウンから科目を選択</li>
			<li>「＜」「＞」ボタンで前後の科目に移動</li>
		</ul>
		<HelpNote type="tip">
			<p>使用されている科目のみがリストに表示されます。取引がない科目は表示されません。</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="表示項目">
		<HelpTable
			headers={['項目', '説明']}
			rows={[
				['日付', '取引日（月/日形式）'],
				['摘要', '取引の内容'],
				['相手科目', '対となる勘定科目'],
				['借方', '借方金額'],
				['貸方', '貸方金額'],
				['残高', '取引後の累計残高']
			]}
		/>
		<HelpNote type="info">
			<p>複合仕訳の場合、相手科目は「諸口」と表示されます。</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="残高の計算">
		<p>残高は勘定科目の種別によって計算方法が異なります。</p>
		<HelpTable
			headers={['種別', '残高の増加', '残高の減少']}
			rows={[
				['資産', '借方', '貸方'],
				['負債', '貸方', '借方'],
				['純資産', '貸方', '借方'],
				['収益', '貸方', '借方'],
				['費用', '借方', '貸方']
			]}
		/>
	</HelpSection>

	<HelpSection title="CSVエクスポート">
		<p>表示中の科目データをCSVファイルとしてダウンロードできます。</p>
		<ol class="ml-4 list-decimal space-y-2">
			<li>エクスポートしたい科目を選択</li>
			<li>「CSV」ボタンをクリック</li>
			<li>ファイルが自動的にダウンロードされます</li>
		</ol>
		<HelpNote type="info">
			<p>
				ファイル名は「総勘定元帳_[科目名]_[年度].csv」形式です。
				Excelや他の会計ソフトで開くことができます。
			</p>
		</HelpNote>
	</HelpSection>
</div>
