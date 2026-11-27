import { cacheForReaders } from '#lib/server/essay-pages.ts';
import { newsPostPage } from '#lib/server/news-pages.ts';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async (event) => {
	const page = await newsPostPage(event.params.slug);
	cacheForReaders(event);
	return page;
};
