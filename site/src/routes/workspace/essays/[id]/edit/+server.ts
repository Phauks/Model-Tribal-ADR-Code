/**
 * The full-page editor was removed with Workspace › Essays: an essay is
 * edited in place on its own page. The old address opens that page in
 * Editing (?edit), so links and bookmarks keep working.
 */
import { error, redirect } from '@sveltejs/kit';
import { essayPath, essayRow } from '#lib/server/essays.ts';
import { essayAccess } from '#lib/server/essay-workspace.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async (event) => {
	// The same check as the essay's workspace page, before the essay is looked
	// up, so a signed-out visitor cannot learn from the answer whether a draft exists.
	const { database } = await essayAccess(event, 'comment');
	const essay = await essayRow(database, event.params.id);
	if (!essay) error(404, 'No essay has this address yet.');
	redirect(308, `${essayPath(event.params.id, essay.part)}?edit`);
};
