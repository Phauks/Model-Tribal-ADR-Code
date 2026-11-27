/**
 * A Federal collection browsed with filters in the side column and a grouped
 * table, such as the executive orders (src/lib/collection-browser.ts; Trevor,
 * Nov. 27, 2026, design/federal-navigation/mockups/C2-*.png). The collection
 * is worked out when the site is built (src/lib/server/browse-collections.ts);
 * the Worker applies the reader's choices from the address.
 */
import { browseView, filterColumn, type BrowseCollection } from '#lib/collection-browser.ts';
import { builtPageData } from '#lib/server/page-data.ts';
import type { PageFamily } from '#lib/site-sections.ts';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ params, url }) => {
	const collection = await builtPageData<BrowseCollection>('collections', params.collection, url);
	const view = browseView(collection, url.searchParams);
	// The side column moves only within the collection, with no link back up to what the section bar already shows (Trevor, Nov. 27, 2026: "left nav becomes navigation for pages beneath, it should not be double nav for what is already in the top nav").
	const family: PageFamily = { title: collection.title, pages: [], filters: filterColumn(view) };
	return { view, section: collection.section, family };
};
