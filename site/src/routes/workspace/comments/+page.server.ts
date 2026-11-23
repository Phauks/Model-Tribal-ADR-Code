import { commentsForYou } from '#lib/server/essay-comments.ts';
import { requirePerson, storage } from '#lib/server/workspace.ts';
import type { PageServerLoad } from './$types';

/**
 * Comments waiting on this person: threads where someone mentioned them,
 * and threads they wrote in that someone has since answered
 * (src/lib/server/essay-comments.ts). Each opens the essay for commenting
 * at the thread.
 */
export const load: PageServerLoad = async (event) => {
	const person = requirePerson(event);
	const { database } = storage(event);
	return { threads: await commentsForYou(database, person.identifier) };
};
