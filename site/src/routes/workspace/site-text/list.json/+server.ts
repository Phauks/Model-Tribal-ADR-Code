/**
 * Everything the site text list in the masthead shows
 * (src/lib/components/SiteTextEditor.svelte; mockup design/site-text-fold,
 * approved by Trevor on Nov. 26, 2026): the drafts waiting to be published,
 * the newest publications, and edits to text the code no longer has.
 */
import { json } from '@sveltejs/kit';
import { atLeast, siteTextSubject } from '#lib/permissions.ts';
import { requireDocumentLevel } from '#lib/server/access.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { goneEdits, latestPublication, pieceStates, publications } from '#lib/server/site-text.ts';
import { builtPublication, catalogByKey } from '#lib/server/site-text-catalog.ts';
import { entryPlace, pageName, siteTextPlace } from '#lib/site-text.ts';
import { requirePersonForData, storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

/** How many publications the list shows; each piece's own page keeps its whole history. */
const publicationsShown = 3;

export const GET: RequestHandler = async (event) => {
	requirePersonForData(event);
	const { database } = storage(event);
	const access = await requireDocumentLevel(event, database, siteTextSubject, 'comment');
	const catalog = catalogByKey();
	const [states, recent, latest] = await Promise.all([pieceStates(database), publications(database, publicationsShown), latestPublication(database)]);
	const drafts = [...states.values()]
		.filter((state) => state.draft && catalog.has(state.key))
		.sort((first, second) => (second.draft?.identifier ?? 0) - (first.draft?.identifier ?? 0))
		.map((state) => {
			const entry = catalog.get(state.key);
			const builtIn = entry?.words ?? state.draft?.builtInWords ?? '';
			return {
				key: state.key,
				place: entry?.record ? entryPlace(entry) : state.draft?.page ? pageName(state.draft.page) : siteTextPlace(entry?.file ?? state.draft?.sourceFile ?? ''),
				before: state.published ?? builtIn,
				after: state.draft?.words ?? builtIn,
				published: state.published
			};
		});
	const gone = (await goneEdits(database, states, catalog)).map((edit) => ({
		key: edit.key,
		place: edit.page ? pageName(edit.page) : siteTextPlace(edit.sourceFile),
		page: edit.page,
		words: edit.words,
		builtIn: edit.builtInWords
	}));
	const status = latest === 0 || builtPublication >= latest ? 'live' : workerEnvironment().SITE_REBUILD_HOOK_URL ? 'building' : 'next-deploy';
	return json(
		{ drafts, publications: recent, latest, status, gone, canPublish: atLeast(access.level, 'full') },
		{ headers: { 'cache-control': 'no-store' } }
	);
};
