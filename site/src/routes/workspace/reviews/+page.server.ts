import { redirect } from '@sveltejs/kit';
import { reviewSubjects } from 'virtual:review-subjects';
import { can, canSeeSubject, subjectKinds, type SubjectKind } from '#lib/permissions.ts';
import { grantsOf } from '#lib/server/access.ts';
import { latestReviews } from '#lib/server/reviews.ts';
import { requirePerson, storage } from '#lib/server/workspace.ts';
import type { PageServerLoad } from './$types';

const shown = 100;

export const load: PageServerLoad = async (event) => {
	const person = requirePerson(event);
	const { database } = storage(event);

	// Only what the person may open: their role's default, raised or lowered
	// by the lead author's grants (src/lib/permissions.ts, documentAccess).
	const grants = await grantsOf(database, person.identifier);
	const visible = reviewSubjects.filter((subject) => canSeeSubject(person, subject, grants));
	// Someone who can open a single record, such as a nation reviewer, goes
	// straight to it.
	if (!can(person, 'read-reviews') && visible.length === 1) {
		redirect(303, `/workspace/reviews/${visible[0].kind}/${visible[0].identifier}`);
	}
	const visibleKeys = new Set(visible.map((subject) => `${subject.kind}/${subject.identifier}`));

	const query = (event.url.searchParams.get('search') ?? '').trim().slice(0, 100);
	const requestedKind = event.url.searchParams.get('kind');
	const kind = (subjectKinds as readonly string[]).includes(requestedKind ?? '')
		? (requestedKind as SubjectKind)
		: undefined;

	const latest = (await latestReviews(database)).filter((review) =>
		visibleKeys.has(`${review.subjectKind}/${review.subjectIdentifier}`)
	);
	const latestBySubject = new Map(
		latest.map((review) => [`${review.subjectKind}/${review.subjectIdentifier}`, review])
	);

	const folded = query.toLocaleLowerCase('en-US');
	const matches = visible.filter(
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
			visible.filter((subject) => subject.kind === subjectKind).length
		])
	) as Record<SubjectKind, number>;

	return { query, kind, subjects, matchCount: matches.length, counts, shown };
};
