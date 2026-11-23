import { error, json } from '@sveltejs/kit';
import { essaySections, sectionContents } from '#lib/server/section-contents.ts';
import type { RequestHandler } from './$types';

// The published essays of Foundations or Essays, for the sidebar of a page
// built ahead of time, which could not read them from the database when it
// was built (src/lib/server/section-contents.ts). Every other list comes with
// the page itself.
export const prerender = false;

export const GET: RequestHandler = async ({ params }) => {
	if (!essaySections.includes(params.section)) error(404, 'No such section.');
	const items = await sectionContents(params.section);
	if (!items) error(404, 'No such section.');
	return json(items);
};
