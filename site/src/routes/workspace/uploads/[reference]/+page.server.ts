import { error, fail, type ActionFailure } from '@sveltejs/kit';
import { isUploadReference } from '#lib/uploads.ts';
import { eventsFor } from '#lib/server/events.ts';
import { looksLikeNation } from '#lib/server/upload-requests.ts';
import {
	addUploadMessage,
	claimUpload,
	declineUpload,
	fileUpload,
	keepForReference,
	readFiling,
	reopenUpload,
	UploadProblem,
	uploadByReference,
	uploadDetail,
	waitForNation,
	type FilingErrors,
	type UploadRow
} from '#lib/server/uploads.ts';
import type { SignedInPerson } from '#lib/server/people.ts';
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { formText, requirePermission, storage } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

export const load: PageServerLoad = async (event) => {
	requirePermission(event, 'review-uploads');
	const { database } = storage(event);
	if (!isUploadReference(event.params.reference)) error(404, 'There is no such upload.');
	const detail = await uploadDetail(database, event.params.reference);
	if (!detail) error(404, 'There is no such upload.');
	return {
		...detail,
		history: await eventsFor(database, 'upload', detail.upload.identifier)
	};
};

interface Refusal {
	problem: string;
	filingErrors?: FilingErrors;
}

type Outcome = ActionFailure<Refusal> | { done: true };

/** Runs one reviewer action on the upload in the address, answering a refusal on the page. */
async function act(
	event: RequestEvent,
	step: (context: {
		database: D1Database;
		person: SignedInPerson;
		upload: UploadRow;
		form: FormData;
	}) => Promise<void | ActionFailure<Refusal>>
): Promise<Outcome> {
	const person = requirePermission(event, 'review-uploads');
	const { database } = storage(event);
	const upload = await uploadByReference(database, event.params.reference);
	if (!upload) error(404, 'There is no such upload.');
	const form = await event.request.formData();
	try {
		const result = await step({ database, person, upload, form });
		return result ?? { done: true as const };
	} catch (problem) {
		if (problem instanceof UploadProblem) return fail(problem.status, { problem: problem.message });
		throw problem;
	}
}

export const actions: Actions = {
	claim: (event) => act(event, ({ database, person, upload }) => claimUpload(database, person, upload)),
	question: (event) =>
		act(event, async ({ database, person, upload, form }) => {
			const body = formText(form, 'question', 4000);
			if (!body) return fail(400, { problem: 'Write the question.'});
			await addUploadMessage(database, person, upload, 'question', body);
		}),
	note: (event) =>
		act(event, async ({ database, person, upload, form }) => {
			const body = formText(form, 'note', 4000);
			if (!body) return fail(400, { problem: 'Write the note.'});
			await addUploadMessage(database, person, upload, 'note', body);
		}),
	nation: (event) => act(event, ({ database, person, upload }) => waitForNation(database, person, upload)),
	file: (event) =>
		act(event, async ({ database, person, upload, form }) => {
			const read = readFiling(form, looksLikeNation);
			if (!read.ok) return fail(400, { problem: 'Check the filing details.', filingErrors: read.errors });
			await fileUpload(database, person, upload, read.filing);
		}),
	keep: (event) =>
		act(event, ({ database, person, upload, form }) =>
			keepForReference(database, person, upload, formText(form, 'reason', 2000))
		),
	decline: (event) =>
		act(event, async ({ database, person, upload, form }) => {
			const reason = formText(form, 'reason', 2000);
			if (!reason) return fail(400, { problem: 'Give the reason the sender will see.'});
			await declineUpload(database, person, upload, reason);
		}),
	reopen: (event) => act(event, ({ database, person, upload }) => reopenUpload(database, person, upload))
};
