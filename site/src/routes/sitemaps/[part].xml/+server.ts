/**
 * One part of the sitemap (src/lib/sitemap.ts, docs/sitemap.md), written
 * when a crawler asks: the pages the build listed, less what nations chose
 * to hide (decision record 0056), dated by nations' own changes too; or the
 * published essays, read from the database.
 */
import { error } from '@sveltejs/kit';
import { workerEnvironment } from '#lib/server/environment.ts';
import { livePart } from '#lib/server/sitemap-live.ts';
import { partNamePattern, urlsetXml } from '#lib/sitemap.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async ({ params, url }) => {
	if (!partNamePattern.test(params.part)) error(404, 'Not found');
	const environment = workerEnvironment();
	if (!environment.ASSETS) error(404, 'Not found');
	const entries = await livePart(params.part, environment.database, environment.ASSETS, url.origin);
	if (!entries) error(404, 'Not found');
	return new Response(urlsetXml(environment.SITE_ADDRESS || url.origin, entries), {
		headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'no-cache' }
	});
};
