import { redirect } from '@sveltejs/kit';
import { browseCollectionOfKind } from '#lib/browse-identifiers.ts';
import { crumbOf, itemFilterColumn, itemPlace, type BrowseCollection, type ItemPlace } from '#lib/collection-browser.ts';
import type { LawMoved, LawPage } from '#lib/server/law-pages.ts';
import { builtPageData } from '#lib/server/page-data.ts';
import type { PageFamily } from '#lib/site-sections.ts';
import type { PageServerLoad } from './$types';

// Drawn by the Worker when a reader opens it, from the page's data as built
// (src/lib/server/page-data.ts, src/routes/page-data).
export const prerender = false;

/** Where a browsed collection's item sits: the list it was found in, for its trail, its previous and next, and the side column. */
export interface LawPlace {
	collection: { title: string; path: string; crumb: string };
	section: { label: string; href: string };
	place: ItemPlace;
}

export const load: PageServerLoad = async ({ params, url }) => {
	const data = await builtPageData<LawPage | LawMoved>('laws', params.key, url);
	// A record of a single Title 25 section: every section has its own page now (src/lib/server/code-outline.ts).
	if ('movedTo' in data) redirect(308, data.movedTo);
	const law: LawPage = data;
	const identifier = browseCollectionOfKind(law.kind);
	if (!identifier) return { ...law, browsed: undefined };
	// An executive order's page follows the list the reader came from, or its President's orders (Trevor, Nov. 27, 2026, mockup C2-order).
	const collection = await builtPageData<BrowseCollection>('collections', identifier, url);
	const place = itemPlace(collection, params.key, url.searchParams);
	if (!place) return { ...law, browsed: undefined };
	const family: PageFamily = {
		// No link back up to the collection, which the section bar's menu and the trail already give (Trevor, Nov. 27, 2026); the list's name links to the list only when it is a part of the collection, such as one President's orders.
		title: place.label,
		link: place.focus ? place.href : undefined,
		pages: place.nearby.map((item) => ({ number: item.number, label: item.label, link: item.link })),
		filters: itemFilterColumn(collection)
	};
	const browsed: LawPlace = { collection: { title: collection.title, path: collection.path, crumb: crumbOf(collection.title) }, section: { label: collection.section.label, href: collection.section.href }, place };
	return { ...law, browsed: browsed as LawPlace | undefined, family };
};
