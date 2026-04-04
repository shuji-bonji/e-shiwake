import content from '../content.md?raw';

export const prerender = true;

// UTF-8 BOM（バイトオーダーマーク）- 静的ファイルサーバーでの文字化け対策
const UTF8_BOM = '\uFEFF';

export function GET() {
	return new Response(UTF8_BOM + content, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8'
		}
	});
}
