import { risFile } from '#lib/citation-formats.ts';
import { siteTimelineCitationItems } from '#lib/server/timeline.ts';
import type { RequestHandler } from './$types';

// The sources of the full timeline's entries as RIS, for EndNote, Mendeley and other citation managers.
export const prerender = true;

export const GET: RequestHandler = () =>
	new Response(risFile(siteTimelineCitationItems()), {
		headers: {
			'content-type': 'application/x-research-info-systems; charset=utf-8',
			'content-disposition': 'attachment; filename="timeline-sources.ris"'
		}
	});
