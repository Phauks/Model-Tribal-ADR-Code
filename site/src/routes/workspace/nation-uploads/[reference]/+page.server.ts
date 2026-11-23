import { error, fail } from '@sveltejs/kit';
import { isUploadReference } from '#lib/uploads.ts';
import { addNationComment, nationUpload, UploadProblem } from '#lib/server/uploads.ts';
import { formText, requirePermission, storage } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const person = requirePermission(event, 'comment-on-nation-uploads');
	const { database } = storage(event);
	if (!isUploadReference(event.params.reference)) error(404, 'There is no such file.');
	const found = await nationUpload(database, person, event.params.reference);
	if (!found) error(404, 'There is no such file about your nation.');
	return found;
};

export const actions: Actions = {
	comment: async (event) => {
		const person = requirePermission(event, 'comment-on-nation-uploads');
		const { database } = storage(event);
		if (!isUploadReference(event.params.reference)) error(404, 'There is no such file.');
		const found = await nationUpload(database, person, event.params.reference);
		if (!found) error(404, 'There is no such file about your nation.');
		const body = formText(await event.request.formData(), 'comment', 4000);
		if (!body) return fail(400, { problem: 'Write the comment.' });
		try {
			await addNationComment(database, person, found.upload, body);
		} catch (problem) {
			if (problem instanceof UploadProblem) return fail(problem.status, { problem: problem.message });
			throw problem;
		}
		return { done: true as const };
	}
};
