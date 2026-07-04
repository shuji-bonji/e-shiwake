<script lang="ts">
	import { base } from '$app/paths';
	import { HelpNote, HelpSection, HelpTable } from '$lib/components/help';

	const pageDescription =
		'AI チャット（LLM アシスタント）の概要、プロバイダ設定、プライバシー、使えるツール一覧。 - e-shiwake ヘルプ';
</script>

<svelte:head>
	<meta name="description" content={pageDescription} />
	<meta property="og:description" content={pageDescription} />
	<meta name="twitter:description" content={pageDescription} />
</svelte:head>

<div>
	<h1 class="mb-6 text-2xl font-bold">AI チャット（LLM アシスタント）</h1>

	<HelpSection title="概要">
		<p>
			e-shiwake には、ユーザー自身が用意した LLM（ローカル LLM またはクラウド
			LLM）に接続して帳簿を自然言語で参照・操作できる AI
			チャット機能があります。画面右下のフローティングボタン、またはサイドバーの「AI チャット」（<code
				>/chat</code
			>）から利用できます。
		</p>
		<p class="mt-2">チャットパネルの表示は画面幅によって変わります。</p>
		<HelpTable
			headers={['画面幅', '表示形式']}
			rows={[
				[
					'デスクトップ（lg 以上）',
					'画面右側にドッキング表示。本体画面が横に縮小し、AI が開いた仕訳フォーム等をチャットと並行して操作できる'
				],
				['モバイル・タブレット', 'オーバーレイ（スライドパネル）表示']
			]}
		/>
	</HelpSection>

	<HelpSection title="できること">
		<ul class="ml-4 list-disc space-y-2">
			<li>仕訳の検索・集計の質問（例: 「今月の経費トップ5は？」「Amazonでの購入履歴を見せて」）</li>
			<li>帳簿の生成と要約（試算表・損益計算書・貸借対照表・消費税集計）</li>
			<li>
				仕訳起票の支援（例: 「サーバー代 3,300円を計上して」→ 仕訳フォームをプリフィルして表示）
			</li>
			<li>ページ移動や検索クエリの設定などの UI 操作</li>
		</ul>
		<p class="mt-2">
			AI の回答は
			Markdown（見出し・リスト・表・コードブロック）として整形表示されます。表示前にサニタイズ処理を行っているため、LLM
			の出力に不正な HTML が含まれていても安全です。
		</p>
		<HelpNote type="info">
			<p>
				仕訳の新規起票は原則、AI がフォームをプリフィルし、ユーザーが内容を確認して確定する
				Human-in-the-Loop
				方式です。仕訳の削除など破壊的な操作は、実行前に必ず承認ダイアログが表示されます。
			</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="プロバイダの設定">
		<p>
			設定ページ（<a href="{base}/settings" class="text-primary underline">設定</a>）の「AI
			アシスタント（LLM プロバイダ）」カードで接続先を追加します。接続先は OpenAI 互換の
			<code>/v1/chat/completions</code> エンドポイントであれば何でも使えます。
		</p>
		<HelpTable
			headers={['プリセット', '接続先例', 'API キー', 'データの扱い']}
			rows={[
				[
					'ローカル LLM（LiteLLM / Ollama / vLLM / llamafile）',
					'http://localhost:4000/v1',
					'不要 or 任意',
					'LAN の外に出ない（推奨）'
				],
				['OpenAI', 'https://api.openai.com/v1', '必須', '外部送信あり'],
				['Anthropic', 'https://api.anthropic.com/v1', '必須', '外部送信あり'],
				[
					'Google Gemini',
					'https://generativelanguage.googleapis.com/v1beta/openai',
					'必須',
					'外部送信あり'
				],
				['xAI Grok', 'https://api.x.ai/v1', '必須', '外部送信あり'],
				['カスタム（OpenAI 互換）', '任意（企業 VPC 内の LiteLLM 等）', '任意', '接続先に依存']
			]}
		/>
		<p class="mt-2">
			複数のプロバイダを登録し、ラジオボタンで使用するものを切り替えられます。「疎通テスト」ボタンで接続確認ができます。
		</p>
		<HelpNote type="warning">
			<p>
				クラウド LLM を選択した場合、チャット中に参照した<strong
					>帳簿データ（仕訳・金額・取引先など）が外部プロバイダに送信されます</strong
				>。データを外部に出したくない場合はローカル LLM を利用してください。
			</p>
		</HelpNote>
		<h3 class="mt-4 mb-2 font-medium">ローカル LLM の CORS 設定</h3>
		<p>
			ブラウザから直接 LLM サーバーを呼び出すため、ローカル LLM 側で e-shiwake のオリジン（<code
				>https://shuji-bonji.github.io</code
			> など）からの CORS を許可する必要があります。LiteLLM や Ollama の設定でオリジン許可を行ってください。
		</p>
	</HelpSection>

	<HelpSection title="プライバシーとセキュリティ">
		<ul class="ml-4 list-disc space-y-2">
			<li>
				API
				キーと会話履歴は、この端末のブラウザ内（IndexedDB）にのみ保存され、外部サーバーには保存されません。
			</li>
			<li>
				本アプリはサードパーティスクリプトを含まない静的 PWA のため、ブラウザ保存の API
				キーが第三者スクリプトから読み取られるリスクは低い構成です。
			</li>
			<li>
				企業利用では、クラウドの API キーを VPC 内の LiteLLM
				等に集約し、ブラウザにはキーを置かない構成（接続先 URL を LiteLLM に向けるだけ）も可能です。
			</li>
		</ul>
	</HelpSection>

	<HelpSection title="機能別の AI 実行可否">
		<p>
			各機能に対して AI（チャット）ができる操作の一覧です。凡例: ○ = 可、△ =
			フォーム表示まで（確定はユーザー / Human-in-the-Loop）、× = 不可（手動操作のみ）、− = 対象外。
		</p>
		<HelpTable
			headers={['機能', '参照・集計', '作成', '更新', '削除']}
			rows={[
				[
					'仕訳',
					'○ 検索・年度別取得',
					'△ フォーム起票（推奨）/ ○ 直接作成',
					'×',
					'○ 要承認（承認ダイアログ or 削除確認 UI）'
				],
				['勘定科目', '○ 一覧・種別フィルタ', '×', '×', '×'],
				['取引先', '○ 一覧・名前検索', '○ 間接（仕訳保存時に自動登録）', '×', '×'],
				['総勘定元帳', '○ 生成', '−', '−', '−'],
				['試算表・損益計算書・貸借対照表', '○ 生成', '−', '−', '−'],
				['消費税集計', '○ 計算', '−', '−', '−'],
				['請求書', '×', '△ ドラフト作成（フォーム表示まで）', '×', '×'],
				['固定資産台帳', '×', '×', '×', '×'],
				['青色申告決算書', '×', '×', '×', '×'],
				['バックアップ・エクスポート・アーカイブ', '×', '×', '×', '×'],
				['証憑（PDF 添付）', '×', '×', '×', '×'],
				['ページ移動・仕訳帳の検索ボックス操作', '○', '−', '−', '−']
			]}
		/>
		<HelpNote type="info">
			<p>
				取引先の「間接作成」は、仕訳に未登録の取引先名を付けて保存すると自動登録される仕様によるものです。AI
				の <code>create_journal</code
				>（直接作成）でも、フォーム起票後にユーザーが確定した場合でも同様に登録されます。取引先専用の追加・編集・削除ツールはありません。
			</p>
		</HelpNote>
		<HelpNote type="info">
			<p>
				×の機能は今後のツール追加で拡張される可能性があります（例:
				勘定科目の追加、仕訳の更新）。データを壊しうる操作ほど慎重に開放する方針です。
			</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="チャットで使えるツール">
		<p>
			チャットの AI は、WebMCP と同じツール定義（データ操作型 12 + UI 操作型 5 の計 17
			ツール）を利用します。各ツールの詳細は
			<a href="{base}/help/webmcp" class="text-primary underline">WebMCP ヘルプ</a>
			を参照してください。
		</p>
		<HelpTable
			headers={['分類', 'ツール例']}
			rows={[
				['仕訳管理', 'search_journals, get_journals_by_year, create_journal, delete_journal'],
				['マスタ参照', 'list_accounts, list_vendors'],
				[
					'帳簿生成',
					'generate_ledger, generate_trial_balance, generate_profit_loss, generate_balance_sheet'
				],
				['税務', 'calculate_consumption_tax'],
				[
					'UI 操作',
					'navigate_to, open_journal_editor, set_search_query, confirm_delete_journal, open_invoice_editor'
				]
			]}
		/>
		<HelpNote type="info">
			<p>
				<code>delete_journal</code
				>（仕訳の直接削除）だけは実行前に承認ダイアログでユーザーの許可を求めます。<code
					>confirm_delete_journal</code
				>
				は元々削除確認 UI を表示するツールのため、二重の承認は行いません。
			</p>
		</HelpNote>
		<h3 class="mt-4 mb-2 font-medium">ツール実行カードの状態表示</h3>
		<p>
			AI がツールを実行すると、チャット内にツール名のカードが表示されます。右端のバッジは 3
			状態です。
		</p>
		<HelpTable
			headers={['バッジ', '意味']}
			rows={[
				['実行中…', 'ツール呼び出しを発行し、実行結果待ち'],
				['完了（緑）', 'ツールの実行が成功した'],
				['エラー（赤）', 'ツールの実行が失敗した（バリデーションエラー等）']
			]}
		/>
		<p class="mt-2">
			カードをクリックすると展開され、「引数」（AI が渡した JSON）と「結果」（AI
			に返された実行結果）を確認できます。
		</p>
		<HelpNote type="info">
			<p>
				<code>open_journal_editor</code>
				の「完了」は<strong>フォームを開いてプリフィルするところまで成功した</strong
				>という意味で、仕訳が保存されたわけではありません。保存はユーザーが確定ボタンを押した時点で行われます（Human-in-the-Loop）。一方、<code
					>create_journal</code
				>
				の「完了」は仕訳が実際に保存済みであることを意味します。
			</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="会話履歴">
		<ul class="ml-4 list-disc space-y-2">
			<li>会話履歴はこの端末の IndexedDB に自動保存され、アプリを閉じても継続されます。</li>
			<li>入力欄横の消しゴムボタンで会話をクリアできます。</li>
			<li>フローティングパネルと全画面（<code>/chat</code>）は同じ会話を共有しています。</li>
		</ul>
		<h3 class="mt-4 mb-2 font-medium">メッセージアクション（再実行・コピー・編集）</h3>
		<p>送信済みのユーザーメッセージの下に 3 つのアクションボタンが表示されます。</p>
		<HelpTable
			headers={['ボタン', '動作']}
			rows={[
				['再実行', '同じ内容をもう一度送信する'],
				['コピー', 'メッセージ内容をクリップボードにコピーする'],
				['編集して再送信', 'メッセージ内容を入力欄に読み込み、編集してから送信できる']
			]}
		/>
		<HelpNote type="tip">
			<p>
				初回接続時に macOS
				の「ローカルネットワーク接続の許可」ダイアログ等で送信が失敗した場合は、許可した後に「再実行」を押せば同じ内容を入力し直さずに再送できます。
			</p>
		</HelpNote>
	</HelpSection>

	<HelpSection title="WebMCP との違い">
		<HelpTable
			headers={['項目', 'AI チャット（本機能）', 'WebMCP']}
			rows={[
				['動作環境', 'すべてのブラウザ（iPad Safari 含む）', 'Chrome 146+（フラグ設定が必要）'],
				['AI の提供元', 'ユーザーが設定した LLM', 'ブラウザ側の AI エージェント'],
				['ツール定義', '共通（同じ 17 ツール）', '共通（同じ 17 ツール）']
			]}
		/>
	</HelpSection>

	<HelpSection title="トラブルシューティング">
		<HelpTable
			headers={['症状', '対処']}
			rows={[
				['「接続に失敗しました」', '接続先 URL の到達性と、LLM サーバー側の CORS 設定を確認'],
				['「HTTP 401」', 'API キーが正しいか確認'],
				[
					'ツールを正しく呼べない・見当違いの操作をする',
					'モデルの tool calling 精度に依存します。より高性能なモデルへの切り替えを検討'
				],
				['応答が途中で止まる', '入力欄横の停止ボタンで中断し、再送信']
			]}
		/>
	</HelpSection>
</div>
