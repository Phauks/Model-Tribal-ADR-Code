import { fail } from '@sveltejs/kit';
import {
	approvalProblem,
	changeKinds,
	changeProblem,
	contactKinds,
	emptyContent,
	isEmptyContent,
	largestPicture,
	mostContacts,
	pictureTypes,
	readContent,
	statementSections,
	type ChangeContent,
	type ChangeKind,
	type NationPicture
} from '#lib/nation-page-changes.ts';
import { readableDate } from '#lib/readable-date.ts';
import {
	approveEarly,
	changeByIdentifier,
	discardChange,
	draftsOf,
	liveChanges,
	publishChange,
	publishDraft,
	savePicture,
	saveDraft,
	waitingChanges,
	type ChangeRow
} from '#lib/server/nation-page-changes.ts';
import { longestPauseText, pauseProblem } from '#lib/nation-page-review.ts';
import { teamAnswerOutcomes, type TeamAnswerOutcome } from '#lib/nation-team-reports.ts';
import { atLeastTeamLevel } from '#lib/nation-teams.ts';
import { answerPause, currentPause } from '#lib/server/nation-page-review.ts';
import { answerReport, reportsForTeam } from '#lib/server/nation-team-reports.ts';
import { nationAndGranter } from '#lib/server/nation-team-access.ts';
import { readFile } from '#lib/server/request-form.ts';
import { formText, refuse } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';

/** What the page needs to show a change, without the people's identifiers. */
function shown(change: ChangeRow) {
	return {
		identifier: change.identifier,
		kind: change.kind,
		content: change.content as ChangeContent,
		credit: change.credit,
		writtenBy: change.writtenBy,
		writtenByName: change.writtenByName,
		writtenAt: change.writtenAt,
		publishedByName: change.publishedByName,
		publishedAt: change.publishedAt,
		liveAt: change.liveAt
	};
}

export const load: PageServerLoad = async (event) => {
	const { nation, granter, database, person } = await nationAndGranter(event);
	const live = await liveChanges(database, nation.identifier);
	const drafts = await draftsOf(database, nation.identifier);
	const waiting = await waitingChanges(database, nation.identifier);
	const pause = await currentPause(database, nation.identifier);
	const allowed = Object.fromEntries(
		changeKinds.map((kind) => [
			kind,
			{
				draft: !changeProblem(granter, kind, 'draft'),
				publish: !changeProblem(granter, kind, 'publish') && !pauseProblem(Boolean(pause), kind)
			}
		])
	) as Record<ChangeKind, { draft: boolean; publish: boolean }>;
	// Each form starts from the person's own draft of that part, else the newest
	// change still waiting to go live, else what is live.
	const starting = Object.fromEntries(
		changeKinds.map((kind) => {
			const own = drafts.find((draft) => draft.kind === kind && draft.writtenBy === person.identifier);
			const newestWaiting = waiting.filter((change) => change.kind === kind).at(-1);
			const current = own ?? newestWaiting ?? live[kind];
			return [kind, { content: current?.content ?? emptyContent(kind), credit: current?.credit ?? null, fromDraft: Boolean(own) }];
		})
	) as Record<ChangeKind, { content: ChangeContent; credit: string | null; fromDraft: boolean }>;
	return {
		nation: { identifier: nation.identifier, title: nation.title, page: nation.page },
		allowed,
		starting,
		live: Object.fromEntries(Object.entries(live).map(([kind, change]) => [kind, shown(change)])),
		drafts: drafts.map((draft) => shown(draft)),
		waiting: waiting.map((change) => ({
			...shown(change),
			canApprove: !approvalProblem(granter, change) && !pause,
			// Cancelling takes something off, so a pause does not stop it.
			canCancel: !changeProblem(granter, change.kind, 'publish')
		})),
		personIdentifier: person.identifier,
		isAdministrator: granter.isAdministrator,
		contactRows: mostContacts,
		reports: await reportsForTeam(database, nation.identifier),
		canAnswer: granter.isAdministrator || Boolean(granter.level && atLeastTeamLevel(granter.level, 'editor')),
		pause: pause
			? { question: pause.question, pausedAt: pause.pausedAt, answer: pause.answer, answeredByName: pause.answeredByName, answeredAt: pause.answeredAt }
			: null
	};
};

