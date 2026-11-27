import { redirect } from '@sveltejs/kit';
import { followedPageAddress, pageChangesLink, readFilters } from '#lib/page-history.ts';
import { storageForPages } from '#lib/server/essay-pages.ts';
import { listChanges, pageRecordedSince } from '#lib/server/page-history.ts';
import { builtPages, recordThisBuildOnce } from '#lib/server/page-history-run.ts';
import type { PageServerLoad } from './$types';

// Recent changes, and one page's history with ?page= (site/COLLABORATION.md,
// "Recent changes"). Read from the database on each request. A page still on
// the site shows its own changes in its place, so ?page= sends the reader there.
export const prerender = false;

export const load: PageServerLoad = async ({ url, setHeaders, locals }) => {
	const filters = readFilters(url.searchParams);
	// A page whose changes the site records lists them in its own place (src/lib/server/page-changes.ts).
	if (filters.page && followedPageAddress(filters.page) === filters.page) redirect(308, pageChangesLink(filters.page));
	const { database, bucket } = storageForPages();
	await recordThisBuildOnce(database, bucket);
	const directory = await builtPages();
	const account = locals.account?.subject;
	const list = await listChanges(database, filters, directory, new Date(), account);
	// "Only pages I follow" differs for each reader, so a signed-in reader's list is never shared.
	setHeaders({ 'cache-control': account ? 'private, max-age=0' : 'public, max-age=60' });
	const page = filters.page ? directory.get(filters.page) : undefined;
	const pageTitle = page?.title ?? list.changes.find((change) => change.title)?.title;
	// A page that has not changed since the history began still shows the
	// version readers see, so its history is never an empty list.
	const recordedSince = filters.page && list.changes.length === 0 ? await pageRecordedSince(database, filters.page) : undefined;
	return {
		filters,
		...list,
		signedIn: Boolean(account),
		/** Today in the list's terms, for "Nov. 1 to Nov. 23, 2026". */
		listedAt: new Date().toISOString(),
		pageTitle,
		// The kind of page decides whether earlier wording may be shown, even before its first change.
		pageKind: page?.kind ?? list.changes[0]?.kind,
		recordedSince,
		pageOnSite: Boolean(page) || list.changes.some((change) => change.change !== 'removed' && change.title)
	};
};
