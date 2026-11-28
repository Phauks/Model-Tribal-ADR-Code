import { nations } from '#lib/server/content.ts';
import { groupsOf, nationIndexRows } from '#lib/server/nation-index.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const groups = groupsOf(nationIndexRows());
	return {
		// Every Native nation in one table (Trevor, Nov. 23, 2026: "why not just
		// one big table?"). The Native Hawaiian community and the Indigenous
		// peoples of the territories keep tables of their own, never listed as
		// tribes (docs/terms).
		nationGroup: groups.find((group) => group.entityType === 'native-nation'),
		otherGroups: groups.filter((group) => group.entityType !== 'native-nation'),
		example: nations().some((record) => record.example)
	};
};
