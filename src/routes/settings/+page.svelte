<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { seedTestData2024, initializeDatabase } from '$lib/db';
	import { setAvailableYears } from '$lib/stores/fiscalYear.svelte.js';
	import { getAvailableYears } from '$lib/db';

	let isSeeding = $state(false);
	let seedResult = $state<string | null>(null);

	async function handleSeedData() {
		isSeeding = true;
		seedResult = null;
		try {
			await initializeDatabase();
			const count = await seedTestData2024();
			seedResult = `${count}件の仕訳を追加しました`;
			// 年度リストを更新
			const years = await getAvailableYears();
			setAvailableYears(years);
		} catch (error) {
			seedResult = `エラー: ${error instanceof Error ? error.message : '不明なエラー'}`;
		} finally {
			isSeeding = false;
		}
	}
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold">設定</h1>
		<p class="text-sm text-muted-foreground">アプリケーションの設定を管理します</p>
	</div>

	<!-- 開発用ツール -->
	<Card.Root>
		<Card.Header>
			<Card.Title>開発用ツール</Card.Title>
			<Card.Description>テスト用のデータ操作</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class="flex items-center justify-between">
				<div>
					<p class="font-medium">2024年ダミーデータ</p>
					<p class="text-sm text-muted-foreground">
						テスト用に2024年の仕訳データ14件を追加します
					</p>
				</div>
				<Button onclick={handleSeedData} disabled={isSeeding}>
					{isSeeding ? '追加中...' : 'データを追加'}
				</Button>
			</div>
			{#if seedResult}
				<p class="text-sm text-muted-foreground">{seedResult}</p>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
