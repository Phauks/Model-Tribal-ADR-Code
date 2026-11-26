/**
 * The api driver (docs/source-watch.md, "Watchers"): paged JSON with a
 * "since" cursor, as the Federal Register, eCFR, GovInfo and Congress.gov
 * APIs answer. A watcher says how to make the first address, how to read
 * items and the next page from an answer, and what cursor to keep.
 */
import type { CheckContext } from '../watcher.ts';

export interface PagedJsonOptions<Body, Item> {
	firstAddress: string;
	items(body: Body): Item[];
	/** The next page's address, or null. */
	next(body: Body): string | null;
	/** Stop after this many pages in one run; the rest is fetched next run. */
	mostPages: number;
	/** The least spacing between requests to this host, in seconds. */
	spacingSeconds?: number;
}

/** Reads pages of JSON until there is no next page or the page limit is reached. */
export async function readPagedJson<Body, Item>(context: CheckContext, options: PagedJsonOptions<Body, Item>): Promise<{ items: Item[]; more: boolean }> {
	const items: Item[] = [];
	let address: string | null = options.firstAddress;
	let pages = 0;
	while (address && pages < options.mostPages) {
		const { response } = await context.fetch(address, { accept: 'application/json', spacingSeconds: options.spacingSeconds });
		if (!response.ok) {
			await response.body?.cancel();
			throw new Error(`${new URL(address).hostname} answered ${response.status}`);
		}
		const body = (await response.json()) as Body;
		items.push(...options.items(body));
		address = options.next(body);
		pages += 1;
	}
	return { items, more: address !== null };
}
