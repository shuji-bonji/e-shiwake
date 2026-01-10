<script lang="ts">
	import { HelpSection } from '$lib/components/help';

	const pageDescription = '簿記・会計用語集。複式簿記の基本用語を解説。 - e-shiwake ヘルプ';

	const glossaryGroups = [
		{
			title: '基本用語',
			terms: [
				{ term: '仕訳', reading: 'しわけ', description: '取引を借方・貸方に分けて記録すること' },
				{
					term: '借方',
					reading: 'かりかた',
					description: '仕訳の左側。資産の増加、費用の発生を記録'
				},
				{
					term: '貸方',
					reading: 'かしかた',
					description: '仕訳の右側。負債の増加、収益の発生を記録'
				},
				{
					term: '勘定科目',
					reading: 'かんじょうかもく',
					description: '取引を分類するための項目名（現金、売上高など）'
				},
				{
					term: '摘要',
					reading: 'てきよう',
					description: '仕訳の内容を補足するメモ。取引の詳細や目的を記載'
				},
				{
					term: '複式簿記',
					reading: 'ふくしきぼき',
					description: '1つの取引を2つ以上の科目で記録する方式'
				},
				{
					term: '複合仕訳',
					reading: 'ふくごうしわけ',
					description: '3つ以上の勘定科目を使う仕訳'
				},
				{ term: '元帳', reading: 'もとちょう', description: '勘定科目ごとに取引を集めた帳簿' },
				{ term: '試算表', reading: 'しさんひょう', description: '各科目の残高を一覧にした表' }
			]
		},
		{
			title: '勘定科目の分類',
			terms: [
				{
					term: '資産',
					reading: 'しさん',
					description: '所有している財産（現金、預金、売掛金など）'
				},
				{
					term: '負債',
					reading: 'ふさい',
					description: '将来支払う義務（買掛金、未払金、借入金など）'
				},
				{
					term: '純資産',
					reading: 'じゅんしさん',
					description: '資産と負債の差額（元入金、事業主借など）'
				},
				{
					term: '収益',
					reading: 'しゅうえき',
					description: '事業で得た収入（売上高、雑収入など）'
				},
				{
					term: '費用',
					reading: 'ひよう',
					description: '事業にかかった支出（消耗品費、通信費など）'
				}
			]
		},
		{
			title: '決算関連',
			terms: [
				{ term: '決算', reading: 'けっさん', description: '会計期間の締めくくり作業' },
				{
					term: '期首',
					reading: 'きしゅ',
					description: '会計期間の始まり（個人事業主は1月1日）'
				},
				{
					term: '期末',
					reading: 'きまつ',
					description: '会計期間の終わり（個人事業主は12月31日）'
				},
				{ term: '繰越', reading: 'くりこし', description: '残高を翌期に引き継ぐこと' },
				{
					term: '減価償却',
					reading: 'げんかしょうきゃく',
					description: '固定資産の価値を耐用年数にわたって費用化すること'
				},
				{
					term: '棚卸',
					reading: 'たなおろし',
					description: '期末に在庫を数えて金額を確定すること'
				}
			]
		},
		{
			title: '消費税関連',
			terms: [
				{
					term: '課税事業者',
					reading: 'かぜいじぎょうしゃ',
					description: '消費税の納税義務がある事業者'
				},
				{
					term: '免税事業者',
					reading: 'めんぜいじぎょうしゃ',
					description: '売上1,000万円以下で納税義務がない事業者'
				},
				{
					term: 'インボイス',
					reading: '',
					description: '適格請求書。消費税の仕入税額控除に必要な書類'
				},
				{
					term: '税込経理',
					reading: 'ぜいこみけいり',
					description: '消費税を含めた金額で記帳する方式'
				},
				{
					term: '税抜経理',
					reading: 'ぜいぬきけいり',
					description: '消費税を分けて記帳する方式'
				},
				{
					term: '仮払消費税',
					reading: 'かりばらいしょうひぜい',
					description: '支払った消費税を一時的に記録する科目'
				},
				{
					term: '仮受消費税',
					reading: 'かりうけしょうひぜい',
					description: '受け取った消費税を一時的に記録する科目'
				},
				{
					term: '2割特例',
					reading: 'にわりとくれい',
					description: '納付額を売上消費税の20%にできる経過措置（2026年9月まで）'
				},
				{
					term: '簡易課税',
					reading: 'かんいかぜい',
					description: '業種ごとのみなし仕入率で納付額を計算する方式'
				}
			]
		},
		{
			title: '証憑関連',
			terms: [
				{
					term: '証憑',
					reading: 'しょうひょう',
					description: '取引を証明する書類（領収書、請求書、レシートなど）'
				},
				{
					term: '電子帳簿保存法',
					reading: 'でんしちょうぼほぞんほう',
					description: '帳簿・書類の電子保存に関する法律'
				},
				{
					term: '検索要件',
					reading: 'けんさくようけん',
					description: '電子保存した書類を日付・金額・取引先で検索できる要件'
				}
			]
		},
		{
			title: '確定申告関連',
			terms: [
				{
					term: '青色申告',
					reading: 'あおいろしんこく',
					description: '帳簿を備え付けることで税制優遇を受けられる申告方式'
				},
				{
					term: '白色申告',
					reading: 'しろいろしんこく',
					description: '簡易な記帳で行う申告方式'
				},
				{
					term: '事業主借',
					reading: 'じぎょうぬしかり',
					description: 'プライベート資金を事業に入れた時に使う科目'
				},
				{
					term: '事業主貸',
					reading: 'じぎょうぬしかし',
					description: '事業資金をプライベートに使った時に使う科目'
				},
				{ term: '元入金', reading: 'もといれきん', description: '事業の元手。期首の純資産残高' }
			]
		}
	];
</script>

<svelte:head>
	<meta name="description" content={pageDescription} />
	<meta property="og:description" content={pageDescription} />
	<meta name="twitter:description" content={pageDescription} />
</svelte:head>

<div>
	<h1 class="mb-6 text-2xl font-bold">用語集</h1>

	<p class="mb-8 text-muted-foreground">簿記・会計でよく使われる用語の解説です。</p>

	{#each glossaryGroups as group (group.title)}
		<HelpSection title={group.title}>
			<dl class="space-y-3">
				{#each group.terms as { term, reading, description } (term)}
					<div class="border-b pb-3 last:border-b-0">
						<dt class="font-medium">
							{term}
							{#if reading}
								<span class="ml-2 text-sm text-muted-foreground">（{reading}）</span>
							{/if}
						</dt>
						<dd class="mt-1 text-sm text-muted-foreground">{description}</dd>
					</div>
				{/each}
			</dl>
		</HelpSection>
	{/each}
</div>
