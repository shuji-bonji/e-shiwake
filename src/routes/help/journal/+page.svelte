<script lang="ts">
	import { HelpSection, HelpNote, HelpTable } from '$lib/components/help';
</script>

<div>
	<h1 class="mb-6 text-2xl font-bold">仕訳入力</h1>

	<HelpSection title="仕訳の追加">
		<ol class="ml-4 list-decimal space-y-2">
			<li>画面右上の「新規仕訳」ボタンをクリック</li>
			<li>仕訳リストの最下部に空の仕訳行が追加されます</li>
			<li>
				各フィールドを入力します：
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
			<p>種別アイコンで増減がわかります：⬆ = 増加、⬇ = 減少</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="バリデーション">
		<p>借方合計と貸方合計が一致しない場合、警告が表示されます。</p>
		<HelpNote type="warning">
			<p>警告が出ていても保存は可能ですが、確定申告前に必ず修正してください。</p>
		</HelpNote>
	</HelpSection>
</div>
