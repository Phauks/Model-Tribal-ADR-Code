/**
 * Every copy this site serves, as a CSV file: its address here, the address it
 * was published at, the date it was made, its size and SHA-256, so anyone can
 * check a copy against the original (src/lib/server/copy-lists.ts).
 */
import { allCopyRows } from '#lib/server/copy-lists.ts';

export const prerender = true;

function field(value: string | number): string {
	const text = String(value);
	return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function GET(): Response {
	const header = ['title', 'nations', 'copy', 'published_at', 'captured', 'bytes', 'sha256'];
	const lines = allCopyRows().map((copy) =>
		[copy.title, copy.nations.join('; '), copy.path, copy.original, copy.captured, copy.bytes, copy.sha256]
			.map(field)
			.join(',')
	);
	return new Response(`${[header.join(','), ...lines].join('\n')}\n`, {
		headers: { 'Content-Type': 'text/csv; charset=utf-8' }
	});
}
