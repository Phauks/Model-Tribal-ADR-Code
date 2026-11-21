import { error, fail } from '@sveltejs/kit';
import { reviewSubjects } from 'virtual:review-subjects';
import { allowedDecisions, decisions, type Decision, type Subject } from '#lib/permissions.ts';
import { recordReview, reviewsOf } from '#lib/server/reviews.ts';
import { reviewedVersion } from '#lib/server/versions.ts';
import { grantsOf } from '#lib/server/access.ts';
import { formText, refuse, requirePerson, storage } from '#lib/server/workspace.ts';
import type { PageServerLoad, RequestEvent } from './$types';
import type { Actions } from './$types';

function findSubject(event: Pick<RequestEvent, 'params'>) {
	const subject = reviewSubjects.find(
		(candidate) =>
			candidate.kind === event.params.kind && candidate.identifier === event.params.identifier
	);
	if (!subject) error(404, 'Nothing to review has this address.');
	return subject;
}

export const load: PageServerLoad = async (event) => {
	const person = requirePerson(event);
	const subject = findSubject(event);
	const { database } = storage(event);
	const allowed = allowedDecisions(person, subject, await grantsOf(database, person.identifier));
	if (!allowed) refuse(event, `no access to ${subject.kind} ${subject.identifier}`, 'You do not have permission to see this record.');
	return {
		subject,
		allowed,
		version: reviewedVersion(),
		reviews: await reviewsOf(database, subject)
	};
};

export const actions: Actions = {
	default: async (event) => {
		const person = requirePerson(event);
		const subject: Subject = findSubject(event);
		const { database } = storage(event);
		// Checked again here, from the database: the page may have been opened
		// before the person's access changed.
		const allowed = allowedDecisions(person, subject, await grantsOf(database, person.identifier));
		if (!allowed) {
			refuse(event, `no access to ${subject.kind} ${subject.identifier}`, 'You do not have permission to review this record.');
		}

		const form = await event.request.formData();
		const decision = formText(form, 'decision') as Decision | null;
		const note = formText(form, 'note');
		if (!decision || !decisions.includes(decision) || !allowed.decisions.includes(decision)) {
			return fail(400, { problem: 'Choose a decision you are allowed to record.', note });
		}
		if (decision !== 'approved' && !note) {
			return fail(400, { problem: 'Say what should change, or write your comment.', note });
		}
		await recordReview(
			database,
			{ subject, contentVersion: reviewedVersion(), capacity: allowed.capacity, decision, note },
			person
		);
		return { done: 'Your review is recorded.' };
	}
};
