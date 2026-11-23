import { reviewRequestsOf } from '#lib/server/essay-review-requests.ts';
import { requirePerson, storage } from '#lib/server/workspace.ts';
import type { PageServerLoad } from './$types';

/**
 * The review requests waiting on this person, and the open ones they asked
 * of others (src/lib/server/essay-review-requests.ts). Each opens the essay
 * page for commenting at the section to review.
 */
export const load: PageServerLoad = async (event) => {
	const person = requirePerson(event);
	const { database } = storage(event);
	return { ...(await reviewRequestsOf(database, person.identifier)), you: person.identifier };
};
