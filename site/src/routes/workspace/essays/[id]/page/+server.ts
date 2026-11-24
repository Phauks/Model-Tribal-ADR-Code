/**
 * The essay page's view for a person with access (comment level or above):
 * their level, the newest draft marked against the published text, and the
 * file for editing in place (src/lib/server/essay-page-state.ts). Never cached.
 */
import { error, json } from '@sveltejs/kit';
import { essayAccess } from '#lib/server/essay-workspace.ts';
import { syncEssaysFromGitOnce } from '#lib/server/essay-git-sync.ts';
import { essayPageState } from '#lib/server/essay-page-state.ts';
import { can } from '#lib/permissions.ts';
import { commentsForYouCount } from '#lib/server/essay-comments.ts';
import { reviewRequestCount } from '#lib/server/essay-review-requests.ts';
import { draftsBy } from '#lib/server/essays.ts';
import type { YourWork } from '#lib/essays/editing-outline.svelte.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async (event) => {
	const { identifier, database, bucket, level, person } = await essayAccess(event, 'comment', { forData: true });
	const outcome = (await syncEssaysFromGitOnce(database, bucket)).find((candidate) => candidate.identifier === identifier);
	const state = await essayPageState(database, bucket, identifier, level, outcome?.state === 'conflict' ? outcome.conflicts : 0);
	if (!state) error(404, 'No essay has this address yet.');
	// "Your work" under the essay's outline in the sidebar while editing (essay-editor-mockups/4 and v2-1).
	const [reviewRequests, commentsForYou, drafts] = await Promise.all([
		reviewRequestCount(database, person.identifier),
		can(person, 'comment') ? commentsForYouCount(database, person.identifier) : 0,
		draftsBy(database, person.identifier)
	]);
	const work: YourWork = { reviewRequests, commentsForYou, drafts };
	return json({ ...state, you: { identifier: person.identifier, name: person.displayName }, work }, { headers: { 'Cache-Control': 'private, no-store' } });
};
