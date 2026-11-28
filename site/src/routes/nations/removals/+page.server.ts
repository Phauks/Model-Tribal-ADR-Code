import { treatyMapData } from '#lib/server/land-cessions.ts';
import { removalJourneys, removalSources } from '#lib/server/removals.ts';
import type { PageFamily, PageOutline } from '#lib/site-sections.ts';
import type { PageServerLoad } from './$types';

// The Removals page (/nations/removals): every journey on the shared map, with the kind of move, the timeline and a table, and each journey's own page under it (src/lib/server/removals.ts; Trevor approved the v2 mockups, Nov. 28, 2026).
export const load: PageServerLoad = () => {
	const journeys = removalJourneys();
	// The side column lists the pages beneath this one only (Trevor, Nov. 27, 2026): all the journeys, here; each journey's page adds itself.
	const family: PageFamily = { title: 'Removals', short: 'Removals · Nations', link: '/nations/removals', pages: [{ label: 'All Journeys', link: '/nations/removals', count: journeys.length }] };
	const sources = removalSources();
	// The page's headings, under the pages in the side column.
	const outline: PageOutline = { title: 'Removals', items: [{ label: 'Journeys', link: '#journeys' }, ...(sources.length > 0 ? [{ label: 'References', link: '#sources-heading' }] : [])] };
	return { journeys, sources, map: treatyMapData(), family, outline };
};
