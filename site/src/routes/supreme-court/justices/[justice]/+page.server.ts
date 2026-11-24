import { error } from '@sveltejs/kit';
import { justiceKeys, justicePage } from '#lib/server/justice-pages.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () => justiceKeys().map((justice) => ({ justice }));

export const load: PageServerLoad = ({ params }) => {
	const page = justicePage(params.justice);
	if (!page) error(404, 'This site has no page for that Justice.');
	return page;
};
