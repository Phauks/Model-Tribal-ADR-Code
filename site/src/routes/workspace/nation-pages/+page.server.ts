import { fail } from '@sveltejs/kit';
import { reviewSubjects } from 'virtual:review-subjects';
import { changeKindLabels, describeChange, type ChangeContent } from '#lib/nation-page-changes.ts';
import { isOverdue, longestPauseText, reviewDue } from '#lib/nation-page-review.ts';
import { displayName } from '#lib/nation-labels.ts';
import { isAdministrator } from '#lib/permissions.ts';
import { changeByIdentifier, historiesOf, type ChangeRow } from '#lib/server/nation-page-changes.ts';
import {
	currentPause,
	currentPauses,
	markRead,
	pausePublishing,
	recentReviews,
	resumePublishing,
	reviewQueue,
	undoChange
} from '#lib/server/nation-page-review.ts';
import { suspendWithEveryoneAdded, teamOf, teamsOf } from '#lib/server/nation-teams.ts';
import { formText, refuse, requirePermission, storage } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';

/**
 * The project's review of what nations publish on their own pages (decision
 * record 0041, "Stage 3"). Nations' changes are live before anyone here sees
 * them; the project reads each within seven days and can undo it, pause the
 * nation's publishing to ask a question, or suspend the person who published it.
 */

function nationOf(identifier: string) {
	const subject = reviewSubjects.find((candidate) => candidate.kind === 'nation' && candidate.identifier === identifier);
	return { identifier, title: subject ? displayName(subject.title) : identifier, page: subject?.page ?? null };
}

/** "the Navajo Nation", but not "the The …". */
function the(title: string): string {
	return /^the\s/i.test(title) ? title : `the ${title}`;
}

function shown(change: ChangeRow, time: Date) {
	return {
		identifier: change.identifier,
		nation: nationOf(change.nationIdentifier),
		kind: change.kind,
		content: change.content as ChangeContent,
		summary: describeChange(change.kind, change.content),
		credit: change.credit,
		writtenByName: change.writtenByName,
		publishedByName: change.publishedByName,
		approvedByName: change.approvedByName,
		publishedAt: change.publishedAt ?? change.writtenAt,
		liveAt: change.liveAt,
		waiting: (change.liveAt ?? '') > time.toISOString(),
		restored: Boolean(change.restoredFrom),
		due: reviewDue(change.publishedAt ?? change.writtenAt),
		overdue: isOverdue(change.publishedAt ?? change.writtenAt, time)
	};
}

export const load: PageServerLoad = async (event) => {
	const person = requirePermission(event, 'review-nation-pages');
	const { database } = storage(event);
	const time = new Date();
	const queue = await reviewQueue(database);
	// Each nation's team, to name the publisher's level and, for the lead author, who could be suspended;
	// and each nation's history, to show each change beside the version before it.
	// One query each for every nation in the queue, instead of two for each nation.
	const nations = [...new Set(queue.map((change) => change.nationIdentifier))];
	const [teams, histories] = await Promise.all([teamsOf(database, nations), historiesOf(database, nations)]);
	/** The version of the same part published before this change, if any. */
	const before = (change: ChangeRow): ChangeContent | null => {
		const history = histories.get(change.nationIdentifier) ?? [];
		const index = history.findIndex((candidate) => candidate.identifier === change.identifier);
		const earlier = history.slice(index + 1).find((candidate) => candidate.kind === change.kind && candidate.status === 'published');
		return earlier ? (earlier.content as ChangeContent) : null;
	};
	const pauses = await currentPauses(database);
	return {
		queue: queue.map((change) => ({
			...shown(change, time),
			before: before(change),
			publishedByLevel: teams.get(change.nationIdentifier)?.find((place) => place.personIdentifier === change.publishedBy)?.level ?? null,
			paused: pauses.some((pause) => pause.nationIdentifier === change.nationIdentifier),
			canSuspend:
				isAdministrator(person) &&
				Boolean(teams.get(change.nationIdentifier)?.some((place) => place.personIdentifier === change.publishedBy))
		})),
		pauses: pauses.map((pause) => ({ ...pause, nation: nationOf(pause.nationIdentifier) })),
		recent: (await recentReviews(database)).map((review) => ({
			...shown(review.change, time),
			outcome: review.outcome,
			note: review.note,
			reviewedByName: review.reviewedByName,
			reviewedAt: review.reviewedAt
		}))
	};
};