/** Reads one part's fields from the edit form into raw content for readContent. */
async function rawContent(
	kind: ChangeKind,
	form: FormData,
	current: ChangeContent,
	upload: (file: NonNullable<Awaited<ReturnType<typeof readFile>>>) => Promise<string>,
	errors: Record<string, string>
): Promise<unknown> {
	switch (kind) {
		case 'about':
		case 'courts':
			return { text: formText(form, 'text') ?? '' };
		case 'statements':
			return {
				statements: Object.fromEntries(statementSections.map((section) => [section, formText(form, `statement-${section}`) ?? '']))
			};
		case 'contacts': {
			const contacts = [];
			for (let index = 0; index < mostContacts; index += 1) {
				const kindValue = formText(form, `contact-kind-${index}`);
				contacts.push({
					office: formText(form, `contact-office-${index}`, 200) ?? '',
					kind: contactKinds.includes(kindValue as (typeof contactKinds)[number]) ? kindValue : 'email',
					value: formText(form, `contact-value-${index}`, 500) ?? ''
				});
			}
			return { contacts };
		}
		case 'pictures': {
			// Pictures already on the page are kept unless unticked; their words can change.
			const known = new Map(((current as { pictures?: NationPicture[] }).pictures ?? []).map((picture) => [picture.identifier, picture]));
			const pictures: NationPicture[] = [];
			for (const identifier of form.getAll('picture')) {
				const picture = typeof identifier === 'string' ? known.get(identifier) : undefined;
				if (!picture || form.get(`keep-${picture.identifier}`) !== 'yes') continue;
				pictures.push({
					...picture,
					alt: formText(form, `alt-${picture.identifier}`, 500) ?? '',
					caption: formText(form, `caption-${picture.identifier}`, 500),
					credit: formText(form, `credit-${picture.identifier}`, 200)
				});
			}
			const file = await readFile(form, 'new-picture', errors);
			if (file) {
				if (!(pictureTypes as readonly string[]).includes(file.type)) {
					errors['new-picture'] = 'Pictures can be PNG, JPEG or WebP files.';
				} else if (file.bytes.byteLength > largestPicture) {
					errors['new-picture'] = 'A picture can be up to 5 MB.';
				} else {
					const alt = formText(form, 'new-alt', 500);
					if (!alt) {
						errors['new-alt'] = 'Describe the picture for people who cannot see it.';
					} else {
						pictures.push({
							identifier: await upload(file),
							alt,
							caption: formText(form, 'new-caption', 500),
							credit: formText(form, 'new-credit', 200),
							type: file.type
						});
					}
				}
			}
			return { pictures };
		}
		case 'hidden':
			return { sections: form.getAll('hide') };
	}
}

function when(liveAt: string): string {
	return readableDate(liveAt.slice(0, 10));
}

