import { error, json } from '@sveltejs/kit';
import { builtSections, sectionContents } from '#lib/server/section-contents.ts';
import type { EntryGenerator, RequestHandler } from './$types';

// The pages inside one section, fetched by the sidebar when a reader opens a
// section they are not in (src/lib/server/section-contents.ts). Lists known
// when the site is built are files; the essays' lists are read on request.
export const prerender = 'auto';

export const entries: EntryGenerator = () => builtSections.map((section) => ({ section }));

export const GET: RequestHandler = async ({ params }) => {
	const items = await sectionContents(params.section);
	if (!items) error(404, 'No such section.');
	return json(items);
};
