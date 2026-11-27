/**
 * Undoes the newest publication of site text, from the site text list in
 * the masthead, and asks Cloudflare to rebuild the site (docs/site-text.md).
 * Needs Full on the site text.
 */
import { error, json } from '@sveltejs/kit';
import { siteTextSubject } from '#lib/permissions.ts';
import { requireDocumentLevel } from '#lib/server/access.ts';
import { afterResponse, workerEnvironment } from '#lib/server/environment.ts';
import { latestPublication, requestRebuild, undoLatestPublication } from '#lib/server/site-text.ts';
import { catalogByKey } from '#lib/server/site-text-catalog.ts';
import { requirePersonForData, storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const POST: RequestHandler = async (event) => {
	const person = requirePersonForData(event);
	const { database } = storage(event);
	await requireDocumentLevel(event, database, siteTextSubject, 'full');
	const body = (await event.request.json().catch(() => /* expected: a body that is not JSON names no publication, which is refused just below with 409 */ null)) as { publication?: unknown } | null;
	if (body?.publication !== (await latestPublication(database))) error(409, 'Someone published since this list opened. Open it again and try again.');
	const number = await undoLatestPublication(database, person.identifier, catalogByKey());
	if (number === null) error(400, 'Nothing has been published.');
	afterResponse(requestRebuild(database, workerEnvironment().SITE_REBUILD_HOOK_URL, number, 'published'));
	return json({ publication: number }, { headers: { 'cache-control': 'no-store' } });
};
