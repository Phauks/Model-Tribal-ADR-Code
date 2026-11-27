/**
 * The site search on the server (src/lib/server/search-tables.ts): the
 * masthead's search panel asks here, as `/search/query?q=<words>`, until the
 * reader's device has the search files. The answer is the panel's: each
 * group's first few results and how many each has, the same for every reader,
 * leaving out what nations chose to hide. When the tables are not ready for
 * this build and these restrictions, the answer is 503 and the panel waits for
 * the files; the tables are filled after answering. A search that finds them
 * ready takes one trip to the database.
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { json } from '@sveltejs/kit';
import { afterResponse, workerEnvironment } from '#lib/server/environment.ts';
import { reportHere } from '#lib/server/report-here.ts';
import { answerWhenReady, fillSearchTables, searchTablesKey } from '#lib/server/search-tables.ts';
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

/**
 * Fills the tables for the restrictions in force. Restrictions that could not
 * be gathered, or that changed while being gathered, fill nothing, so the
 * search waits for the files rather than finding what a nation hid.
 */
async function fillWhenGathered(database: D1Database, assets: Assets, origin: string, version: string, stamp: string | undefined): Promise<void> {
	const restrictions = await siteRestrictions(database, assets, origin);
	if (restrictions?.stamp !== stamp) return;
	await fill(database, assets, origin, searchTablesKey(version, stamp), restrictions);
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
		// One trip to the database: the restrictions' stamp, the tables' key and the search together.
		const outcome = await answerWhenReady(database, version, query, perGroup);
		if (outcome.ready) return json(outcome.answer, { headers: { 'cache-control': 'public, max-age=0, must-revalidate' } });
		afterResponse(fillWhenGathered(database, assets, url.origin, version, outcome.stamp), 'search.fill');
		return notReady();
	} catch (problem) {
		// Tables not made yet (a migration not applied) or the database busy: the panel waits for the files.
		reportHere(problem, { code: 'search.query', place: '/search/query', path: url.pathname, method: 'GET' });
		return notReady();
	}
};
