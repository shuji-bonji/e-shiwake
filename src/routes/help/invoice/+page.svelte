<script lang="ts">
	import { HelpNote, HelpSection, HelpTable } from '$lib/components/help';

	const pageDescription =
		'請求書の作成・編集・印刷方法と、仕訳生成機能の使い方。 - e-shiwake ヘルプ';
</script>

<svelte:head>
	<meta name="description" content={pageDescription} />
	<meta property="og:description" content={pageDescription} />
	<meta name="twitter:description" content={pageDescription} />
</svelte:head>

<div>
	<h1 class="mb-6 text-2xl font-bold">請求書</h1>

	<HelpSection title="請求書機能とは">
		<p>
			請求書機能では、取引先への請求書を作成・管理できます。
			作成した請求書は印刷やPDF保存が可能で、売掛金仕訳・入金仕訳を自動生成できます。
		</p>
		<HelpNote type="info">
			<p>請求書の変更は自動保存されるため、手動で保存する必要はありません。</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="請求書一覧">
		<p>サイドバーから「請求書」を選択すると、請求書一覧が表示されます。</p>
		<ul class="mt-2 ml-4 list-disc space-y-1">
			<li>年度ごとに請求書を管理</li>
			<li>ステータス（下書き・発行済み・入金済み）でフィルタリング</li>
			<li>請求書番号、発行日、取引先、金額、ステータスを一覧表示</li>
		</ul>
	</HelpSection>

	<HelpSection title="請求書の作成">
		<ol class="ml-4 list-decimal space-y-2">
			<li>「新規作成」ボタンをクリック</li>
			<li>請求書番号が自動採番されます（必要に応じて変更可能）</li>
			<li>基本情報（発行日、支払期限、取引先）を入力</li>
			<li>明細行を追加し、品名・数量・単価を入力</li>
			<li>必要に応じて備考を入力</li>
		</ol>
		<HelpNote type="tip">
			<p>
				取引先は事前に「取引先管理」で登録しておくとスムーズです。
				請求書画面から直接追加することはできません。
			</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="入力項目">
		<HelpTable
			headers={['項目', '説明', '例']}
			rows={[
				['請求書番号', '請求書を識別する番号（自動採番）', 'INV-2026-0001'],
				['発行日', '請求書の発行日', '2026-01-15'],
				['支払期限', '支払いの期限日', '2026-01-31'],
				['取引先', '請求先（登録済みの取引先から選択）', '株式会社サンプル'],
				['備考', '振込口座や注意事項など', '振込手数料はご負担ください']
			]}
		/>
	</HelpSection>

	<HelpSection title="明細行">
		<p>「行を追加」ボタンで明細行を追加できます。</p>
		<HelpTable
			headers={['項目', '説明', '例']}
			rows={[
				['日付', '作業期間や対象月など（自由記述）', '1月分、1/1〜1/31'],
				['品名・サービス名', '提供した商品やサービスの名称', 'システム開発'],
				['数量', '数量（小数可）', '1、1.5'],
				['単価', '1単位あたりの価格（税抜）', '100,000'],
				['税率', '消費税率（10%または8%）', '10%'],
				['金額', '自動計算（数量 × 単価）', '100,000']
			]}
		/>
		<HelpNote type="info">
			<p>
				金額は数量と単価から自動計算されます。
				消費税は税率ごとに集計され、端数は切り捨てで計算されます。
			</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="ステータス管理">
		<p>請求書には3つのステータスがあります。</p>
		<HelpTable
			headers={['ステータス', '説明', '操作']}
			rows={[
				['下書き', '作成中の請求書', '「発行済みにする」で次へ'],
				['発行済み', '取引先に送付した請求書', '「入金済みにする」で完了'],
				['入金済み', '入金が確認された請求書', '完了状態']
			]}
		/>
		<HelpNote type="tip">
			<p>ステータスは請求書編集画面のヘッダーから変更できます。</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="仕訳の自動生成">
		<p>請求書から以下の仕訳を自動生成できます。</p>

		<h3 class="mt-4 mb-2 font-medium">売掛金仕訳</h3>
		<p>「売掛金仕訳」ボタンをクリックすると、売上計上の仕訳が作成されます。</p>
		<ul class="mt-2 ml-4 list-disc space-y-1">
			<li>借方：売掛金（税込合計）</li>
			<li>貸方：売上高（10%対象、8%対象それぞれ）</li>
		</ul>

		<h3 class="mt-4 mb-2 font-medium">入金仕訳</h3>
		<p>
			入金済みステータスの請求書で「入金仕訳」ボタンをクリックすると、入金日を指定して仕訳を作成できます。
		</p>
		<ul class="mt-2 ml-4 list-disc space-y-1">
			<li>借方：普通預金（税込合計）</li>
			<li>貸方：売掛金（税込合計）</li>
		</ul>

		<HelpNote type="warning">
			<p>
				生成された仕訳は仕訳帳で確認・編集できます。
				必要に応じて勘定科目や消費税区分を調整してください。
			</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="印刷・PDF保存">
		<p>請求書編集画面の「印刷」ボタンから、請求書を印刷またはPDFとして保存できます。</p>
		<ol class="ml-4 list-decimal space-y-2">
			<li>「印刷」ボタンをクリック</li>
			<li>ブラウザの印刷ダイアログが表示されます</li>
			<li>プリンターを選択して印刷、または「PDFとして保存」を選択</li>
		</ol>
		<HelpNote type="info">
			<p>
				印刷時には事業者情報（事業者名、住所、電話番号など）が表示されます。
				事業者情報は「データ管理」ページで設定できます。
			</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="請求書番号の採番ルール">
		<p>新規作成時、請求書番号は以下のルールで自動採番されます。</p>
		<ul class="mt-2 ml-4 list-disc space-y-1">
			<li>形式：INV-{'{年}'}-{'{4桁の連番}'}</li>
			<li>例：INV-2026-0001、INV-2026-0002</li>
			<li>年度ごとに連番がリセットされます</li>
			<li>採番後に手動で変更することも可能です</li>
		</ul>
	</HelpSection>

	<HelpSection title="注意事項">
		<HelpNote type="warning">
			<p>請求書を削除すると復元できません。 削除前に必要なデータをエクスポートしてください。</p>
		</HelpNote>
		<HelpNote type="info">
			<p>
				取引先を削除しようとした場合、その取引先を使用している請求書があると削除できません。
				先に請求書を削除または取引先を変更してください。
			</p>
		</HelpNote>
	</HelpSection>
</div>
