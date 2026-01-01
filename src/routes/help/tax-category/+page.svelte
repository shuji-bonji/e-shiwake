<script lang="ts">
	import { HelpNote, HelpSection, HelpTable } from '$lib/components/help';
</script>

<div>
	<h1 class="mb-6 text-2xl font-bold">消費税区分</h1>

	<HelpSection title="消費税区分とは">
		<p>
			消費税区分は、仕訳の消費税処理を正しく行うための設定です。
			確定申告（消費税）の際に、課税売上や課税仕入れを正確に集計するために使用します。
		</p>
	</HelpSection>

	<HelpSection title="区分一覧">
		<HelpTable
			headers={['区分', 'ラベル', '意味', '使用例']}
			rows={[
				['課税仕入10%', '課仕10%', '消費税10%の仕入れ・経費', '消耗品費、旅費交通費、通信費'],
				['課税仕入8%', '課仕8%', '軽減税率8%の仕入れ', '食料品の仕入れ'],
				['課税売上10%', '課売10%', '消費税10%の売上', '売上高、雑収入'],
				['課税売上8%', '課売8%', '軽減税率8%の売上', '食料品の売上'],
				['非課税', '非課税', '消費税が非課税の取引', '受取利息、保険料、利子割引料'],
				['不課税', '不課税', '消費税の課税対象外', '租税公課、減価償却費、給料賃金'],
				['対象外', '対象外', '消費税計算に含めない', '現金、普通預金、事業主勘定']
			]}
		/>
	</HelpSection>

	<HelpSection title="課税仕入と対象外の違い">
		<p>仕訳入力時に迷いやすいポイントを解説します。</p>

		<p class="mt-4 font-medium">課税仕入（課仕10%/課仕8%）</p>
		<ul class="mt-2 ml-4 list-disc space-y-1">
			<li><strong>仕入税額控除の対象</strong>になる</li>
			<li>確定申告で支払った消費税を控除できる</li>
			<li>例：消耗品1,100円（税込）→ 100円が仕入税額控除の対象</li>
		</ul>

		<p class="mt-4 font-medium">対象外（na）</p>
		<ul class="mt-2 ml-4 list-disc space-y-1">
			<li>消費税計算に<strong>一切含めない</strong></li>
			<li>資産・負債・純資産の勘定科目に使用</li>
			<li>例：普通預金からの引き出し、事業主貸・借</li>
		</ul>

		<HelpNote type="info">
			<p>
				「普通預金」や「現金」は<strong>支払い手段</strong>なので「対象外」です。
				消費税は「何を買ったか」（借方の費用科目）で判断します。
			</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="非課税と不課税の違い">
		<HelpTable
			headers={['区分', '内容', '例']}
			rows={[
				['非課税', '消費税法で非課税と定められた取引', '土地の譲渡、住宅家賃、保険料、受取利息'],
				['不課税', '消費税の課税対象外の取引', '給与、減価償却費、租税公課、寄付金']
			]}
		/>
		<HelpNote type="tip">
			<p>
				非課税と不課税の違いは、消費税申告書の作成時に影響します。
				免税事業者の場合はあまり気にする必要はありませんが、正しく記録しておくと安心です。
			</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="仕訳入力での設定">
		<ol class="ml-4 list-decimal space-y-2">
			<li>勘定科目を選択すると、デフォルトの消費税区分が自動設定されます</li>
			<li>必要に応じて仕訳行の税区分欄をクリックして変更できます</li>
		</ol>

		<p class="mt-4 font-medium">典型的な仕訳の例</p>
		<HelpTable
			headers={['取引', '借方（税区分）', '貸方（税区分）']}
			rows={[
				['消耗品を購入', '消耗品費（課仕10%）', '普通預金（対象外）'],
				['売上が入金', '普通預金（対象外）', '売上高（課売10%）'],
				['固定資産税を支払い', '租税公課（不課税）', '普通預金（対象外）']
			]}
		/>
	</HelpSection>

	<HelpSection title="軽減税率（8%）の対象">
		<ul class="ml-4 list-disc space-y-1">
			<li>飲食料品（酒類を除く）</li>
			<li>週2回以上発行される新聞（定期購読契約）</li>
		</ul>
		<HelpNote type="warning">
			<p>外食やケータリングは軽減税率の対象外（10%）です。</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="カスタム勘定科目の設定">
		<p>
			カスタム勘定科目を追加する際に、デフォルトの消費税区分を設定できます。
			これにより、仕訳入力時に毎回変更する手間が省けます。
		</p>
		<ol class="ml-4 list-decimal space-y-2">
			<li>勘定科目ページで科目を追加または編集</li>
			<li>「デフォルト消費税区分」を選択</li>
		</ol>
		<HelpNote type="tip">
			<p>
				例：「情報処理費」を追加してクラウドサービス利用料に使う場合は、「課仕10%」を設定しておくと便利です。
			</p>
		</HelpNote>
	</HelpSection>
</div>
