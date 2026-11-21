import { error, redirect } from '@sveltejs/kit';
import { reviewSubjects } from 'virtual:review-subjects';
import { can, subjectKinds, type SubjectKind } from '#lib/permissions.ts';
import { latestReviews } from '#lib/server/reviews.ts';
import { requirePerson, storage } from '#lib/server/workspace.ts';
import type { PageServerLoad } from './$types';

const shown = 100;

export const load: PageServerLoad = async (event) => {
	const person = requirePerson(event);
	if (person.role === 'nation-reviewer' && person.nationIdentifier) {
		redirect(303, `/workspace/reviews/nation/${person.nationIdentifier}`);
	}
	if (!can(person, 'read-reviews')) error(403, 'You do not have permission to see this page.');
	const { database } = storage(event);

	const query = (event.url.searchParams.get('search') ?? '').trim().slice(0, 100);
	const requestedKind = event.url.searchParams.get('kind');
	const kind = (subjectKinds as readonly string[]).includes(requestedKind ?? '')
		? (requestedKind as SubjectKind)
		: undefined;

	const latest = await latestReviews(database);
	const latestBySubject = new Map(
		latest.map((review) => [`${review.subjectKind}/${review.subjectIdentifier}`, review])
	);

	const folded = query.toLocaleLowerCase('en-US');
	const matches = reviewSubjects.filter(
		(subject) =>
			(!kind || subject.kind === kind) &&
			(folded === '' ||
				subject.title.toLocaleLowerCase('en-US').includes(folded) ||
				subject.identifier.includes(folded))
	);

	// Without a search, show what was reviewed most recently.
	const subjects = (
		query === '' && !kind
			? latest
					.map((review) =>
						reviewSubjects.find(
							(subject) =>
								subject.kind === review.subjectKind && subject.identifier === review.subjectIdentifier
						)
					)
					.filter((subject) => subject !== undefined)
			: matches
	)
		.slice(0, shown)
		.map((subject) => ({
			...subject,
			latest: latestBySubject.get(`${subject.kind}/${subject.identifier}`)
		}));

	const counts = Object.fromEntries(
		subjectKinds.map((subjectKind) => [
			subjectKind,
			reviewSubjects.filter((subject) => subject.kind === subjectKind).length
		])
	) as Record<SubjectKind, number>;

	return { query, kind, subjects, matchCount: matches.length, counts, shown };
};
