/**
 * One nation's constitutions and laws that a reader can save for offline reading, from the
 * nation's page (src/lib/offline-documents.ts). Built only for nations with copies.
 */
import { error, json } from '@sveltejs/kit';
import { offlineSets } from '#lib/server/copy-lists.ts';
import type { EntryGenerator, RequestHandler } from './$types';

export const prerender = true;

export const entries: EntryGenerator = () => [...offlineSets().nations.keys()].map((id) => ({ id }));

export const GET: RequestHandler = ({ params }) => {
	const list = offlineSets().nations.get(params.id);
	if (!list) error(404, 'This site holds no copies of that nation’s documents.');
	return json(list);
};
