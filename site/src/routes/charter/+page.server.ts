import { error } from '@sveltejs/kit';
import { projectDocumentPage } from '#lib/server/project-documents.ts';
import type { PageServerLoad } from './$types';

// The charter, docs/charter.md, as a page (site/DESIGN.md, section 6, "Links stay on the site").
export const load: PageServerLoad = () => {
	const page = projectDocumentPage('/charter');
	if (!page) error(404, 'The charter is missing from docs/.');
	return page;
};
