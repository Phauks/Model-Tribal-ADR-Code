/**
 * Publishes every draft of site text, from the Publish list in the masthead,
 * and asks Cloudflare to rebuild the site with the new words
 * (docs/site-text.md). Needs Full on the site text.
 */
import { error, json } from '@sveltejs/kit';
import { siteTextSubject } from '#lib/permissions.ts';
import { requireDocumentLevel } from '#lib/server/access.ts';
import { afterResponse, workerEnvironment } from '#lib/server/environment.ts';
import { publish, requestRebuild } from '#lib/server/site-text.ts';
import { requirePersonForData, storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const POST: RequestHandler = async (event) => {
	const person = requirePersonForData(event);
	const { database } = storage(event);
	await requireDocumentLevel(event, database, siteTextSubject, 'full');
	const body = (await event.request.json().catch(() => null)) as { keys?: unknown } | null;
	const keys = Array.isArray(body?.keys) ? body.keys.filter((key): key is string => typeof key === 'string') : undefined;
	const number = await publish(database, person.identifier, keys);
	if (number === null) error(400, 'There is nothing to publish.');
	afterResponse(requestRebuild(database, workerEnvironment().SITE_REBUILD_HOOK_URL, number, 'published'));
	return json({ publication: number }, { headers: { 'cache-control': 'no-store' } });
};
