import { nationsMapPage } from '#lib/server/nations-map.ts';
import { mapPageHistoric } from '#lib/server/land-cessions.ts';
import type { PageServerLoad } from './$types';

// The map outlines are not part of this data; +page.ts draws them on the server.
// The "Land areas" view is not part of it either: the page fetches it from
// ./land-areas.json when a reader opens that view. Nor are the land cessions' details, fetched from ./land-cessions.json.
export const load: PageServerLoad = () => ({ ...nationsMapPage(), historic: mapPageHistoric() });
