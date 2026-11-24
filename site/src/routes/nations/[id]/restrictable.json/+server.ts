/**
 * The things on a nation's page that the nation can restrict, built with the
 * site (src/lib/server/nation-restriction-items.ts). The nation's team page
 * "Laws and cases" lists them, and the Worker reads them to apply the
 * nation's choices to its page. It holds only what the page already shows.
 */
import { error, json } from '@sveltejs/kit';
import { nations } from '#lib/server/content.ts';
import { restrictableItems } from '#lib/server/nation-restriction-items.ts';
import type { EntryGenerator, RequestHandler } from './$types';

export const prerender = true;

export const entries: EntryGenerator = () => nations().map((record) => ({ id: record.id }));

export const GET: RequestHandler = ({ params }) => {
	if (!nations().some((record) => record.id === params.id)) error(404, 'No published record has that identifier.');
	return json(restrictableItems(params.id));
};
