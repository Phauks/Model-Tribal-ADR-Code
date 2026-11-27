/**
 * For the editing box on a page (src/lib/components/SiteTextEditor.svelte):
 * the person's level on the site text, and for each piece of text the page
 * shows, its built-in words, what is published and any draft.
 */
import { error, json } from '@sveltejs/kit';
import { siteTextSubject } from '#lib/permissions.ts';
import { accessTo } from '#lib/server/access.ts';
import { recordPiece } from '#lib/server/record-text.ts';
import { pieceStates } from '#lib/server/site-text.ts';
import { catalogByKey } from '#lib/server/site-text-catalog.ts';
import { requirePersonForData, storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

const keyPattern = /^[0-9a-z]{10}$/;

export const POST: RequestHandler = async (event) => {
	const person = requirePersonForData(event);
	const { database } = storage(event);
	const access = await accessTo(database, person, siteTextSubject);
	if (access.level === 'no-access') error(403, 'You do not have access to the site text.');
	const body = (await event.request.json().catch(() => null)) as { keys?: unknown } | null;
	const keys = Array.isArray(body?.keys) ? body.keys.filter((key): key is string => typeof key === 'string' && keyPattern.test(key)).slice(0, 5000) : [];
	const catalog = catalogByKey();
	const states = await pieceStates(database);
	const pieces = (
		await Promise.all(
			keys.map(async (key) => {
				const entry = catalog.get(key);
				if (!entry) return [];
				const state = states.get(key);
				return [
					{
						key,
						builtIn: entry.words,
						attribute: entry.attribute ?? null,
						published: state?.published ?? null,
						draft: state?.draft ? { words: state.draft.words, personName: state.draft.personName, createdAt: state.draft.createdAt } : null,
						record: await recordPiece(entry, state)
					}
				];
			})
		)
	).flat();
	const waiting = [...states.values()].filter((state) => state.draft).length;
	return json({ level: access.level, pieces, waiting }, { headers: { 'cache-control': 'no-store' } });
};
