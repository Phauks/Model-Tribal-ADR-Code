import { error, fail, type ActionFailure } from '@sveltejs/kit';
import { isUploadReference } from '#lib/uploads.ts';
import { activityHistoryFor } from '#lib/server/activity-log.ts';
import { scanStatusWords } from '#lib/server/file-scans.ts';
import { looksLikeNation } from '#lib/server/upload-requests.ts';
import {
	addUploadMessage,
	advanceCheckedUploads,
	checkAgain,
	claimUpload,
	declineUpload,
	fileUpload,
	keepForReference,
	readFiling,
	releaseUnchecked,
	reopenUpload,
	scansOf,
	UploadProblem,
	uploadByReference,
	uploadDetail,
	waitForNation,
	type FilingErrors,
	type UploadRow
} from '#lib/server/uploads.ts';
import type { SignedInPerson } from '#lib/server/people.ts';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import { formText, requirePermission, storage } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

export const load: PageServerLoad = async (event) => {
	requirePermission(event, 'review-uploads');
	const { database, bucket } = storage(event);
	if (!isUploadReference(event.params.reference)) error(404, 'There is no such upload.');
	const found = await uploadByReference(database, event.params.reference);
	if (found?.status === 'checking') await advanceCheckedUploads(database, bucket, { uploadIdentifier: found.identifier });
	const detail = await uploadDetail(database, event.params.reference);
	if (!detail) error(404, 'There is no such upload.');
	return {
		...detail,
		scans: (await scansOf(database, detail.upload)).map((scan) => ({
			status: scan?.status ?? null,
			...scanStatusWords(scan)
		})),
		history: await activityHistoryFor(database, 'upload', detail.upload.identifier)
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
		bucket: R2Bucket;
		person: SignedInPerson;
		upload: UploadRow;
		form: FormData;
	}) => Promise<void | ActionFailure<Refusal>>
): Promise<Outcome> {
	const person = requirePermission(event, 'review-uploads');
	const { database, bucket } = storage(event);
	const upload = await uploadByReference(database, event.params.reference);
	if (!upload) error(404, 'There is no such upload.');
	const form = await event.request.formData();
	try {
		const result = await step({ database, bucket, person, upload, form });
		return result ?? { done: true as const };
	} catch (problem) {
		if (problem instanceof UploadProblem) return fail(problem.status, { problem: problem.message });
		throw problem;
	}
}

export const actions: Actions = {
	release: (event) =>
		act(event, async ({ database, bucket, person, upload, form }) => {
			const note = formText(form, 'note', 1000);
			if (!note) return fail(400, { problem: 'Say why it is safe to release this file without a virus check.' });
			await releaseUnchecked(database, bucket, person, upload, note);
		}),
	'check-again': (event) => act(event, ({ database, person, upload }) => checkAgain(database, person, upload)),
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
