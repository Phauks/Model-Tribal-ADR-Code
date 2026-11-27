/**
 * Lets go of an edit to site text the code no longer has, from the site
 * text list in the masthead (docs/site-text.md). Needs Contribute on the
 * site text.
 */
import { error, json } from '@sveltejs/kit';
import { siteTextSubject } from '#lib/permissions.ts';
import { requireDocumentLevel } from '#lib/server/access.ts';
import { letGo, SiteTextProblem } from '#lib/server/site-text.ts';
import { catalogByKey } from '#lib/server/site-text-catalog.ts';
import { requirePersonForData, storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const POST: RequestHandler = async (event) => {
	const person = requirePersonForData(event);
	const { database } = storage(event);
	await requireDocumentLevel(event, database, siteTextSubject, 'contribute');
	const body = (await event.request.json().catch(() => null)) as { key?: unknown } | null;
	if (typeof body?.key !== 'string') error(400, 'Name the edit to let go.');
	try {
		await letGo(database, body.key, person.identifier, catalogByKey());
	} catch (problem) {
		if (problem instanceof SiteTextProblem) error(problem.status, problem.message);
		throw problem;
	}
	return json({ key: body.key }, { headers: { 'cache-control': 'no-store' } });
};
