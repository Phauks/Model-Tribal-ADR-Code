import { json } from '@sveltejs/kit';
import { tileMapData } from '#lib/server/nations-map.ts';
import type { RequestHandler } from './$types';

export const prerender = true;

// What the map drawn with MapLibre needs besides its tiles (src/lib/components/TileMap.svelte), fetched when the map starts.
export const GET: RequestHandler = () => json(tileMapData());
