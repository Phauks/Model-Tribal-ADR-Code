import { fail, redirect } from '@sveltejs/kit';
import { profileBySubject } from '#lib/server/contributor-profiles.ts';
import { cleanJpeg, pictureSide, removePicture, savePicture } from '#lib/server/profile-pictures.ts';
import { requireAccount, storage } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => ({
	confirmed: url.searchParams.has('confirmed'),
	pictureSide
});

export const actions: Actions = {
	/** Adds or changes the profile picture (docs/contributor-profiles.md, "Profile pictures"). */
	picture: async (event) => {
		const account = requireAccount(event);
		const { database, bucket } = storage(event);
		const profile = await profileBySubject(database, account.subject);
		if (!profile) return fail(400, { pictureProblem: 'Start your profile before adding a picture.' });
		if (profile.answers.ageGroup !== '18-or-older') {
			return fail(400, { pictureProblem: 'Pictures are for people 18 or older.' });
		}
		const file = (await event.request.formData()).get('picture');
		if (!(file instanceof File) || file.size === 0) return fail(400, { pictureProblem: 'Choose a picture.' });
		const cleaned = cleanJpeg(new Uint8Array(await file.arrayBuffer()));
		if (!cleaned.ok) return fail(400, { pictureProblem: cleaned.message });
		await savePicture(database, bucket, profile, cleaned.bytes);
		redirect(303, '/profile?picture=saved#picture-heading');
	},
	removePicture: async (event) => {
		const account = requireAccount(event);
		const { database, bucket } = storage(event);
		const profile = await profileBySubject(database, account.subject);
		if (profile) await removePicture(database, bucket, profile);
		redirect(303, '/profile?picture=removed#picture-heading');
	}
};
