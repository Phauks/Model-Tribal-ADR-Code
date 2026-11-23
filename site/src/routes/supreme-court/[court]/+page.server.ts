import { error } from '@sveltejs/kit';
import { courtPage, courtsWithPages } from '#lib/server/supreme-court-pages.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () => courtsWithPages().map((court) => ({ court: court.key }));

export const load: PageServerLoad = ({ params }) => {
	const page = courtPage(params.court);
	if (!page) error(404, 'This site has no page for that Court.');
	return page;
};
