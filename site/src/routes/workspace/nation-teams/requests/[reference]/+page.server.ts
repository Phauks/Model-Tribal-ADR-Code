import { error, fail } from '@sveltejs/kit';
import { reviewSubjects } from 'virtual:review-subjects';
import {
	dateAsTermEnd,
	pageParts,
	placeProblem,
	teamLevels,
	termEnd,
	usualTerm,
	type PagePart,
	type TeamLevel
} from '#lib/nation-teams.ts';
import {
	applicationByReference,
	confirmApplication,
	declineApplication,
	markConfirming,
	teamOf
} from '#lib/server/nation-teams.ts';
import { formText, requirePermission, storage } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

async function application(event: RequestEvent | Parameters<PageServerLoad>[0]) {
	const { database } = storage(event);
	const found = await applicationByReference(database, event.params.reference);
	if (!found) error(404, 'No such request.');
	return found;
}

export const load: PageServerLoad = async (event) => {
	requirePermission(event, 'manage-people');
	const { database } = storage(event);
	const found = await application(event);
	const nation = reviewSubjects.find(
		(subject) => subject.kind === 'nation' && subject.identifier === found.nationIdentifier
	);
	return {
		application: found,
		nationTitle: nation?.title ?? found.nationIdentifier,
		nationPage: nation?.page ?? null,
		team: await teamOf(database, found.nationIdentifier),
		usualEnd: termEnd(usualTerm.steward).slice(0, 10)
	};
};

const open = new Set(['received', 'confirming-with-nation']);

export const actions: Actions = {
	confirming: async (event) => {
		const lead = requirePermission(event, 'manage-people');
		const { database } = storage(event);
		const found = await application(event);
		if (!open.has(found.status)) return fail(400, { problem: 'This request is already answered.' });
		const form = await event.request.formData();
		const contact = formText(form, 'contact', 500);
		if (!contact) return fail(400, { problem: 'Say which of the nation’s listed contacts you wrote to.' });
		if (formText(form, 'listed') !== 'yes') {
			return fail(400, {
				problem: 'Confirm that the contact was already listed for the nation, not given by the person asking.'
			});
		}
		await markConfirming(database, found, contact, lead);
		return { done: 'Recorded. Confirm or decline the request once the office answers.' };
	},

	confirm: async (event) => {
		const lead = requirePermission(event, 'manage-people');
		const { database } = storage(event);
		const found = await application(event);
		if (!open.has(found.status)) return fail(400, { problem: 'This request is already answered.' });
		const form = await event.request.formData();
		const level = formText(form, 'level') as TeamLevel | null;
		if (!level || !teamLevels.includes(level)) return fail(400, { problem: 'Choose a level.' });
		const parts =
			formText(form, 'scope') === 'parts'
				? form.getAll('parts').filter((part): part is PagePart => pageParts.includes(part as PagePart))
				: null;
		const expiresAt = dateAsTermEnd(formText(form, 'expires', 10));
		if (!expiresAt) return fail(400, { problem: 'Give the end date as a date.' });
		const basis = formText(form, 'basis', 500);
		if (!basis) {
			return fail(400, {
				problem: 'Say how the nation confirmed it, for example "Letter of Nov. 18, 2026, confirmed by the Office of the President by email on Nov. 20".'
			});
		}
		const problem = placeProblem({ isAdministrator: true }, { level, parts, expiresAt });
		if (problem) return fail(400, { problem });
		const result = await confirmApplication(database, found, { level, parts, expiresAt, basis }, lead);
		if (result.outcome === 'removed-person') {
			return fail(400, { problem: 'This person’s access was removed earlier. Restore them on the People page first.' });
		}
		return { done: `Confirmed. ${found.displayName} is on the team.` };
	},

	decline: async (event) => {
		const lead = requirePermission(event, 'manage-people');
		const { database } = storage(event);
		const found = await application(event);
		if (!open.has(found.status)) return fail(400, { problem: 'This request is already answered.' });
		const form = await event.request.formData();
		const reason = formText(form, 'reason', 1000);
		if (!reason) return fail(400, { problem: 'Give the reason; the person sees it.' });
		await declineApplication(database, found, reason, lead);
		return { done: 'Declined. The person sees the reason on their page.' };
	}
};
