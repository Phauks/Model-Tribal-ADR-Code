import { cacheForReaders, essayPage } from '#lib/server/essay-pages.ts';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async (event) => {
	const page = await essayPage('back-matter', event.params.slug);
	cacheForReaders(event);
	return page;
};