export const actions: Actions = {
	save: async (event) => {
		const { nation, granter, database, bucket, person } = await nationAndGranter(event);
		const form = await event.request.formData();
		const kind = formText(form, 'kind') as ChangeKind | null;
		if (!kind || !changeKinds.includes(kind)) return fail(400, { problem: 'Choose a part of the page.' });
		const intent = kind === 'hidden' || formText(form, 'intent') === 'publish' ? 'publish' : 'draft';
		const problem = changeProblem(granter, kind, intent);
		if (problem) {
			event.locals.refused = `nation page change refused on nation ${nation.identifier}: ${problem}`;
			return fail(403, { kind, problem });
		}
		const paused = intent === 'publish' ? pauseProblem(Boolean(await currentPause(database, nation.identifier)), kind) : undefined;
		if (paused) return fail(409, { kind, problem: paused });
		const credit = formText(form, 'credit', 200) || nation.title;
		const current = (await liveChanges(database, nation.identifier))[kind]?.content ?? emptyContent(kind);
		// Pictures in the person's own draft can be kept as well as those on the page.
		const drafts = await draftsOf(database, nation.identifier);
		const ownDraft = drafts.find((draft) => draft.kind === kind && draft.writtenBy === person.identifier);
		const base =
			kind === 'pictures' && ownDraft
				? { pictures: [...(current as { pictures: NationPicture[] }).pictures, ...(ownDraft.content as { pictures: NationPicture[] }).pictures] }
				: current;
		const errors: Record<string, string> = {};
		const raw = await rawContent(kind, form, base, (file) => savePicture(database, bucket, nation.identifier, file), errors);
		const { content, problem: contentProblem } = readContent(kind, raw);
		const firstError = Object.values(errors)[0];
		if (firstError || contentProblem) return fail(400, { kind, problem: firstError ?? contentProblem });

		if (intent === 'draft') {
			await saveDraft(database, { nationIdentifier: nation.identifier, kind, content, credit }, person);
			return { kind, done: 'Your draft is saved. An editor or steward for your nation can publish it.' };
		}
		const result = await publishChange(database, { nationIdentifier: nation.identifier, kind, content, credit }, person);
		// Publishing replaces the person's own draft of the same part.
		if (ownDraft) await discardChange(database, ownDraft, person);
		if (kind === 'hidden') {
			return { kind, done: isEmptyContent(kind, content) ? 'Nothing on the page is hidden now.' : 'Hidden. It is gone from the page now, and the project will follow up.' };
		}
		return {
			kind,
			done:
				result.liveAt > new Date().toISOString()
					? `Published. The new contacts go live on ${when(result.liveAt)}, unless another editor approves them sooner.`
					: 'Published. It is on the page now.'
		};
	},

	publishDraft: async (event) => {
		const { nation, granter, database, person } = await nationAndGranter(event);
		const form = await event.request.formData();
		const draft = await changeByIdentifier(database, formText(form, 'change', 40) ?? '');
		if (!draft || draft.nationIdentifier !== nation.identifier || draft.status !== 'draft') {
			return fail(404, { problem: 'That draft has already been published or thrown away.' });
		}
		const problem = changeProblem(granter, draft.kind, 'publish');
		if (problem) refuse(event, `nation page draft publish refused on nation ${nation.identifier}: ${problem}`);
		const paused = pauseProblem(Boolean(await currentPause(database, nation.identifier)), draft.kind);
		if (paused) return fail(409, { problem: paused });
		const result = await publishDraft(database, draft, person);
		return {
			done:
				result.liveAt > new Date().toISOString()
					? `Published. The new contacts go live on ${when(result.liveAt)}, unless another editor approves them sooner.`
					: 'Published. It is on the page now.'
		};
	},

	discard: async (event) => {
		const { nation, granter, database, person } = await nationAndGranter(event);
		const form = await event.request.formData();
		const change = await changeByIdentifier(database, formText(form, 'change', 40) ?? '');
		const waiting = change?.status === 'published' && (change.liveAt ?? '') > new Date().toISOString();
		if (!change || change.nationIdentifier !== nation.identifier || (change.status !== 'draft' && !waiting)) {
			return fail(404, { problem: 'That change is already live or gone.' });
		}
		// A person may throw away their own draft; an editor may throw away any, or cancel a waiting change.
		const own = change.status === 'draft' && change.writtenBy === person.identifier;
		const problem = own ? undefined : changeProblem(granter, change.kind, 'publish');
		if (problem) refuse(event, `nation page discard refused on nation ${nation.identifier}: ${problem}`);
		await discardChange(database, change, person);
		return { done: change.status === 'draft' ? 'The draft is thrown away.' : 'The waiting change is cancelled.' };
	},

	answer: async (event) => {
		const { nation, granter, database, person } = await nationAndGranter(event);
		if (!granter.isAdministrator && !(granter.level && atLeastTeamLevel(granter.level, 'editor'))) {
			refuse(event, `only an editor answers reports for nation ${nation.identifier}`);
		}
		const form = await event.request.formData();
		const report = (await reportsForTeam(database, nation.identifier)).find(
			(candidate) => candidate.reference === formText(form, 'reference', 40)
		);
		if (!report) return fail(404, { problem: 'That report is already closed.' });
		const outcome = formText(form, 'outcome') as TeamAnswerOutcome | null;
		if (!outcome || !teamAnswerOutcomes.includes(outcome)) return fail(400, { problem: 'Say whether you fixed it.' });
		await answerReport(database, { identifier: report.identifier, nationIdentifier: nation.identifier }, outcome, formText(form, 'note', 2000), person);
		return { done: `Thank you. The project sees your answer to report ${report.reference}.` };
	},

	approve: async (event) => {
		const { nation, granter, database, person } = await nationAndGranter(event);
		const form = await event.request.formData();
		const change = await changeByIdentifier(database, formText(form, 'change', 40) ?? '');
		if (!change || change.nationIdentifier !== nation.identifier || change.status !== 'published' || (change.liveAt ?? '') <= new Date().toISOString()) {
			return fail(404, { problem: 'That change is already live or gone.' });
		}
		const problem = approvalProblem(granter, change);
		if (problem) {
			event.locals.refused = `nation page approval refused on nation ${nation.identifier}: ${problem}`;
			return fail(403, { problem });
		}
		const paused = pauseProblem(Boolean(await currentPause(database, nation.identifier)), change.kind);
		if (paused) return fail(409, { problem: paused });
		await approveEarly(database, change, person);
		return { done: 'Approved. The new contacts are on the page now.' };
	},

	answerProject: async (event) => {
		const { nation, granter, database, person } = await nationAndGranter(event);
		if (!granter.isAdministrator && !(granter.level && atLeastTeamLevel(granter.level, 'editor'))) {
			refuse(event, `only an editor answers the project for nation ${nation.identifier}`);
		}
		const pause = await currentPause(database, nation.identifier);
		if (!pause) return fail(404, { problem: 'Publishing is no longer paused, so there is nothing to answer.' });
		const answer = formText(await event.request.formData(), 'answer', longestPauseText);
		if (!answer) return fail(400, { problem: 'Write your answer to the project.' });
		await answerPause(database, pause, answer, person);
		return { done: 'Thank you. The project sees your answer and will resume publishing or write back.' };
	}
};
