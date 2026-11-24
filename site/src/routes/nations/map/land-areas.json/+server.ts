import { json } from '@sveltejs/kit';
import { landAreasView } from '#lib/server/nations-map.ts';
import type { RequestHandler } from './$types';

export const prerender = true;

// The "Land areas" view of the map on /nations/map: its table rows, fetched only when a reader chooses the view. Its drawn copy, the Census Bureau's outlines, is apart in ./view-drawings/lands.json, fetched only for printing or when the tiled map cannot start.
export const GET: RequestHandler = () => json({ rows: landAreasView().rows });
