import { reviewSubjects } from 'virtual:review-subjects';
import { can, canSeeSubject } from '#lib/permissions.ts';
import { grantsOf } from '#lib/server/access.ts';
import { administrationSummary } from '#lib/server/administration.ts';
import { deadlinesOf } from '#lib/requests.ts';
import { profileOfPerson } from '#lib/server/contributor-profiles.ts';
import { placesOf } from '#lib/server/nation-teams.ts';
import { reviewDays } from '#lib/nation-page-review.ts';
import { reviewCounts } from '#lib/server/nation-page-review.ts';
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

	const grants = await grantsOf(database, person.identifier);
	const recentReviews = can(person, 'read-reviews')
		? (await latestReviews(database, 30))
				.filter((review) =>
					canSeeSubject(person, { kind: review.subjectKind, identifier: review.subjectIdentifier }, grants)
				)
				.slice(0, 10)
				.map((review) => ({
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

	// Documents opened to this person by a grant, so they can find them.
	const granted = reviewSubjects.filter(
		(subject) =>
			grants.some((grant) => grant.subjectKind === subject.kind) &&
			!(person.role === 'nation-reviewer' && subject.kind === 'nation' && subject.identifier === person.nationIdentifier) &&
			canSeeSubject(person, subject, grants)
	);

	const administration = can(person, 'manage-people') ? await administrationSummary(database) : undefined;

	// Nations' published changes the project has yet to read (decision record 0041, "Stage 3").
	const nationChanges = can(person, 'review-nation-pages')
		? await reviewCounts(database, new Date(Date.now() - reviewDays * 24 * 60 * 60 * 1000).toISOString())
		: undefined;

	// Co-authors and reviewers keep a contributor profile too, so their credit is their own choice.
	const profile = await profileOfPerson(database, person.identifier);
	const profileState = !profile ? 'missing' : profile.hasUnconfirmedChanges ? 'unconfirmed' : 'confirmed';

	// Nations whose teams this person is on, so they can reach the team page.
	const teams = (await placesOf(database, person.identifier)).map((place) => ({
		nationIdentifier: place.nationIdentifier,
		level: place.level,
		title:
			reviewSubjects.find((subject) => subject.kind === 'nation' && subject.identifier === place.nationIdentifier)
				?.title ?? place.nationIdentifier
	}));

	return {
		teams,
		openRequests,
		recentReviews,
		ownNation,
		granted: can(person, 'read-reviews') ? [] : granted.slice(0, 50),
		administration,
		nationChanges,
		profileState
	};
};
