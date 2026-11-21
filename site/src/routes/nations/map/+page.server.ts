import { nationsMapPage } from '#lib/server/nations-map.ts';
import type { PageServerLoad } from './$types';

// The map outlines are not part of this data; +page.ts draws them on the server.
export const load: PageServerLoad = () => nationsMapPage();
