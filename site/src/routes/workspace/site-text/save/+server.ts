/**
 * Saves a draft of one piece of site text from the editing box on a page
 * (docs/site-text.md). Needs Contribute on the site text.
 */
import { error, json } from '@sveltejs/kit';
import { siteTextSubject } from '#lib/permissions.ts';
import { requireDocumentLevel } from '#lib/server/access.ts';
import { recordPiece } from '#lib/server/record-text.ts';
import { pieceStates, saveVersion, SiteTextProblem } from '#lib/server/site-text.ts';
import { catalogByKey } from '#lib/server/site-text-catalog.ts';
import { requirePersonForData, storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const POST: RequestHandler = async (event) => {
	const person = requirePersonForData(event);
	const { database } = storage(event);
	await requireDocumentLevel(event, database, siteTextSubject, 'contribute');
	const body = (await event.request.json().catch(() => null)) as { key?: unknown; words?: unknown; page?: unknown } | null;
	const entry = typeof body?.key === 'string' ? catalogByKey().get(body.key) : undefined;
	if (!entry) error(409, 'This text is no longer on the site. Reload the page and try again.');
	const words = body?.words === null ? null : typeof body?.words === 'string' ? body.words : undefined;
	if (words === undefined) error(400, 'Send the words, or null for the built-in words.');
	try {
		await saveVersion(database, { entry, words, page: typeof body?.page === 'string' ? body.page : null, personIdentifier: person.identifier });
	} catch (problem) {
		if (problem instanceof SiteTextProblem) error(problem.status, problem.message);
		throw problem;
	}
	const states = await pieceStates(database);
	const state = states.get(entry.key);
	return json(
		{
			key: entry.key,
			published: state?.published ?? null,
			draft: state?.draft ? { words: state.draft.words, personName: state.draft.personName, createdAt: state.draft.createdAt } : null,
			record: await recordPiece(entry, state),
			waiting: [...states.values()].filter((each) => each.draft).length
		},
		{ headers: { 'cache-control': 'no-store' } }
	);
};
