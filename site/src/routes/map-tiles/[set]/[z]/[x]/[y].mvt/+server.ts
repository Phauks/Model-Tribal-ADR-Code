/**
 * One map tile, for the map drawn with MapLibre (decision record 0035), read from the private sourceDocuments bucket (src/lib/server/map-tile-serving.ts). Without the bucket, as in local development, there are no tiles and the map falls back to the drawn map.
 */
import { workerEnvironment } from '#lib/server/environment.ts';
import { serveMapTile } from '#lib/server/map-tile-serving.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async ({ params }) => {
	const bucket = workerEnvironment().sourceDocuments;
	if (!bucket) return new Response('Map tiles are not available here.', { status: 404, headers: { 'Cache-Control': 'no-store' } });
	return serveMapTile(bucket, params.set, Number(params.z), Number(params.x), Number(params.y));
};
