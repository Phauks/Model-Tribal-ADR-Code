import { readFilters } from '#lib/page-history.ts';
import { storageForPages } from '#lib/server/essay-pages.ts';
import { listChanges, pageRecordedSince } from '#lib/server/page-history.ts';
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
	// A page that has not changed since the history began still shows the
	// version readers see, so its history is never an empty list.
	const recordedSince = filters.page && list.changes.length === 0 ? await pageRecordedSince(database, filters.page) : undefined;
	return {
		filters,
		...list,
		pageTitle,
		// The kind of page decides whether earlier wording may be shown, even before its first change.
		pageKind: page?.kind ?? list.changes[0]?.kind,
		recordedSince,
		pageOnSite: Boolean(page) || list.changes.some((change) => change.change !== 'removed' && change.title)
	};
};
