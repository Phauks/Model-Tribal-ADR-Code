import { error } from '@sveltejs/kit';
import { groupsOf, letterLinks, nationIndexRows, stateLinks } from '#lib/server/nation-index.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () => stateLinks().map((link) => ({ state: link.key }));

export const load: PageServerLoad = ({ params }) => {
	const state = stateLinks().find((link) => link.key === params.state);
	if (!state) error(404, 'No nation pages list that state.');
	const code = params.state.toLocaleUpperCase('en-US');
	return {
		state,
		letters: letterLinks(),
		groups: groupsOf(nationIndexRows().filter((row) => row.states.includes(code)))
	};
};
