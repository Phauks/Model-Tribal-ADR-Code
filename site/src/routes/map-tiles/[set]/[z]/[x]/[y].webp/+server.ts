/**
 * One picture tile of a scanned map warped onto the web map (the Office of Indian Affairs' 1909 map, for the Map page's "Show the original map" switch), read from the private sourceDocuments bucket like the vector tiles (src/lib/server/map-tile-serving.ts).
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
	const make = () => serveMapTile(bucket, params.set, z, x, y, 'webp');
	const key = keptTileKey(url.origin, params.set, z, x, y);
	if (!key) return make();
	return keptAnswer(key, make, { store: locationCache(), later: afterResponse, statuses: [200, 204] });
};
