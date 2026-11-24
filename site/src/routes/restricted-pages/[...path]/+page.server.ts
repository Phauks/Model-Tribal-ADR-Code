/**
 * A prerendered page drawn again from its built data, without what nations
 * asked the site not to show (src/lib/server/restricted-pages.ts). The hook
 * has already put the page's own address back, so the page's links, data
 * and later moves within the site are those of the page as built.
 */
import { error } from '@sveltejs/kit';
import { workerEnvironment } from '#lib/server/environment.ts';
import { restrictedPage } from '#lib/server/restricted-pages.ts';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ url, setHeaders }) => {
	const environment = workerEnvironment();
	const page = await restrictedPage(url.pathname, environment.ASSETS, environment.database, url.origin);
	if (!page) error(404, 'Not found');
	setHeaders({ 'cache-control': 'no-cache' });
	return { ...page.data, restrictedView: page.view, restrictedParams: page.params };
};
