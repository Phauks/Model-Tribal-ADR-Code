import { error } from '@sveltejs/kit';
import { groupsOf, letterLinks, nationIndexRows } from '#lib/server/nation-index.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () =>
	letterLinks()
		.filter((link) => link.count > 0)
		.map((link) => ({ letter: link.key }));

export const load: PageServerLoad = ({ params }) => {
	const letters = letterLinks();
	const index = letters.findIndex((link) => link.key === params.letter && link.count > 0);
	if (index === -1) error(404, 'No nation pages start with that letter.');
	const withPages = letters.filter((link) => link.count > 0);
	const position = withPages.findIndex((link) => link.key === params.letter);
	return {
		letter: letters[index],
		letters,
		previous: withPages[position - 1],
		next: withPages[position + 1],
		groups: groupsOf(nationIndexRows().filter((row) => row.letter === params.letter))
	};
};
