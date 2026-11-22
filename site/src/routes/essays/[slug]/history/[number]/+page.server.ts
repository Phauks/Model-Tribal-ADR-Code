import { error } from '@sveltejs/kit';
import { essayPage } from '#lib/server/essay-pages.ts';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = ({ params }) => {
	const number = Number(params.number);
	if (!Number.isInteger(number) || number < 1) error(404, 'No publication of this essay has this number.');
	return essayPage('essays', params.slug, number);
};
