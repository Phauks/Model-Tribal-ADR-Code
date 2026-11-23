import { fail } from '@sveltejs/kit';
import { tagColors, type TagColor } from '#lib/mail.ts';
import { mailContext } from '#lib/server/mail/runtime.ts';
import { createFolder, createTag, deleteFolder, deleteTag, OrganizeError, renameFolder, updateTag } from '#lib/server/mail/store.ts';
import { formText, requirePermission } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';

// Folders and tags for the project inbox (site/MAIL.md, "Folders, tags and
// rules"). The left column (../+layout.server.ts) loads both lists.
export const prerender = false;

export const load: PageServerLoad = async (event) => {
	requirePermission(event, 'manage-mail');
	return {};
};

function colorOf(form: FormData): TagColor {
	const color = formText(form, 'color', 20) as TagColor | null;
	return color && tagColors.includes(color) ? color : tagColors[0];
}

/** Runs a change and turns an OrganizeError into words on the page. */
async function attempt(work: () => Promise<string>) {
	try {
		return { done: await work() };
	} catch (problem) {
		if (problem instanceof OrganizeError) return fail(400, { problem: problem.message });
		throw problem;
	}
}

export const actions: Actions = {
	newFolder: async (event) => {
		const person = requirePermission(event, 'manage-mail');
		const form = await event.request.formData();
		const name = formText(form, 'name', 60);
		if (!name) return fail(400, { problem: 'Give the folder a name.' });
		return attempt(async () => {
			await createFolder(mailContext(), person.identifier, name, formText(form, 'parent', 100));
			return `Made the folder “${name}”.`;
		});
	},
	renameFolder: async (event) => {
		const person = requirePermission(event, 'manage-mail');
		const form = await event.request.formData();
		const folder = formText(form, 'folder', 100);
		const name = formText(form, 'name', 60);
		if (!folder || !name) return fail(400, { problem: 'Give the folder a name.' });
		return attempt(async () => {
			await renameFolder(mailContext(), person.identifier, folder, name);
			return `Renamed the folder to “${name}”.`;
		});
	},
	deleteFolder: async (event) => {
		const person = requirePermission(event, 'manage-mail');
		const form = await event.request.formData();
		const folder = formText(form, 'folder', 100);
		if (!folder) return fail(400, { problem: 'Choose a folder.' });
		const moved = await deleteFolder(mailContext(), person.identifier, folder);
		return { done: `Deleted the folder. ${moved} conversation${moved === 1 ? '' : 's'} went back to the inbox.` };
	},
	newTag: async (event) => {
		const person = requirePermission(event, 'manage-mail');
		const form = await event.request.formData();
		const name = formText(form, 'name', 60);
		if (!name) return fail(400, { problem: 'Give the tag a name.' });
		return attempt(async () => {
			await createTag(mailContext(), person.identifier, name, colorOf(form));
			return `Made the tag “${name}”.`;
		});
	},
	changeTag: async (event) => {
		const person = requirePermission(event, 'manage-mail');
		const form = await event.request.formData();
		const tag = formText(form, 'tag', 100);
		const name = formText(form, 'name', 60);
		if (!tag || !name) return fail(400, { problem: 'Give the tag a name.' });
		return attempt(async () => {
			await updateTag(mailContext(), person.identifier, tag, name, colorOf(form));
			return `Saved the tag “${name}”.`;
		});
	},
	deleteTag: async (event) => {
		const person = requirePermission(event, 'manage-mail');
		const form = await event.request.formData();
		const tag = formText(form, 'tag', 100);
		if (tag) await deleteTag(mailContext(), person.identifier, tag);
		return { done: 'Deleted the tag and took it off every conversation.' };
	}
};
