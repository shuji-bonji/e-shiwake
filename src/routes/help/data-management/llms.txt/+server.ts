import content from '../content.md?raw';

export const prerender = true;

export function GET() {
	return new Response(content, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8'
		}
	});
}
