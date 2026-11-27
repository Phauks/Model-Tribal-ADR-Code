import { nationsMapPage } from '#lib/server/nations-map.ts';
import { mapPageHistoric } from '#lib/server/land-cessions.ts';
import type { PageServerLoad } from './$types';

// The map outlines are not part of this data; +page.ts draws them on the server.
// The "Land areas" view is not part of it either: the page fetches it from
// ./land-areas.json when a reader opens that view. Nor are the land cessions' details, fetched from ./land-cessions.json.
// Nor are the References, over two thousand sources: copied into the page for hydration they were 3.8 MB of its 10.7 MB. Only their number is here; +page.ts puts the list in the page's markup for readers without scripts, and the page fetches it from ./sources.json as a reader nears it.
export const load: PageServerLoad = () => {
	const { sources, ...page } = nationsMapPage();
	return { ...page, sourceCount: sources.length, historic: mapPageHistoric() };
};
