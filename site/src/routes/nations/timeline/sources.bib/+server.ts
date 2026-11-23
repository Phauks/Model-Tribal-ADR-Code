import { bibtexFile } from '#lib/citation-formats.ts';
import { siteTimelineCitationItems } from '#lib/server/timeline.ts';
import type { RequestHandler } from './$types';

// The sources of the full timeline's entries as BibTeX, for LaTeX tools.
export const prerender = true;

export const GET: RequestHandler = () =>
	new Response(bibtexFile(siteTimelineCitationItems()), {
		headers: {
			'content-type': 'application/x-bibtex; charset=utf-8',
			'content-disposition': 'attachment; filename="timeline-sources.bib"'
		}
	});
