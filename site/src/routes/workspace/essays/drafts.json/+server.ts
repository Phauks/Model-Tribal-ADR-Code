/**
 * The essays in one part (?part=foundations, essays or back-matter) that
 * are not published yet and that this person can open, so the part's index
 * page can list them for the people working on them (EssayIndex.svelte).
 * Readers never see these; a page not published yet shows them only that.
 */
import { error, json } from '@sveltejs/kit';
import { atLeast } from '#lib/permissions.ts';
import { essayParts, essayPath, listEssays, type EssayPart } from '#lib/server/essays.ts';
import { levelOn } from '#lib/server/essay-workspace.ts';
import { requirePersonForData, storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async (event) => {
	const person = requirePersonForData(event);
	const part = event.url.searchParams.get('part') as EssayPart | null;
	if (!part || !(essayParts as readonly string[]).includes(part)) error(400, 'Say which part.');
	const { database } = storage(event);
	const unpublished = (await listEssays(database)).filter((essay) => essay.part === part && !essay.published);
	const drafts = [];
	for (const essay of unpublished) {
		const level = await levelOn(database, person, essay.identifier);
		if (atLeast(level, 'comment')) drafts.push({ identifier: essay.identifier, title: essay.title, link: essayPath(essay.identifier, essay.part), canEdit: atLeast(level, 'contribute') });
	}
	return json({ drafts }, { headers: { 'Cache-Control': 'private, no-store' } });
};
