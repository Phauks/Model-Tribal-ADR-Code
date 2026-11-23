import { libraryOutline } from '#lib/library-pages.ts';
import { essayIndex } from '#lib/server/essay-pages.ts';
import type { PageServerLoad } from './$types';

// Rendered on request: essays live in the private bucket (docs/editing.md).
export const prerender = false;

// Back matter is part of the Library, so the sidebar lists the Library's pages
// with the back matter pages under their entry.
export const load: PageServerLoad = async () => {
	const index = await essayIndex('back-matter');
	return { ...index, outline: { items: libraryOutline({ '/back-matter': index.outline.items }) } };
};
