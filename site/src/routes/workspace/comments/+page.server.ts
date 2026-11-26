import { everyCommentForYou } from '#lib/server/page-comments.ts';
import { requirePerson, storage } from '#lib/server/workspace.ts';
import type { PageServerLoad } from './$types';

/**
 * Comments waiting on this person: threads where someone mentioned them,
 * and threads they wrote in that someone has since answered
 * on essays and on other pages (src/lib/server/essay-comments.ts,
 * page-comments.ts). Each opens the page for commenting at the thread.
 */
export const load: PageServerLoad = async (event) => {
	const person = requirePerson(event);
	const { database } = storage(event);
	return { threads: await everyCommentForYou(database, person) };
};
