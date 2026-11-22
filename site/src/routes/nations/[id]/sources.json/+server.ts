import { error, json } from '@sveltejs/kit';
import { nations, sources } from '#lib/server/content.ts';
import { sourceKeys } from '#lib/server/source-keys.ts';
import type { EntryGenerator, RequestHandler } from './$types';

// The sources one nation's page cites, as Citation Style Language JSON, for
// the Download menu on its page (src/lib/page-downloads.ts). Zotero and other
// citation managers import this format. Each entry is the citation data from
// the source's record in content/sources, with the record's key as its id.
export const prerender = true;

export const entries: EntryGenerator = () => nations().map((record) => ({ id: record.id }));

export const GET: RequestHandler = ({ params }) => {
	const record = nations().find((candidate) => candidate.id === params.id);
	if (!record) error(404, 'No published record has that identifier.');
	// A withdrawn page shows only its name and status, so it lists no sources.
	const withdrawn = record.review?.status === 'withdrawn-at-request';
	const records = sources();
	const items = withdrawn
		? []
		: [...sourceKeys(record)]
				.sort()
				.flatMap((key) => {
					const source = records.get(key);
					return source ? [{ id: key, ...source.citation }] : [];
				});
	return json(items, {
		headers: { 'content-disposition': `attachment; filename="${record.id}-sources.json"` }
	});
};
