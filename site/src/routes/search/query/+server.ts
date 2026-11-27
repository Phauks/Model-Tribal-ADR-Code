/**
 * The site search on the server (src/lib/server/search-tables.ts): the
 * masthead's search panel asks here, as `/search/query?q=<words>`, until the
 * reader's device has the search files. The answer is the panel's: each
 * group's first few results and how many each has, the same for every reader,
 * leaving out what nations chose to hide. When the tables are not ready for
 * this build and these restrictions, the answer is 503 and the panel waits for
 * the files; the tables are filled after answering.
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { json } from '@sveltejs/kit';
import { afterResponse, workerEnvironment } from '#lib/server/environment.ts';
import { fillSearchTables, querySearchTables, searchTablesKey, searchTablesReady } from '#lib/server/search-tables.ts';
import { siteRestrictions } from '#lib/server/site-restrictions.ts';
import { filterSearchIndex, filterSearchRecords, type SiteRestrictions } from '#lib/restricted-files.ts';
import { expandRecords, type SearchRecordsFile } from '#lib/search-records.ts';
import type { SearchEntry } from '#lib/site-search.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

/** Results per group, as the panel shows them (src/lib/components/SiteSearch.svelte). */
const perGroup = 5;

/** The longest search answered; the box has no limit, but nobody types more. */
const longestQuery = 200;

const notReady = () => json({ status: 'not ready' }, { status: 503, headers: { 'cache-control': 'no-store' } });

type Assets = { fetch(request: Request | string): Promise<Response> };

async function builtFile<Value>(assets: Assets, origin: string, path: string): Promise<Value> {
	const response = await assets.fetch(new URL(path, origin).toString());
	if (!response.ok) throw new Error(`${path} answered ${response.status}`);
	return (await response.json()) as Value;
}

/** Fills the tables from the files as readers get them (src/routes/restricted-files). */
async function fill(database: D1Database, assets: Assets, origin: string, key: string, restrictions: SiteRestrictions | undefined): Promise<void> {
	const [index, records] = await Promise.all([builtFile<SearchEntry[]>(assets, origin, '/search/index.json'), builtFile<SearchRecordsFile>(assets, origin, '/search/records.json')]);
	const entries = restrictions ? filterSearchIndex(index, restrictions) : index;
	const recordsFile = restrictions ? filterSearchRecords(records, restrictions) : records;
	await fillSearchTables(database, key, entries, expandRecords(recordsFile));
}

export const GET: RequestHandler = async ({ url }) => {
	const query = (url.searchParams.get('q') ?? '').slice(0, longestQuery);
	const environment = workerEnvironment();
	const database = environment.database;
	const assets = environment.ASSETS;
	if (!database || !assets) return notReady();
	try {
		const built = await assets.fetch(new Request(new URL('/search/index.json', url.origin), { method: 'HEAD' }));
		const version = built.headers.get('etag');
		if (!built.ok || !version) return notReady();
		const restrictions = await siteRestrictions(database, assets, url.origin);
		const key = searchTablesKey(version, restrictions?.stamp);
		if (!(await searchTablesReady(database, key))) {
			afterResponse(fill(database, assets, url.origin, key, restrictions));
			return notReady();
		}
		return json(await querySearchTables(database, query, perGroup), { headers: { 'cache-control': 'public, max-age=0, must-revalidate' } });
	} catch (problem) {
		// Tables not made yet (a migration not applied) or the database busy: the panel waits for the files.
		console.error('The site search on the server could not answer', problem);
		return notReady();
	}
};
