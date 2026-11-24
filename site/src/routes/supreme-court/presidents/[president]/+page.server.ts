import { error } from '@sveltejs/kit';
import { presidentKeys, presidentPage } from '#lib/server/justice-pages.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () => presidentKeys().map((president) => ({ president }));

export const load: PageServerLoad = ({ params }) => {
	const page = presidentPage(params.president);
	if (!page) error(404, 'This site has no page for that President.');
	return page;
};
