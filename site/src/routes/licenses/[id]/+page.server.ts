import { error } from '@sveltejs/kit';
import { projectDocumentPage, projectDocuments } from '#lib/server/project-documents.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

// The full text of each license in LICENSES/.
export const entries: EntryGenerator = () =>
	projectDocuments()
		.filter((document) => document.address.startsWith('/licenses/'))
		.map((document) => ({ id: document.address.slice('/licenses/'.length) }));

export const load: PageServerLoad = ({ params }) => {
	const page = projectDocumentPage(`/licenses/${params.id}`);
	if (!page) error(404, 'No license text has this address.');
	return page;
};
