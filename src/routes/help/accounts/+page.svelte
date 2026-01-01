<script lang="ts">
	import { HelpNote, HelpSection, HelpTable } from '$lib/components/help';
</script>

<div>
	<h1 class="mb-6 text-2xl font-bold">勘定科目管理</h1>

	<HelpSection title="勘定科目とは">
		<p>勘定科目は、取引を分類するための項目です。 e-shiwakeでは5つのカテゴリで管理しています。</p>
		<HelpTable
			headers={['カテゴリ', '説明', '例']}
			rows={[
				['資産', '会社が持っている財産', '現金、普通預金、売掛金'],
				['負債', '返済義務のあるお金', '買掛金、借入金、未払金'],
				['純資産', '資産から負債を引いた純粋な財産', '元入金、事業主借、事業主貸'],
				['収益', '売上など収入に関するもの', '売上、受取利息、雑収入'],
				['費用', '経費など支出に関するもの', '仕入、旅費交通費、消耗品費']
			]}
		/>
	</HelpSection>

	<HelpSection title="科目の追加">
		<ol class="ml-4 list-decimal space-y-2">
			<li>サイドバーから「勘定科目」を選択</li>
			<li>「科目を追加」ボタンをクリック</li>
			<li>カテゴリを選択</li>
			<li>科目名を入力</li>
			<li>必要に応じてデフォルト消費税区分を設定</li>
			<li>「追加」をクリック</li>
		</ol>
		<HelpNote type="info">
			<p>科目コードは自動で採番されます。</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="科目コード体系">
		<p>科目コードは4桁で構成されています。</p>
		<code class="mt-2 block rounded bg-muted p-3 text-sm">
			[カテゴリ][区分][連番]<br />
			&nbsp;&nbsp;&nbsp;↓&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↓&nbsp;&nbsp;&nbsp;↓<br />
			&nbsp;1桁目&nbsp;&nbsp;&nbsp;2桁目&nbsp;3-4桁目
		</code>
		<HelpTable
			headers={['桁', '意味', '値']}
			rows={[
				['1桁目', 'カテゴリ', '1:資産, 2:負債, 3:純資産, 4:収益, 5:費用'],
				['2桁目', '区分', '0:システム, 1:ユーザー追加'],
				['3-4桁目', '連番', '01-99']
			]}
		/>
		<p class="mt-2"><strong>例：</strong></p>
		<ul class="ml-4 list-disc text-sm">
			<li>1001 = 資産・システム・01番（現金）</li>
			<li>5005 = 費用・システム・05番（旅費交通費）</li>
			<li>5101 = 費用・ユーザー追加・01番</li>
		</ul>
	</HelpSection>

	<HelpSection title="科目の編集・削除">
		<ul class="ml-4 list-disc space-y-2">
			<li><strong>編集</strong>：ユーザーが追加した科目のみ編集可能</li>
			<li><strong>削除</strong>：仕訳で使用されていない科目のみ削除可能</li>
		</ul>
		<HelpNote type="warning">
			<p>システム初期科目は編集・削除できません。</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="システム科目とカスタム科目">
		<p>科目一覧では、バッジで区別されています。</p>
		<ul class="ml-4 list-disc space-y-1">
			<li><strong>システム</strong>：初期登録されている科目</li>
			<li><strong>カスタム</strong>：ユーザーが追加した科目</li>
		</ul>
	</HelpSection>

	<HelpSection title="家事按分設定">
		<p>
			費用科目に対して、家事按分の対象かどうかとデフォルトの事業割合を設定できます。
			設定した科目を仕訳で使用すると、自動的に按分パネルが表示されます。
		</p>

		<p class="mt-4"><strong>設定方法：</strong></p>
		<ol class="ml-4 list-decimal space-y-2">
			<li>費用科目の「%」アイコンをクリック（システム科目・カスタム科目どちらも可）</li>
			<li>「家事按分対象」のスイッチをオンにする</li>
			<li>デフォルトの事業割合を入力（0〜100%）</li>
			<li>「保存」をクリック</li>
		</ol>
		<HelpNote type="tip">
			<p>システム科目でも按分設定の変更は可能です。科目名やカテゴリは変更できません。</p>
		</HelpNote>

		<p class="mt-4"><strong>按分設定が可能な科目：</strong></p>
		<ul class="ml-4 list-disc space-y-1 text-sm">
			<li>水道光熱費</li>
			<li>通信費</li>
			<li>損害保険料</li>
			<li>修繕費</li>
			<li>消耗品費</li>
			<li>減価償却費</li>
			<li>地代家賃</li>
		</ul>
		<p class="mt-2 text-sm text-muted-foreground">
			※ デフォルトでは按分は設定されていません。必要に応じて有効化してください。
		</p>

		<HelpNote type="info">
			<p>
				科目一覧で、按分対象の科目には「%」アイコンが表示されます。
				按分パネルの使い方は「仕訳入力」ヘルプの「家事按分」セクションを参照してください。
			</p>
		</HelpNote>
	</HelpSection>
</div>
