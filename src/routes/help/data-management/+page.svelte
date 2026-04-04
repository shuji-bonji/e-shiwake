<script lang="ts">
	import { base } from '$app/paths';
	import { HelpSection, HelpNote, HelpTable } from '$lib/components/help';

	const pageDescription =
		'設定とデータ管理の概要。証憑保存設定、ストレージ管理、3層データ管理。 - e-shiwake ヘルプ';
</script>

<svelte:head>
	<meta name="description" content={pageDescription} />
	<meta property="og:description" content={pageDescription} />
	<meta name="twitter:description" content={pageDescription} />
</svelte:head>

<div>
	<h1 class="mb-6 text-2xl font-bold">設定・データ管理</h1>

	<p class="mb-8 text-muted-foreground">
		e-shiwakeでは「設定」と「データ管理」を別ページに分けています。
	</p>

	<HelpTable
		headers={['ページ', '場所', '内容']}
		rows={[
			[
				'設定（/settings）',
				'サイドバー「設定」→「設定」',
				'事業者情報・証憑保存先・ストレージ容量'
			],
			['データ管理（/data）', 'サイドバー「データ管理」', 'バックアップ・リストア / エクスポート']
		]}
	/>

	<h2 class="mt-10 mb-6 text-xl font-bold">設定ページ（/settings）</h2>

	<HelpSection title="事業者情報">
		<p>青色申告決算書に使用する事業者情報（氏名・屋号・住所等）を登録します。</p>
	</HelpSection>

	<HelpSection title="証憑保存設定（年度別）">
		<p>
			証憑PDFの保存先を<strong>年度ごと</strong
			>に設定できます。同じ端末内でも年度によって保存先を使い分けられます。
		</p>
		<HelpTable
			headers={['保存先', '対応ブラウザ', '特徴']}
			rows={[
				['ローカルフォルダ', 'Chrome, Edge', 'ファイルとして直接保存。ブラウザ容量を消費しない'],
				['ブラウザ内', 'すべて', 'IndexedDBに保存。Safari/Firefox対応。エクスポートで取り出し可能']
			]}
		/>
		<HelpNote type="info">
			<p>
				デフォルトの保存先はブラウザの対応状況で自動判定されます。Chrome/Edgeでは「ローカルフォルダ」、Safari/Firefoxでは「ブラウザ内」が既定値です。
			</p>
		</HelpNote>

		<h3 class="mt-6 mb-2 text-sm font-semibold">年度別の保存先切替</h3>
		<p>
			設定ページの「年度別の証憑保存先」で、各年度の保存先をローカルフォルダ⇔ブラウザ内に切り替えられます。切替時には該当年度の証憑PDFが自動的に移行（マイグレーション）されます。
		</p>
		<ul class="mt-2 ml-4 list-disc space-y-1">
			<li>ローカル→ブラウザ: ファイルをIndexedDBに取り込み、ローカルファイルを削除</li>
			<li>ブラウザ→ローカル: IndexedDBからファイルとして書き出し、Blobを削除</li>
		</ul>
		<p class="mt-2">移行は確認ダイアログの後に実行され、進捗バーで状況を確認できます。</p>
		<HelpNote type="tip">
			<p>リストア時に選択した保存先も年度別の設定として自動保存されます。</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="フォルダ設定の注意">
		<p>
			ローカル保存モードでは、保存先フォルダの指定が必要です。
			フォルダが未設定の場合、証憑PDFの参照・保存ができません。
		</p>

		<p class="mt-4">以下の場合にフォルダ設定が失われることがあります:</p>
		<ul class="ml-4 list-disc space-y-1">
			<li>別の端末やブラウザでデータをインポートした場合</li>
			<li>ブラウザのデータが初期化された場合</li>
		</ul>

		<p class="mt-4">この場合、同じフォルダを再選択すれば証憑へのアクセスが復活します。</p>

		<HelpNote type="warning">
			<p>
				フォルダ設定をクリアすると、ローカルフォルダ内の証憑PDFへのリンクが切れます。証憑ファイル自体はフォルダに残りますが、仕訳との紐付けが失われます。
			</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="データの保存場所">
		<p>
			e-shiwakeのデータは、ブラウザ内のIndexedDBに保存されます。
			サーバーへのデータ送信は行いません。
		</p>
		<HelpTable
			headers={['データ', '保存先']}
			rows={[
				['仕訳メタデータ', 'IndexedDB（共通）'],
				['証憑PDF（実体）', 'IndexedDB または ローカルフォルダ（設定に依存）'],
				['勘定科目・設定等', 'IndexedDB（共通）']
			]}
		/>
		<HelpNote type="warning">
			<p>
				ブラウザのデータ消去やシークレットモードでは、データが失われる可能性があります。定期的なバックアップをお勧めします。
			</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="ストレージ使用量">
		<p>
			ブラウザ内（IndexedDB）に証憑を保存している場合、ストレージ容量を消費します。設定ページでは現在の使用量と推定上限が確認できます。
		</p>
		<p class="mt-2">
			この情報は主に、Safari/Firefoxなど容量上限が厳しい環境で、ブラウザ内保存を使用している場合の容量管理に役立ちます。
		</p>
		<HelpTable
			headers={['ブラウザ', '容量目安']}
			rows={[
				['Chrome / Edge', 'ディスク空き容量の約80%'],
				['Safari', '約1GB'],
				['Firefox', 'ディスク空き容量の約50%']
			]}
		/>

		<h3 class="mt-6 mb-2 text-sm font-semibold">証憑ダウンロード（Blob Purge）</h3>
		<p>
			ブラウザ内保存モードで容量が逼迫した場合に、証憑PDFを個別にダウンロードしてIndexedDB上のBlobを削除する機能です。Safari等の容量制限が厳しい環境での応急措置として用意されています。
		</p>
		<p class="mt-2">通常の証憑管理には以下の方法が適しています:</p>
		<ul class="mt-1 ml-4 list-disc space-y-1">
			<li>個別のPDF確認: 仕訳のPDFリンクからダウンロード</li>
			<li>一括保存: バックアップ（ZIP形式で全データ+証憑を保存）</li>
			<li>年度末: アーカイブ（帳簿レポート+証憑+検索HTMLを一括保存）</li>
			<li>容量回復: ローカルフォルダ保存への切替（年度別に設定可能）</li>
		</ul>
		<HelpNote type="tip">
			<p>
				Chrome/Edgeでは年度別の保存先をローカルフォルダに切り替えることで、ブラウザ容量を消費せずに証憑を保存できます。確定申告後はアーカイブを作成してから年度データを削除する方法もあります。
			</p>
		</HelpNote>
	</HelpSection>

	<h2 class="mt-10 mb-6 text-xl font-bold">データ管理ページ（/data）</h2>

	<HelpSection title="データ管理の2層構造">
		<p>データ管理は以下の2層で構成されています。</p>
		<HelpTable
			headers={['層', '形式', '対象', '用途']}
			rows={[
				['バックアップ・リストア', 'ZIP', '全データ＋証憑PDF', '端末移行・事故対策'],
				[
					'エクスポート',
					'JSON / CSV',
					'仕訳データ（証憑なし）',
					'Excel確認・他ソフト連携・外部保存'
				]
			]}
		/>
		<p class="mt-4">これに加えて、年度末の長期保存用にアーカイブ機能（/archive）があります。</p>
		<HelpTable
			headers={['機能', '形式', '内容']}
			rows={[['アーカイブ', 'ZIP', '仕訳＋証憑＋帳簿レポート＋検索HTML']]}
		/>
		<HelpNote type="tip">
			<p>
				通常のデータ保全にはバックアップを、確定申告後の年度締めにはアーカイブを使い分けてください。詳細は各ヘルプページをご覧ください。
			</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="関連ヘルプ">
		<ul class="ml-4 list-disc space-y-1">
			<li>
				<a href="{base}/help/backup-restore" class="text-primary hover:underline"
					>バックアップ・リストア</a
				> — 全データのZIP保存と復元
			</li>
			<li>
				<a href="{base}/help/import-export" class="text-primary hover:underline">エクスポート</a> — CSV/JSONでのデータ出力
			</li>
			<li>
				<a href="{base}/help/archive" class="text-primary hover:underline"
					>検索機能付アーカイブ保存</a
				> — 年度末の帳簿セット保存
			</li>
		</ul>
	</HelpSection>
</div>
