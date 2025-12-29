<script lang="ts">
	import { HelpNote, HelpSection, HelpTable } from '$lib/components/help';
</script>

<div>
	<h1 class="mb-6 text-2xl font-bold">消費税区分</h1>

	<HelpSection title="消費税区分とは">
		<p>
			消費税区分は、仕訳の消費税処理を正しく行うための設定です。
			インボイス制度に対応した区分を使用しています。
		</p>
	</HelpSection>

	<HelpSection title="区分一覧">
		<HelpTable
			headers={['区分', '税率', '説明']}
			rows={[
				['課税売上10%', '10%', '標準税率の売上'],
				['課税売上8%', '8%', '軽減税率の売上（飲食料品等）'],
				['課税仕入10%', '10%', '標準税率の仕入・経費'],
				['課税仕入8%', '8%', '軽減税率の仕入（飲食料品等）'],
				['非課税', '0%', '消費税がかからない取引'],
				['不課税', '0%', '消費税の対象外'],
				['対象外', '―', '消費税区分が不要な科目']
			]}
		/>
	</HelpSection>

	<HelpSection title="区分の設定方法">
		<ol class="ml-4 list-decimal space-y-2">
			<li>仕訳入力時、勘定科目を選択すると自動的にデフォルト区分が設定されます</li>
			<li>必要に応じて区分を変更できます（仕訳行の税区分欄をクリック）</li>
		</ol>
		<HelpNote type="tip">
			<p>勘定科目ごとにデフォルトの消費税区分が設定されています。 一般的な取引では変更不要です。</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="非課税と不課税の違い">
		<HelpTable
			headers={['区分', '内容', '例']}
			rows={[
				['非課税', '消費税法で非課税と定められた取引', '土地の譲渡、住宅家賃、保険料'],
				['不課税', '消費税の課税対象外の取引', '給与、寄付金、国外取引']
			]}
		/>
	</HelpSection>

	<HelpSection title="軽減税率（8%）の対象">
		<ul class="ml-4 list-disc space-y-1">
			<li>飲食料品（酒類を除く）</li>
			<li>週2回以上発行される新聞（定期購読契約）</li>
		</ul>
		<HelpNote type="info">
			<p>外食やケータリングは軽減税率の対象外（10%）です。</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="勘定科目のデフォルト区分">
		<p>科目の種類によって、適切なデフォルト区分が自動設定されます。</p>
		<HelpTable
			headers={['科目種別', 'デフォルト区分']}
			rows={[
				['売上関連', '課税売上10%'],
				['仕入・経費関連', '課税仕入10%'],
				['資産・負債・純資産', '対象外']
			]}
		/>
		<HelpNote type="warning">
			<p>軽減税率対象の取引では、手動で「課税売上8%」または「課税仕入8%」に変更してください。</p>
		</HelpNote>
	</HelpSection>
</div>
