import { error } from '@sveltejs/kit';
import { bibtexFile } from '#lib/citation-formats.ts';
import { nations } from '#lib/server/content.ts';
import { nationCitationItems } from '#lib/server/nation-citations.ts';
import type { EntryGenerator, RequestHandler } from './$types';

// The sources one nation's page cites, as BibTeX for LaTeX tools (src/lib/citation-formats.ts).
// Trevor asked for it on Nov. 23, 2026.
export const prerender = true;

export const entries: EntryGenerator = () => nations().map((record) => ({ id: record.id }));

export const GET: RequestHandler = ({ params }) => {
	const items = nationCitationItems(params.id);
	if (!items) error(404, 'No published record has that identifier.');
	return new Response(bibtexFile(items), {
		headers: {
			'content-type': 'application/x-bibtex; charset=utf-8',
			'content-disposition': `attachment; filename="${params.id}-sources.bib"`
		}
	});
};
