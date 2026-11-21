import { reviewSubjects } from 'virtual:review-subjects';
import { can } from '#lib/permissions.ts';
import { deadlinesOf } from '#lib/requests.ts';
import { listRequests } from '#lib/server/request-store.ts';
import { latestReviews } from '#lib/server/reviews.ts';
import { requirePerson, storage } from '#lib/server/workspace.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const person = requirePerson(event);
	const { database } = storage(event);

	const openRequests = can(person, 'read-requests')
		? (await listRequests(database, 'open')).map((request) => ({
				...request,
				deadlines: deadlinesOf(request)
			}))
		: undefined;

	const recentReviews = can(person, 'read-reviews')
		? (await latestReviews(database, 10)).map((review) => ({
				...review,
				title:
					reviewSubjects.find(
						(subject) =>
							subject.kind === review.subjectKind && subject.identifier === review.subjectIdentifier
					)?.title ?? review.subjectIdentifier
			}))
		: undefined;

	const ownNation =
		person.role === 'nation-reviewer'
			? reviewSubjects.find(
					(subject) => subject.kind === 'nation' && subject.identifier === person.nationIdentifier
				)
			: undefined;

	return { openRequests, recentReviews, ownNation };
};
