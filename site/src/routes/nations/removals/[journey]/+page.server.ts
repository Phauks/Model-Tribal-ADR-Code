import { error } from '@sveltejs/kit';
import { treatyMapData } from '#lib/server/land-cessions.ts';
import { removalJourneyPage, removalJourneys } from '#lib/server/removals.ts';
import { journeyYears } from '#lib/removal-journeys.ts';
import type { PageFamily, PageOutline } from '#lib/site-sections.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

// One journey's page (/nations/removals/<journey>): its record of the order, the move and the force, and the nation's own account (src/lib/server/removals.ts; Trevor approved the v2 mockups, Nov. 28, 2026).
export const prerender = true;

export const entries: EntryGenerator = () => removalJourneys().map((journey) => ({ journey: journey.id }));

export const load: PageServerLoad = ({ params }) => {
	const page = removalJourneyPage(params.journey);
	if (!page) error(404, 'No removal has this address.');
	const { journey } = page;
	const link = `/nations/removals/${journey.id}`;
	// The side column lists the pages beneath Removals: all the journeys, and this one (Trevor, Nov. 27, 2026).
	const family: PageFamily = {
		title: 'Removals',
		short: `${journey.people} removal (${journeyYears(journey.years)}) · Removals`,
		link: '/nations/removals',
		pages: [
			{ label: 'All Journeys', link: '/nations/removals', count: page.total },
			{ label: `${journey.people}, ${journeyYears(journey.years)}`, link, current: true }
		]
	};
	// The page's headings, under the pages in the side column.
	const outline: PageOutline = {
		title: `${journey.people} removal (${journeyYears(journey.years)})`,
		items: [
			{ label: 'Key facts', link: '#glance-heading' },
			{ label: 'The order', link: '#the-order' },
			{ label: 'The move', link: '#the-move' },
			{ label: 'The force', link: '#the-force' },
			{ label: 'The nation’s own account', link: '#nations-account' },
			...(page.sources.length > 0 ? [{ label: 'References', link: '#sources-heading' }] : [])
		]
	};
	return { ...page, map: treatyMapData(), family, outline };
};
