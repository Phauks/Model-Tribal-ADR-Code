import { readFilters } from '#lib/page-history.ts';
import { storageForPages } from '#lib/server/essay-pages.ts';
import { listChanges } from '#lib/server/page-history.ts';
import { builtPages, recordThisBuildOnce } from '#lib/server/page-history-run.ts';
import type { PageServerLoad } from './$types';

// Recent changes, and one page's history with ?page= (site/COLLABORATION.md,
// "Recent changes"). Read from the database on each request.
export const prerender = false;

export const load: PageServerLoad = async ({ url, setHeaders }) => {
	const { database, bucket } = storageForPages();
	await recordThisBuildOnce(database, bucket);
	const filters = readFilters(url.searchParams);
	const directory = await builtPages();
	const list = await listChanges(database, filters, directory);
	setHeaders({ 'cache-control': 'public, max-age=60' });
	const page = filters.page ? directory.get(filters.page) : undefined;
	const pageTitle = page?.title ?? list.changes.find((change) => change.title)?.title;
	return {
		filters,
		...list,
		pageTitle,
		pageOnSite: Boolean(page) || list.changes.some((change) => change.change !== 'removed' && change.title)
	};
};
