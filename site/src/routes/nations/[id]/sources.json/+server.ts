import { error, json } from '@sveltejs/kit';
import { nations } from '#lib/server/content.ts';
import { nationCitationItems } from '#lib/server/nation-citations.ts';
import type { EntryGenerator, RequestHandler } from './$types';

// The sources one nation's page cites, as Citation Style Language JSON, for
// the Download menu on its page (src/lib/page-downloads.ts). Zotero and other
// citation managers import this format. The same sources come as RIS and
// BibTeX beside it (src/lib/server/nation-citations.ts).
export const prerender = true;

export const entries: EntryGenerator = () => nations().map((record) => ({ id: record.id }));

export const GET: RequestHandler = ({ params }) => {
	const items = nationCitationItems(params.id);
	if (!items) error(404, 'No published record has that identifier.');
	return json(items, {
		headers: { 'content-disposition': `attachment; filename="${params.id}-sources.json"` }
	});
};
