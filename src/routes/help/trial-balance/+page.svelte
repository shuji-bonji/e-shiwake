<script lang="ts">
	import { HelpNote, HelpSection, HelpTable } from '$lib/components/help';
</script>

<div>
	<h1 class="mb-6 text-2xl font-bold">試算表</h1>

	<HelpSection title="試算表とは">
		<p>
			試算表は、すべての勘定科目の借方・貸方の合計と残高を一覧表示する帳簿です。
			決算前に仕訳の正確性を確認するために使用します。
		</p>
		<HelpNote type="info">
			<p>
				複式簿記では、借方合計と貸方合計は必ず一致します。
				一致していない場合は仕訳に誤りがあります。
			</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="基本的な使い方">
		<ol class="ml-4 list-decimal space-y-2">
			<li>サイドバーから「試算表」を選択</li>
			<li>画面上部のドロップダウンで年度を選択</li>
			<li>勘定科目グループごとに集計された一覧が表示されます</li>
		</ol>
	</HelpSection>

	<HelpSection title="表示モード">
		<p>2つの表示モードを切り替えられます。</p>
		<HelpTable
			headers={['モード', '表示内容', '用途']}
			rows={[
				['合計残高試算表', '借方合計・貸方合計・借方残高・貸方残高', '詳細な確認'],
				['残高試算表', '借方残高・貸方残高のみ', 'シンプルな確認']
			]}
		/>
	</HelpSection>

	<HelpSection title="勘定科目グループ">
		<p>科目は以下の5つのグループに分類されて表示されます。</p>
		<HelpTable
			headers={['グループ', '主な科目例', '通常の残高位置']}
			rows={[
				['資産', '現金、普通預金、売掛金', '借方'],
				['負債', '買掛金、未払金、借入金', '貸方'],
				['純資産', '元入金、事業主貸・借', '貸方'],
				['収益', '売上高、雑収入', '貸方'],
				['費用', '仕入高、旅費交通費、消耗品費', '借方']
			]}
		/>
	</HelpSection>

	<HelpSection title="貸借一致チェック">
		<p>画面上部に貸借一致のチェック結果が表示されます。</p>
		<ul class="ml-4 list-disc space-y-2">
			<li>
				<span class="font-medium text-green-600">緑色（貸借一致）</span>
				：借方合計と貸方合計が一致しています
			</li>
			<li>
				<span class="font-medium text-red-600">赤色（貸借不一致）</span>
				：仕訳に誤りがある可能性があります
			</li>
		</ul>
		<HelpNote type="warning">
			<p>貸借不一致の場合は、仕訳帳で各仕訳の借方・貸方が一致しているか確認してください。</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="小計と合計">
		<p>各グループの小計と、全体の合計が表示されます。</p>
		<ul class="ml-4 list-disc space-y-1">
			<li>グループ行（薄いグレー背景）：グループごとの小計</li>
			<li>合計行（青い背景）：すべての科目の合計</li>
		</ul>
	</HelpSection>

	<HelpSection title="CSVエクスポート">
		<p>試算表をCSVファイルとしてダウンロードできます。</p>
		<ol class="ml-4 list-decimal space-y-2">
			<li>年度と表示モードを選択</li>
			<li>「CSV」ボタンをクリック</li>
			<li>ファイルが自動的にダウンロードされます</li>
		</ol>
		<HelpNote type="info">
			<p>
				ファイル名は「試算表_[年度].csv」形式です。 選択中の表示モードに応じた列が出力されます。
			</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="印刷・PDF保存">
		<p>試算表を印刷またはPDFとして保存できます。</p>
		<ol class="ml-4 list-decimal space-y-2">
			<li>年度と表示モードを選択</li>
			<li>「保存」または「印刷」ボタンをクリック</li>
			<li>ブラウザの印刷ダイアログが表示されます</li>
		</ol>
		<HelpNote type="tip">
			<p>
				印刷ダイアログで「PDFとして保存」を選択すると、PDFファイルとして出力できます。
				確定申告の添付資料として活用できます。
			</p>
		</HelpNote>
	</HelpSection>
</div>
