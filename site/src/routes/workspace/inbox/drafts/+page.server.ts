import { mailContext } from '#lib/server/mail/runtime.ts';
import { deleteDraft, listDrafts } from '#lib/server/mail/writing.ts';
import { formText, requirePermission } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';

// The person's own drafts: messages and replies they started and have not
// sent. Each is saved as they type (src/routes/workspace/inbox/Composer.svelte).
export const prerender = false;

export const load: PageServerLoad = async (event) => {
	const person = requirePermission(event, 'read-mail');
	return { drafts: await listDrafts(mailContext(), person.identifier) };
};

export const actions: Actions = {
	discard: async (event) => {
		const person = requirePermission(event, 'read-mail');
		const form = await event.request.formData();
		const identifier = formText(form, 'identifier', 100);
		if (identifier) await deleteDraft(mailContext(), person.identifier, { identifier });
		return { done: 'Discarded the draft.' };
	}
};
