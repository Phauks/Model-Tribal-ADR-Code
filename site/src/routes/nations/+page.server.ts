import { nations } from '#lib/server/content.ts';
import { groupsOf, letterLinks, nationIndexRows, stateLinks } from '#lib/server/nation-index.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const rows = nationIndexRows();
	return {
		total: rows.length,
		letters: letterLinks(),
		states: stateLinks(),
		// The small groups are listed here in full; the Native nations are browsed by letter or state.
		otherGroups: groupsOf(rows.filter((row) => row.entityType !== 'native-nation')),
		nationCount: rows.filter((row) => row.entityType === 'native-nation').length,
		example: nations().some((record) => record.example)
	};
};
