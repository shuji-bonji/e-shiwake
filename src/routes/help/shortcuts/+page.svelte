<script lang="ts">
	import { HelpSection, HelpTable } from '$lib/components/help';
</script>

<div>
	<h1 class="mb-6 text-2xl font-bold">ショートカット</h1>

	<HelpSection title="仕訳入力">
		<HelpTable
			headers={['操作', 'Windows / Linux', 'Mac']}
			rows={[
				['新規仕訳', 'Ctrl + N', 'Cmd + N'],
				['仕訳を保存', '自動保存', '自動保存'],
				['確認なしで削除', 'Ctrl + クリック（×）', 'Cmd + クリック（×）']
			]}
		/>
	</HelpSection>

	<HelpSection title="ナビゲーション">
		<HelpTable
			headers={['操作', 'Windows / Linux', 'Mac']}
			rows={[
				['仕訳帳へ移動', 'Ctrl + 1', 'Cmd + 1'],
				['勘定科目へ移動', 'Ctrl + 2', 'Cmd + 2'],
				['設定へ移動', 'Ctrl + ,', 'Cmd + ,'],
				['ヘルプを開く', 'F1', 'F1']
			]}
		/>
	</HelpSection>

	<HelpSection title="入力フィールド">
		<HelpTable
			headers={['操作', 'Windows / Linux', 'Mac']}
			rows={[
				['次のフィールドへ', 'Tab', 'Tab'],
				['前のフィールドへ', 'Shift + Tab', 'Shift + Tab'],
				['入力を確定', 'Enter', 'Enter'],
				['入力をキャンセル', 'Escape', 'Escape']
			]}
		/>
	</HelpSection>

	<HelpSection title="日付入力">
		<HelpTable
			headers={['入力', '結果']}
			rows={[
				['t または today', '今日の日付'],
				['y または yesterday', '昨日の日付'],
				['1/15 または 0115', '今年の1月15日'],
				['2024/1/15', '2024年1月15日']
			]}
		/>
	</HelpSection>

	<HelpSection title="金額入力">
		<HelpTable
			headers={['入力', '結果']}
			rows={[
				['1000', '1,000円'],
				['10000', '10,000円'],
				['1.5k', '1,500円'],
				['10k', '10,000円']
			]}
		/>
	</HelpSection>

	<HelpSection title="勘定科目選択">
		<HelpTable
			headers={['操作', '説明']}
			rows={[
				['文字入力', '科目名でフィルタリング'],
				['↑ / ↓', '候補を選択'],
				['Enter', '選択を確定'],
				['Escape', '選択をキャンセル']
			]}
		/>
	</HelpSection>
</div>
