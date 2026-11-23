import { error } from '@sveltejs/kit';
import { profileBySubject } from '#lib/server/contributor-profiles.ts';
import { openScannedFile } from '#lib/server/file-scans.ts';
import { requireAccount, storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

/** The signed-in person's own picture, for their profile page, once the virus check passes (site/SCANNING.md). */
export const GET: RequestHandler = async (event) => {
	const account = requireAccount(event);
	const { database, bucket } = storage(event);
	const profile = await profileBySubject(database, account.subject);
	const opened = profile?.pictureKey ? await openScannedFile(database, bucket, profile.pictureKey) : null;
	if (!opened || opened.state !== 'ready') error(404, 'You have no picture.');
	const object = opened.object;
	return new Response(object.body as unknown as ReadableStream, {
		headers: {
			'content-type': 'image/jpeg',
			'cache-control': 'private, max-age=3600',
			'x-content-type-options': 'nosniff'
		}
	});
};
