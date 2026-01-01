<script lang="ts">
	import { HelpNote, HelpSection, HelpTable } from '$lib/components/help';
</script>

<div>
	<h1 class="mb-6 text-2xl font-bold">仕訳入力</h1>

	<HelpSection title="仕訳の追加">
		<ol class="ml-4 list-decimal space-y-2">
			<li>画面右上の「新規仕訳」ボタンをクリック</li>
			<li>仕訳リストの最下部に空の仕訳行が追加されます</li>
			<li>
				各フィールドを入力します。
				<ul class="mt-1 ml-4 list-disc">
					<li>日付（取引日）</li>
					<li>摘要（取引の内容）</li>
					<li>取引先名</li>
					<li>借方科目・金額</li>
					<li>貸方科目・金額</li>
				</ul>
			</li>
			<li>入力確定後、日付順の適切な位置に自動移動します</li>
		</ol>
	</HelpSection>

	<HelpSection title="仕訳の編集">
		<p>各フィールドを直接クリックして編集できます。変更は自動保存されます。</p>
		<HelpNote type="tip">
			<p>日付を変更すると、その日付の正しい位置に仕訳が自動的に移動します。</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="仕訳の削除">
		<ul class="ml-4 list-disc space-y-1">
			<li>仕訳行の右端にある「×」ボタンをクリック</li>
			<li>確認ダイアログで「削除」を選択</li>
		</ul>
		<HelpNote type="tip">
			<p>Ctrl（Mac: Cmd）を押しながら「×」ボタンをクリックすると、確認なしで即削除できます。</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="仕訳のコピー">
		<p>既存の仕訳をコピーして新しい仕訳を作成できます。定期的な支払いなどで便利です。</p>
		<ol class="ml-4 list-decimal space-y-2">
			<li>コピーしたい仕訳のコピーボタン（📋）をクリック</li>
			<li>コピーされた仕訳が一覧の上部に追加されます</li>
			<li>日付は今日の日付に自動設定されます</li>
			<li>証憑（添付ファイル）はコピーされません</li>
		</ol>
		<HelpNote type="info">
			<p>コピー元の勘定科目、金額、摘要、取引先がそのまま引き継がれます。</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="仕訳の検索">
		<p>検索ボックスを使って仕訳を素早く絞り込めます。</p>
		<HelpNote type="info">
			<p>検索は<strong>全年度</strong>を対象に行われます。過去の年度の仕訳も検索できます。</p>
		</HelpNote>
		<p class="mt-2"><strong>検索できる項目：</strong></p>
		<HelpTable
			headers={['入力例', '検索対象', '説明']}
			rows={[
				['Amazon', '摘要・取引先', 'テキスト部分一致'],
				['消耗品費', '勘定科目', '科目名の前方一致'],
				['10000', '金額', '完全一致'],
				['10,000', '金額', 'カンマ付き金額も可'],
				['2025-01', '年月', 'その月の仕訳を表示'],
				['12月', '月', '全年度の12月の仕訳'],
				['2025-01-15', '日付', '特定の日付'],
				['10/13', '月日', '全年度の10月13日の仕訳'],
				['1/5', '月日', 'ゼロ埋めなしもOK']
			]}
		/>
		<p class="mt-4"><strong>複数条件の検索：</strong></p>
		<p class="mt-1">
			スペースで区切って複数の条件を入力すると、すべてに一致する仕訳が表示されます（AND検索）。
		</p>
		<ul class="mt-2 ml-4 list-disc space-y-1">
			<li>
				<code class="rounded bg-muted px-1.5 py-0.5 text-sm">Amazon 12月</code> → Amazonの12月の仕訳
			</li>
			<li>
				<code class="rounded bg-muted px-1.5 py-0.5 text-sm">消耗品費 10000</code> → 消耗品費で1万円の仕訳
			</li>
		</ul>
		<HelpNote type="tip">
			<p>検索ボックス横の「ℹ️」ボタンをクリックすると、検索ヒントが表示されます。</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="複合仕訳">
		<p>1つの取引で借方または貸方が複数行ある場合（家事按分、源泉徴収など）に対応しています。</p>
		<p class="mt-2"><strong>例：携帯電話代の家事按分（80%事業使用）</strong></p>
		<HelpTable
			headers={['借方', '金額', '貸方', '金額']}
			rows={[
				['通信費', '8,000円', '普通預金', '10,000円'],
				['事業主貸', '2,000円', '', '']
			]}
		/>
		<p class="mt-4"><strong>例：源泉徴収ありの売上</strong></p>
		<HelpTable
			headers={['借方', '金額', '貸方', '金額']}
			rows={[
				['売掛金', '90,000円', '売上', '100,000円'],
				['', '', '仮受金（源泉税）', '10,000円']
			]}
		/>
	</HelpSection>

	<HelpSection title="家事按分">
		<p>
			自宅兼事務所の経費など、事業とプライベートで共用している費用を按分する機能です。
			対象の勘定科目を入力すると、借方ヘッダーに「按分適用」ボタンが表示されます。
		</p>

		<p class="mt-4"><strong>按分設定が可能な科目：</strong></p>
		<p class="mt-1 text-sm">
			水道光熱費、通信費、損害保険料、修繕費、消耗品費、減価償却費、地代家賃
		</p>
		<HelpNote type="info">
			<p>按分機能を使うには、勘定科目ページで事前に按分設定を有効化する必要があります。</p>
		</HelpNote>

		<p class="mt-4"><strong>按分の適用方法：</strong></p>
		<ol class="ml-4 list-decimal space-y-2">
			<li>按分対象の勘定科目を借方に入力すると、「借方」の横に「按分適用」ボタンが表示されます</li>
			<li>ボタンをクリックすると、勘定科目に設定されたデフォルト割合で按分が適用されます</li>
			<li>自動的に事業主貸の行が追加されます</li>
		</ol>

		<p class="mt-4"><strong>例：10万円の地代家賃を30%按分</strong></p>
		<HelpTable
			headers={['借方', '金額', '貸方', '金額']}
			rows={[
				['地代家賃', '30,000円（事業分）', '普通預金', '100,000円'],
				['事業主貸', '70,000円（家事分）', '', '']
			]}
		/>

		<HelpNote type="tip">
			<p>
				勘定科目ページで、按分対象の科目や事業割合のデフォルト値を変更できます。
				よく使う割合に設定しておくと便利です。
			</p>
		</HelpNote>

		<p class="mt-4"><strong>按分の解除・変更：</strong></p>
		<ul class="ml-4 list-disc space-y-1">
			<li>適用済みの場合、「30%」のようにパーセンテージが表示されます</li>
			<li>×ボタンをクリックすると按分が解除され、元の金額に戻ります</li>
		</ul>

		<HelpNote type="tip">
			<p>
				按分適用後に金額を変更すると、設定した割合で自動的に再計算されます。
				金額を入力する前に按分を適用しておくことも可能です。
			</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="借方・貸方のルール">
		<p>複式簿記では、勘定科目の種別によって借方・貸方の位置が決まります。</p>
		<HelpTable
			headers={['種別', '増加時', '減少時']}
			rows={[
				['資産', '借方', '貸方'],
				['負債', '貸方', '借方'],
				['純資産', '貸方', '借方'],
				['収益', '貸方', '―'],
				['費用', '借方', '―']
			]}
		/>
		<HelpNote type="info">
			<p>種別アイコンで増減がわかります。⬆ = 増加、⬇ = 減少</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="バリデーション">
		<p>借方合計と貸方合計が一致しない場合、警告が表示されます。</p>
		<HelpNote type="warning">
			<p>警告が出ていても保存は可能ですが、確定申告前に必ず修正してください。</p>
		</HelpNote>
	</HelpSection>
</div>
