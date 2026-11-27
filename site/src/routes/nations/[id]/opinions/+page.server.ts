/**
 * Every court opinion of one nation that the site shows (decision record
 * 0047), as a table: src/lib/server/tribal-court-opinions.ts.
 */
import { error } from '@sveltejs/kit';
import { displayName } from '#lib/nation-labels.ts';
import { nationFamily } from '#lib/nation-family.ts';
import { nations } from '#lib/server/content.ts';
import { nationsWithOpinions, opinionsOf } from '#lib/server/tribal-court-opinions.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () => {
	const listed = new Set(nations().filter((record) => record.review?.status !== 'withdrawn-at-request').map((record) => record.id));
	return nationsWithOpinions()
		.filter((id) => listed.has(id))
		.map((id) => ({ id }));
};

export const load: PageServerLoad = ({ params }) => {
	const record = nations().find((candidate) => candidate.id === params.id);
	const opinions = opinionsOf(params.id);
	if (!record || record.review?.status === 'withdrawn-at-request' || opinions.length === 0) {
		error(404, 'This nation has no court opinions listed.');
	}
	const name = displayName(record.names.official);
	// The side column lists the nation's own pages, with this one marked (SiteSidebar.svelte).
	return { nation: { id: record.id, name }, opinions, family: nationFamily(record.id, name, opinions.length) };
};
