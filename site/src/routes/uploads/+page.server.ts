import { fail } from '@sveltejs/kit';
import { isUploadReference } from '#lib/uploads.ts';
import { answerQuestion, ownUpload, UploadProblem, uploadsOfAccount, withdrawUpload } from '#lib/server/uploads.ts';
import { formText, requireAccount, storage } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

export const load: PageServerLoad = async (event) => {
	const account = requireAccount(event);
	const { database } = storage(event);
	return {
		uploads: await uploadsOfAccount(database, account.subject),
		sent: event.url.searchParams.get('sent')
	};
};

async function chosenUpload(event: RequestEvent, form: FormData) {
	const account = requireAccount(event);
	const { database, bucket } = storage(event);
	const reference = formText(form, 'reference', 40) ?? '';
	const upload = isUploadReference(reference) ? await ownUpload(database, account.subject, reference) : null;
	return { database, bucket, reference, upload };
}

export const actions: Actions = {
	withdraw: async (event) => {
		const form = await event.request.formData();
		const { database, bucket, reference, upload } = await chosenUpload(event, form);
		if (!upload) return fail(404, { reference, problem: 'There is no such upload.' });
		try {
			await withdrawUpload(database, bucket, upload);
		} catch (problem) {
			if (problem instanceof UploadProblem) return fail(problem.status, { reference, problem: problem.message });
			throw problem;
		}
		return { reference, done: 'withdrawn' };
	},
	answer: async (event) => {
		const form = await event.request.formData();
		const { database, reference, upload } = await chosenUpload(event, form);
		if (!upload) return fail(404, { reference, problem: 'There is no such upload.' });
		const body = formText(form, 'answer', 4000);
		if (!body) return fail(400, { reference, problem: 'Write your answer.' });
		try {
			await answerQuestion(database, upload, body);
		} catch (problem) {
			if (problem instanceof UploadProblem) return fail(problem.status, { reference, problem: problem.message });
			throw problem;
		}
		return { reference, done: 'answered' };
	}
};
