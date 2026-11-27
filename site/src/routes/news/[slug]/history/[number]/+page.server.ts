import { error } from '@sveltejs/kit';
import { cacheForReaders } from '#lib/server/essay-pages.ts';
import { newsPostPage } from '#lib/server/news-pages.ts';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async (event) => {
	const number = Number(event.params.number);
	if (!Number.isInteger(number) || number < 1) error(404, 'No publication of this post has this number.');
	const page = await newsPostPage(event.params.slug, number);
	cacheForReaders(event);
	return page;
};
