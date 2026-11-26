/**
 * One map tile, for the map drawn with MapLibre (decision record 0039), read from the private sourceDocuments bucket (src/lib/server/map-tile-serving.ts). Without the bucket, as in local development, there are no tiles and the map falls back to the drawn map.
 */
import { afterResponse, workerEnvironment } from '#lib/server/environment.ts';
import { keptAnswer, locationCache } from '#lib/server/kept-answers.ts';
import { keptTileKey, serveMapTile } from '#lib/server/map-tile-serving.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async ({ params, url }) => {
	const bucket = workerEnvironment().sourceDocuments;
	if (!bucket) return new Response('Map tiles are not available here.', { status: 404, headers: { 'Cache-Control': 'no-store' } });
	const [z, x, y] = [Number(params.z), Number(params.x), Number(params.y)];
	const make = () => serveMapTile(bucket, params.set, z, x, y);
	// A tile is kept in this Cloudflare location's cache across deploys, so a new version of the site does not read every tile from the bucket again (docs/edge-caching.md).
	const key = keptTileKey(url.origin, params.set, z, x, y);
	if (!key) return make();
	return keptAnswer(key, make, { store: locationCache(), later: afterResponse, statuses: [200, 204] });
};
