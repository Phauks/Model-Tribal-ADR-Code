import { json } from '@sveltejs/kit';
import { nationsMapPage } from '#lib/server/nations-map.ts';
import type { RequestHandler } from './$types';

export const prerender = true;

// The Map page's References (src/routes/nations/map/+page.server.ts), fetched as a reader nears them.
export const GET: RequestHandler = () => json(nationsMapPage().sources);
