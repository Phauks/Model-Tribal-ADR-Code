import { fail, redirect } from '@sveltejs/kit';
import { reviewSubjects } from 'virtual:review-subjects';
import { readProfileForm } from '#lib/server/contributor-form.ts';
import { currentYear, profileBySubject, saveAnswers } from '#lib/server/contributor-profiles.ts';
import { checkDocument, removeDocument, saveDocument } from '#lib/server/profile-documents.ts';
import { cleanJpeg, pictureSide, removePicture, savePicture } from '#lib/server/profile-pictures.ts';
import { requireAccount, storage } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';

/** Every nation in the project's list, to pick from; "Not on the list" takes any other name. */
const nations = reviewSubjects
	.filter((subject) => subject.kind === 'nation')
	.map((subject) => ({ identifier: subject.identifier, title: subject.title }))
	.sort((first, second) => first.title.localeCompare(second.title, 'en-US'));

/** Rows the "Add" buttons make when scripts are off: the form is saved and comes back with one more empty row. */
const addable = ['name', 'email', 'phone', 'nation', 'language'] as const;

export const load: PageServerLoad = ({ url }) => ({
	nationChoices: nations.map((nation) => ({ value: nation.identifier, label: nation.title })),
	pictureSide,
	year: currentYear(),
	add: (addable as readonly string[]).includes(url.searchParams.get('add') ?? '') ? url.searchParams.get('add') : null
});

export const actions: Actions = {
	default: async (event) => {
		const account = requireAccount(event);
		const { database, bucket } = storage(event);
		const form = await event.request.formData();
		const year = currentYear();

		// A Remove button without scripts names the row to leave out of what is saved.
		const remove = form.get('remove');
		if (typeof remove === 'string' && /^(name|contact|nation|language)-[A-Za-z0-9]{1,12}$/.test(remove)) {
			const [kind, key] = remove.split('-');
			const kept = form.getAll(`${kind}Row`).filter((value) => value !== key);
			form.delete(`${kind}Row`);
			for (const value of kept) form.append(`${kind}Row`, value);
		}

		const result = readProfileForm(form, nations, account.email, year);
		if (!result.ok) {
			// Nothing is saved while an answer has a problem, so a file sent with it has to be chosen again.
			const errors = { ...result.errors };
			const sent = (name: string) => {
				const file = form.get(name);
				return file instanceof File && file.size > 0;
			};
			if (sent('picture')) errors.picture = 'Choose the picture again. It was not saved because of the problem below.';
			if (sent('curriculumVitae')) errors.curriculumVitae = 'Choose the file again. It was not saved because of the problem above.';
			return fail(400, { errors, answers: result.answers });
		}
		await saveAnswers(database, account, result.answers);

		// Files go after the answers, so a first save has a profile to hold them.
		const profile = (await profileBySubject(database, account.subject))!;
		const errors: Record<string, string> = {};
		if (form.get('removePicture') === 'yes') await removePicture(database, bucket, profile);
		const picture = form.get('picture');
		if (picture instanceof File && picture.size > 0) {
			if (profile.answers.ageGroup !== '18-or-older') errors.picture = 'Pictures are for people 18 or older.';
			else {
				const cleaned = cleanJpeg(new Uint8Array(await picture.arrayBuffer()));
				if (cleaned.ok) await savePicture(database, bucket, profile, cleaned.bytes);
				else errors.picture = cleaned.message;
			}
		}
		if (form.get('removeCurriculumVitae') === 'yes') await removeDocument(database, bucket, profile);
		const document = form.get('curriculumVitae');
		if (document instanceof File && document.size > 0) {
			const checked = checkDocument(document);
			if (checked.ok) await saveDocument(database, bucket, profile, document, checked);
			else errors.curriculumVitae = checked.message;
		}
		if (Object.keys(errors).length > 0) return fail(400, { errors, answers: result.answers });

		const add = form.get('add');
		if (typeof add === 'string' && (addable as readonly string[]).includes(add)) redirect(303, `/profile/edit?add=${add}#${add === 'email' || add === 'phone' ? 'contact' : add}-rows`);
		if (typeof remove === 'string' && remove) redirect(303, '/profile/edit');
		redirect(303, form.get('next') === 'review' ? '/profile/review' : '/profile?saved=1');
	}
};
