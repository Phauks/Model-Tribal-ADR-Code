import geometry from 'virtual:map-geometry';
import { json } from '@sveltejs/kit';
import { drawNationsMaps } from '#lib/nations-map-drawing.ts';
import { nationsMapPage } from '#lib/server/nations-map.ts';
import type { RequestHandler } from './$types';

export const prerender = true;

// The two maps of /nations/map, for a reader who reaches the page from
// another page of the site without reloading (src/routes/nations/map/+page.ts).
export const GET: RequestHandler = () => json(drawNationsMaps(geometry, nationsMapPage().counts));
