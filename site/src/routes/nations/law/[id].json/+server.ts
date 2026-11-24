import { error, json } from '@sveltejs/kit';
import { lawNations, nationLaw } from '#lib/server/find-the-law.ts';
import type { EntryGenerator, RequestHandler } from './$types';

// One file for each Native nation, which Find the law loads in the browser when the nation is picked. Built with the site.
export const prerender = true;

export const entries: EntryGenerator = () => lawNations().map((record) => ({ id: record.id }));

export const GET: RequestHandler = ({ params }) => {
	const record = lawNations().find((candidate) => candidate.id === params.id);
	if (!record) error(404, 'No nation has this address.');
	return json(nationLaw(record));
};
