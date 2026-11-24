/**
 * The essays the signed-in person can edit (contribute access or above),
 * newest saved first, each with its page and the page's address in Editing
 * (?edit). Other parts of the site use it to send someone to an essay to add
 * something, such as a chart from the table builder (?add-chart=, read by
 * EssayArticle.svelte).
 */
import { json } from '@sveltejs/kit';
import { atLeast } from '#lib/permissions.ts';
import { essayPath, listEssays } from '#lib/server/essays.ts';
import { essayLevels } from '#lib/server/essay-workspace.ts';
import { requirePersonForData, storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async (event) => {
	const person = requirePersonForData(event);
	const { database } = storage(event);
	const [all, levelFor] = await Promise.all([listEssays(database), essayLevels(database, person)]);
	const essays = [];
	for (const essay of all) {
		if (!atLeast(levelFor(essay.identifier), 'contribute')) continue;
		const link = essayPath(essay.identifier, essay.part);
		essays.push({ identifier: essay.identifier, title: essay.title, part: essay.part, link, editLink: `${link}?edit`, savedAt: essay.latestSavedAt });
	}
	essays.sort((first, second) => (second.savedAt ?? '').localeCompare(first.savedAt ?? ''));
	return json({ essays: essays.map(({ savedAt: _savedAt, ...rest }) => rest) }, { headers: { 'Cache-Control': 'private, no-store' } });
};
