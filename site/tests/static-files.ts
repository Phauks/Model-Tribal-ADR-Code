/**
 * A stand-in for the Worker's ASSETS binding: the static files given, by
 * address, as JSON. Any other file under /page-data/ is an empty one, as the
 * build writes every file of a set of spread records even when it holds none
 * (src/lib/built-files.ts). The addresses asked for are kept.
 */
export function staticFiles(files: Record<string, unknown> = {}) {
	const asked: string[] = [];
	return {
		asked,
		async fetch(request: string) {
			const address = new URL(request).pathname;
			asked.push(address);
			if (Object.hasOwn(files, address)) return new Response(typeof files[address] === 'string' ? (files[address] as string) : JSON.stringify(files[address]));
			if (address.startsWith('/page-data/')) return new Response('{}');
			return new Response('Not found', { status: 404 });
		}
	};
}