/** The change named in the form, if it still waits for the project. */
async function waitingChange(database: Parameters<typeof reviewQueue>[0], form: FormData): Promise<ChangeRow | undefined> {
	const identifier = formText(form, 'change', 40) ?? '';
	const change = await changeByIdentifier(database, identifier);
	if (!change || change.status !== 'published') return undefined;
	return (await reviewQueue(database)).some((candidate) => candidate.identifier === identifier) ? change : undefined;
}

export const actions: Actions = {
	read: async (event) => {
		const person = requirePermission(event, 'review-nation-pages');
		const { database } = storage(event);
		const form = await event.request.formData();
		const change = await waitingChange(database, form);
		if (!change) return fail(404, { problem: 'Someone has already looked at that change.' });
		await markRead(database, change, person, formText(form, 'note', longestPauseText));
		return { done: `Marked read: ${changeKindLabels[change.kind]} on the page of ${the(nationOf(change.nationIdentifier).title)}.` };
	},

	undo: async (event) => {
		const person = requirePermission(event, 'review-nation-pages');
		const { database } = storage(event);
		const form = await event.request.formData();
		const change = await waitingChange(database, form);
		if (!change) return fail(404, { problem: 'Someone has already looked at that change.' });
		const note = formText(form, 'note', longestPauseText);
		if (!note) return fail(400, { change: change.identifier, problem: 'Say why, for the nation’s team. They see your note in their history.' });
		await undoChange(database, change, person, note);
		return { done: `Undone. The page of ${the(nationOf(change.nationIdentifier).title)} is back to the version before.` };
	},

	pause: async (event) => {
		const person = requirePermission(event, 'review-nation-pages');
		const { database } = storage(event);
		const form = await event.request.formData();
		const nation = nationOf(formText(form, 'nation', 200) ?? '');
		if (!reviewSubjects.some((subject) => subject.kind === 'nation' && subject.identifier === nation.identifier)) {
			return fail(404, { problem: 'No such nation.' });
		}
		const question = formText(form, 'question', longestPauseText);
		if (!question) return fail(400, { nation: nation.identifier, problem: 'Write the question the nation’s team should answer.' });
		const paused = await pausePublishing(database, nation.identifier, question, person);
		if (!paused) return fail(409, { problem: `Publishing for ${the(nation.title)} is already paused.` });
		return { done: `Publishing for ${the(nation.title)} is paused. The team sees your question on its edit page.` };
	},

	resume: async (event) => {
		const person = requirePermission(event, 'review-nation-pages');
		const { database } = storage(event);
		const nation = nationOf(formText(await event.request.formData(), 'nation', 200) ?? '');
		const pause = await currentPause(database, nation.identifier);
		if (!pause) return fail(404, { problem: `Publishing for ${the(nation.title)} is not paused.` });
		await resumePublishing(database, pause, person);
		return { done: `Publishing for ${the(nation.title)} has resumed.` };
	},

	suspend: async (event) => {
		const person = requirePermission(event, 'review-nation-pages');
		if (!isAdministrator(person)) refuse(event, 'only the lead author suspends people from a nation’s team');
		const { database } = storage(event);
		const change = await changeByIdentifier(database, formText(await event.request.formData(), 'change', 40) ?? '');
		const place = change ? (await teamOf(database, change.nationIdentifier)).find((candidate) => candidate.personIdentifier === change.publishedBy) : undefined;
		if (!change || !place) return fail(404, { problem: 'That person is no longer on the nation’s team.' });
		const names = await suspendWithEveryoneAdded(database, place, person);
		return { done: `Suspended: ${names.join(', ')}. Undo their changes here if they should come off the page.` };
	}
};
