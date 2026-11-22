/**
 * The essay page's view for a person with access (comment level or above):
 * their level, the newest draft marked against the published text, and the
 * file for editing in place (src/lib/server/essay-page-state.ts). Never cached.
 */
import { error, json } from '@sveltejs/kit';
import { essayAccess } from '#lib/server/essay-workspace.ts';
import { syncEssaysFromGitOnce } from '#lib/server/essay-git-sync.ts';
import { essayPageState } from '#lib/server/essay-page-state.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async (event) => {
	const { identifier, database, bucket, level } = await essayAccess(event, 'comment');
	const outcome = (await syncEssaysFromGitOnce(database, bucket)).find((candidate) => candidate.identifier === identifier);
	const state = await essayPageState(database, bucket, identifier, level, outcome?.state === 'conflict' ? outcome.conflicts : 0);
	if (!state) error(404, 'No essay has this address yet.');
	return json(state, { headers: { 'Cache-Control': 'private, no-store' } });
};
