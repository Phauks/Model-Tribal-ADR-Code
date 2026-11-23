import { error } from '@sveltejs/kit';
import { profileBySubject } from '#lib/server/contributor-profiles.ts';
import { requireAccount, storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

/** The signed-in person's own picture, for their profile page. */
export const GET: RequestHandler = async (event) => {
	const account = requireAccount(event);
	const { database, bucket } = storage(event);
	const profile = await profileBySubject(database, account.subject);
	const object = profile?.pictureKey ? await bucket.get(profile.pictureKey) : null;
	if (!object) error(404, 'You have no picture.');
	return new Response(object.body as unknown as ReadableStream, {
		headers: {
			'content-type': 'image/jpeg',
			'cache-control': 'private, max-age=3600',
			'x-content-type-options': 'nosniff'
		}
	});
};
