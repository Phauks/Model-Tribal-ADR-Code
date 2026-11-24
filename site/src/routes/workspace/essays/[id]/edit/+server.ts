/**
 * The full-page editor was removed with Workspace › Essays: an essay is
 * edited in place on its own page. The old address opens that page in
 * Editing (?edit), so links and bookmarks keep working.
 */
import { error, redirect } from '@sveltejs/kit';
import { essayPath, essayRow } from '#lib/server/essays.ts';
import { storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async (event) => {
	const essay = await essayRow(storage(event).database, event.params.id);
	if (!essay) error(404, 'No essay has this address yet.');
	redirect(308, `${essayPath(event.params.id, essay.part)}?edit`);
};
