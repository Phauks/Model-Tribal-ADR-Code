/**
 * The drafts of site text waiting to be published, for the Publish list in
 * the masthead (src/lib/components/SiteTextEditor.svelte).
 */
import { json } from '@sveltejs/kit';
import { siteTextSubject } from '#lib/permissions.ts';
import { requireDocumentLevel } from '#lib/server/access.ts';
import { drafts } from '#lib/server/site-text.ts';
import { catalogByKey } from '#lib/server/site-text-catalog.ts';
import { pageName, siteTextPlace } from '#lib/site-text.ts';
import { requirePersonForData, storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async (event) => {
	requirePersonForData(event);
	const { database } = storage(event);
	await requireDocumentLevel(event, database, siteTextSubject, 'comment');
	const catalog = catalogByKey();
	const waiting = (await drafts(database)).map((state) => {
		const entry = catalog.get(state.key);
		const builtIn = entry?.words ?? state.draft?.builtInWords ?? '';
		return {
			key: state.key,
			place: state.draft?.page ? pageName(state.draft.page) : siteTextPlace(entry?.file ?? state.draft?.sourceFile ?? ''),
			before: state.published ?? builtIn,
			after: state.draft?.words ?? builtIn,
			published: state.published
		};
	});
	return json({ drafts: waiting }, { headers: { 'cache-control': 'no-store' } });
};
