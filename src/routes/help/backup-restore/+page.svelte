<script lang="ts">
	import { base } from '$app/paths';
	import { HelpSection, HelpNote, HelpTable } from '$lib/components/help';

	const pageDescription =
		'データの完全な保全と復元。フルバックアップの作成・上書きリストア方法。 - e-shiwake ヘルプ';
</script>

<svelte:head>
	<meta name="description" content={pageDescription} />
	<meta property="og:description" content={pageDescription} />
	<meta name="twitter:description" content={pageDescription} />
</svelte:head>

<div>
	<h1 class="mb-6 text-2xl font-bold">バックアップ・リストア</h1>

	<p class="mb-8 text-muted-foreground">
		データの完全な保全と復元を行います。端末移行や事故対策に使用してください。
	</p>

	<HelpSection title="概要">
		<p>
			バックアップは、<strong>全年度の全データ</strong
			>をフルスナップショットとしてZIPファイルに保存します。 リストアは、バックアップZIPから<strong
				>全データを上書き</strong
			>で復元します（マージ復元はありません）。
		</p>
		<p class="mt-2">
			年度別の仕訳・証憑を復活させたい場合は、<a href="{base}/help/archive" class="underline"
				>アーカイブからリストア</a
			>を使用してください。
		</p>
	</HelpSection>

	<HelpSection title="バックアップに含まれるデータ">
		<HelpTable
			headers={['データ', 'スコープ', '含まれる']}
			rows={[
				['仕訳', '全年度', '✅'],
				['証憑PDF', '全年度', '✅'],
				['請求書', '全年度', '✅'],
				['勘定科目（ユーザー追加含む）', '全件', '✅'],
				['取引先', '全件', '✅'],
				['固定資産台帳', '全件', '✅'],
				['事業者情報・青色申告設定', '全件', '✅'],
				['アプリ設定', '全件', '✅']
			]}
		/>
	</HelpSection>

	<HelpSection title="バックアップの作成">
		<ol class="ml-4 list-decimal space-y-2">
			<li>サイドバーの「データ管理」を開く</li>
			<li>「バックアップ作成」セクションで全体サマリを確認</li>
			<li>「フルバックアップ作成」ボタンをクリック</li>
			<li>ZIPファイルがダウンロードされる</li>
		</ol>
		<HelpNote type="info">
			<p>
				最終バックアップ日時がカード上部に表示されます。30日以上バックアップしていない場合は警告が表示されます。
			</p>
		</HelpNote>
		<HelpNote type="tip">
			<p>
				ファイル名は <code>e-shiwake_backup_YYYY-MM-DD.zip</code> の形式で保存されます。
			</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="リストア（復元）">
		<ol class="ml-4 list-decimal space-y-2">
			<li>サイドバーの「データ管理」を開く</li>
			<li>「リストア（復元）」セクションで「ZIPファイルを選択」</li>
			<li>バックアップZIPファイルを選択</li>
			<li>プレビューを確認（含まれる年度・件数）</li>
			<li>証憑PDFの復元先を選択（証憑がある場合）</li>
			<li>「全データを上書きリストア」ボタンをクリック</li>
			<li>確認ダイアログで「上書きリストア実行」をクリック</li>
		</ol>
		<HelpNote type="warning">
			<p>
				フルリストアは<strong>現在の全データを削除</strong
				>してバックアップの内容で完全に置き換えます。この操作は元に戻せません。
			</p>
		</HelpNote>

		<h3 class="mt-6 mb-2 text-sm font-semibold">ZIP判別</h3>
		<p>
			バックアップページに年度別のアーカイブZIP（旧バックアップZIP含む）を読み込ませた場合、自動的にアーカイブページへ誘導されます。逆に、アーカイブページにフルバックアップZIPを読み込ませた場合はデータ管理ページへ誘導されます。
		</p>

		<h3 class="mt-6 mb-2 text-sm font-semibold">証憑PDFの復元先</h3>
		<p>
			ZIPに証憑PDFが含まれている場合、リストア時に復元先を選択する必要があります。 選択した保存先は<strong
				>全年度</strong
			>の保存モード設定に一括適用されます。
		</p>
		<HelpTable
			headers={['保存先', '対応ブラウザ', '特徴']}
			rows={[
				['ローカルフォルダ', 'Chrome, Edge', 'ブラウザ容量を消費しない。フォルダの選択が必要'],
				['ブラウザ内', 'すべて', '全ブラウザ対応。IndexedDB容量を消費する']
			]}
		/>
		<HelpNote type="info">
			<p>
				ブラウザ内保存を選択した場合、リストア前に証憑のサイズと現在のストレージ使用量が表示されます。容量不足のリスクがある場合は警告が表示されます。
			</p>
		</HelpNote>
		<HelpNote type="warning">
			<p>
				Safari/Firefoxでは「ローカルフォルダ」は選択できません（File System Access
				API非対応）。ブラウザ内保存のみとなります。
			</p>
		</HelpNote>

		<h3 class="mt-6 mb-2 text-sm font-semibold">設定の復元について</h3>
		<p>
			リストア時に復元される設定には、事業者情報・青色申告設定・Blob保持日数などが含まれます。
			ただし、以下の設定はバックアップから復元されません（リストア先環境に依存するため）:
		</p>
		<ul class="mt-2 ml-4 list-disc space-y-1 text-sm">
			<li>
				証憑の保存モード（<code>storageMode</code>, <code>storageModeByYear</code>）→
				リストア時に選択
			</li>
			<li>最終エクスポート日時（<code>lastExportedAt</code>）</li>
		</ul>
	</HelpSection>

	<HelpSection title="バックアップ・アーカイブの違い">
		<HelpTable
			headers={['項目', 'バックアップ', 'アーカイブ']}
			rows={[
				['スコープ', '全年度・全データ', '年度別'],
				['リストア方式', '上書きのみ', 'マージのみ（仕訳+証憑）'],
				['グローバルデータ', '復元される', '復元されない'],
				['主な用途', '端末移行、事故対策', '年度締め、データ復活、税務調査対応']
			]}
		/>
	</HelpSection>

	<HelpSection title="v0.4.0へのバージョンアップ時の注意">
		<p>
			v0.4.0ではバックアップ方式が変更されました。<strong
				>v0.3.x以前のバックアップZIPからは仕訳データのみ復元</strong
			>されます（事業者情報・勘定科目・取引先・固定資産等の設定データは復元されません）。
		</p>
		<HelpNote type="warning">
			v0.4.0にアップデートしたら、<strong>真っ先にフルバックアップを作成</strong
			>してください。これにより設定データを含む完全なバックアップを確保できます。
		</HelpNote>
		<p>
			アプリ起動時に、バックアップ仕様変更の通知ダイアログが表示されます。「バックアップを作成する」ボタンからデータ管理ページに直接移動できます。この通知は「以降この通知を表示しない」にチェックを入れると非表示にできます。
		</p>
	</HelpSection>

	<HelpSection title="後方互換">
		<p>
			v0.3.x以前の旧バックアップZIPもインポートできます。旧バックアップはアーカイブリストア（年度の仕訳+証憑のみマージ復元）として処理されます。グローバルデータを含めて完全復元したい場合は、新フォーマットでバックアップを取り直してください。
		</p>
	</HelpSection>

	<HelpSection title="ユースケース">
		<h3 class="mt-4 mb-2 text-sm font-semibold">PC買い替え時の端末移行</h3>
		<p class="text-sm text-muted-foreground">
			旧PCでフルバックアップを作成し、新PCで上書きリストアします。
		</p>
		<div class="my-4 rounded-lg bg-slate-900 p-4">
			<img
				src="{base}/images/help/backup-restore/pc-migration.svg"
				alt="旧PCでフルバックアップを作成し、新PCに転送して全データを上書きリストア"
				class="w-full max-w-2xl"
			/>
		</div>

		<h3 class="mt-4 mb-2 text-sm font-semibold">ブラウザデータ消失からの復旧</h3>
		<div class="my-4 rounded-lg bg-slate-900 p-4">
			<img
				src="{base}/images/help/backup-restore/data-recovery.svg"
				alt="ブラウザデータ消失後のバックアップZIPからの復旧。証憑の保存先を選択して完全復旧"
				class="w-full max-w-2xl"
			/>
		</div>
	</HelpSection>

	<HelpSection title="注意">
		<HelpNote type="warning">
			<p>バックアップは定期的に作成してください。電帳法により証憑は7年間の保存が必要です。</p>
		</HelpNote>
	</HelpSection>
</div>
