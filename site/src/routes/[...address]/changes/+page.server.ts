import { error } from '@sveltejs/kit';
import { pageOfChangesView } from '#lib/page-history.ts';
import { pageChangesView } from '#lib/server/page-changes.ts';
import type { PageServerLoad } from './$types';

// A page's own Changes view, at the page's address with /changes after it
// (src/lib/server/page-changes.ts). Read from the database on each request.
export const prerender = false;

export const load: PageServerLoad = async ({ url, setHeaders, locals, parent }) => {
	const address = pageOfChangesView(url.pathname);
	if (!address) error(404, 'Not found');
	const { family } = await parent();
	return pageChangesView({ address, account: locals.account?.subject, setHeaders, pagesBeside: family });
};
