import { error } from '@sveltejs/kit';
import { projectDocumentPage } from '#lib/server/project-documents.ts';
import type { PageServerLoad } from './$types';

// LICENSE.md, the licenses by material, as a page; each license text has its own page below it.
export const load: PageServerLoad = () => {
	const page = projectDocumentPage('/licenses');
	if (!page) error(404, 'LICENSE.md is missing.');
	return page;
};
