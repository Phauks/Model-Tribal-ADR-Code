/**
 * The map's label fonts and icon sheets, read from the private sourceDocuments bucket (src/lib/server/map-tile-serving.ts).
 */
import { workerEnvironment } from '#lib/server/environment.ts';
import { serveMapAsset } from '#lib/server/map-tile-serving.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async ({ params }) => {
	const bucket = workerEnvironment().sourceDocuments;
	if (!bucket) return new Response('Map files are not available here.', { status: 404, headers: { 'Cache-Control': 'no-store' } });
	return serveMapAsset(bucket, params.path);
};
