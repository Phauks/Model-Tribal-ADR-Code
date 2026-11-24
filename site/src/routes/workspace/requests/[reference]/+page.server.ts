import { error, fail } from '@sveltejs/kit';
import { can } from '#lib/permissions.ts';
import {
	deadlinesOf,
	requestOutcomes,
	statusesFor,
	type RequestOutcome,
	type RequestStatus
} from '#lib/requests.ts';
import { forms } from 'virtual:forms';
import { activityHistoryFor } from '#lib/server/activity-log.ts';
import {
	formSubmissionsFor,
	isFilingIdentifier,
	nextFilingIdentifier,
	setFilingIdentifier
} from '#lib/server/form-submissions.ts';
import { isRequestReference } from '#lib/server/identifiers.ts';
import {
	addNote,
	changeStatus,
	reopenRequest,
	requestByReference,
	resolveRequest
} from '#lib/server/request-store.ts';
import { formText, requirePermission, storage } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';

async function findRequest(database: Parameters<typeof requestByReference>[0], reference: string) {
	if (!isRequestReference(reference)) error(404, 'No request has this reference.');
	const found = await requestByReference(database, reference);
	if (!found) error(404, 'No request has this reference.');
	return found;
}

export const load: PageServerLoad = async (event) => {
	const person = requirePermission(event, 'read-requests');
	const { database } = storage(event);
	const { request, sources } = await findRequest(database, event.params.reference);
	const submissions = (await formSubmissionsFor(database, request.identifier)).map((submission) => {
		const template = forms.find((form) => form.slug === submission.form);
		return {
			identifier: submission.identifier,
			title: template?.title ?? submission.form,
			version: submission.formVersion,
			method: submission.method,
			signedName: submission.signedName,
			filingIdentifier: submission.filingIdentifier,
			receivedAt: submission.receivedAt,
			hasCopy: submission.filledCopyKey !== null,
			// The site still has the exact version signed, so the filled form can be shown as a page.
			canShow: submission.answers !== null && template?.checksum === submission.formChecksum
		};
	});
	return {
		request,
		sources,
		submissions,
		nextFiling: submissions.length > 0 ? await nextFilingIdentifier(database) : null,
		deadlines: deadlinesOf(request),
		history: await activityHistoryFor(database, 'request', request.identifier),
		statuses: statusesFor(request.kind).filter((status) => status !== 'resolved'),
		canHandle: can(person, 'handle-requests')
	};
};

export const actions: Actions = {
	status: async (event) => {
		const person = requirePermission(event, 'handle-requests');
		const { database } = storage(event);
		const { request } = await findRequest(database, event.params.reference);
		const form = await event.request.formData();
		const status = formText(form, 'status') as RequestStatus | null;
		if (!status || status === 'resolved' || !statusesFor(request.kind).includes(status)) {
			return fail(400, { problem: 'Choose a status that applies to this kind of request.' });
		}
		if (request.status === 'resolved') {
			return fail(400, { problem: 'This request is resolved. Reopen it first.' });
		}
		await changeStatus(database, request, status, formText(form, 'note'), person);
		return { done: 'Status changed.' };
	},

	resolve: async (event) => {
		const person = requirePermission(event, 'handle-requests');
		const { database } = storage(event);
		const { request } = await findRequest(database, event.params.reference);
		const form = await event.request.formData();
		const outcome = formText(form, 'outcome') as RequestOutcome | null;
		if (!outcome || !requestOutcomes.includes(outcome)) {
			return fail(400, { problem: 'Choose an outcome.' });
		}
		const reason = formText(form, 'reason');
		if (outcome === 'declined' && !reason) {
			return fail(400, {
				problem:
					'A declined request needs the reasons given to the requester: which part of the rule was not met, the sources checked, and what would meet it.'
			});
		}
		await resolveRequest(database, request, outcome, reason, person);
		return { done: 'Request resolved. Remember to tell the requester.' };
	},

	reopen: async (event) => {
		const person = requirePermission(event, 'handle-requests');
		const { database } = storage(event);
		const { request } = await findRequest(database, event.params.reference);
		if (request.status !== 'resolved') return fail(400, { problem: 'This request is already open.' });
		await reopenRequest(database, request, formText(await event.request.formData(), 'note'), person);
		return { done: 'Request reopened.' };
	},

	filing: async (event) => {
		const person = requirePermission(event, 'handle-requests');
		const { database } = storage(event);
		const { request } = await findRequest(database, event.params.reference);
		const filing = (formText(await event.request.formData(), 'filing') ?? '').toLowerCase();
		if (!isFilingIdentifier(filing)) {
			return fail(400, { problem: 'A filing number looks like filing-2026-0001.' });
		}
		if ((await formSubmissionsFor(database, request.identifier)).length === 0) {
			return fail(400, { problem: 'This request came with no form.' });
		}
		await setFilingIdentifier(database, request, filing, person);
		return { done: `Forms filed under ${filing}.` };
	},

	note: async (event) => {
		const person = requirePermission(event, 'handle-requests');
		const { database } = storage(event);
		const { request } = await findRequest(database, event.params.reference);
		const note = formText(await event.request.formData(), 'note');
		if (!note) return fail(400, { problem: 'Write a note first.' });
		await addNote(database, request, note, person);
		return { done: 'Note added.' };
	}
};
