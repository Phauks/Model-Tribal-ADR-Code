/**
 * The sitemap's index (src/lib/sitemap.ts, docs/sitemap.md): one entry per
 * part, written when a crawler asks, so newly published essays and nations'
 * own changes are in it before the next build.
 */
import { error } from '@sveltejs/kit';
import { workerEnvironment } from '#lib/server/environment.ts';
import { livePartList } from '#lib/server/sitemap-live.ts';
import { indexXml } from '#lib/sitemap.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async ({ url }) => {
	const environment = workerEnvironment();
	if (!environment.ASSETS) error(404, 'Not found');
	const parts = await livePartList(environment.database, environment.ASSETS, url.origin);
	if (!parts) error(404, 'Not found');
	return new Response(indexXml(environment.SITE_ADDRESS || url.origin, parts), {
		headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'no-cache' }
	});
};
