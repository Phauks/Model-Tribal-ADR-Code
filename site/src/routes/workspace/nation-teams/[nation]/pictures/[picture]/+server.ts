/**
 * Shows a nation's team any picture its changes have named, including drafts
 * and earlier versions, so they can see what they are publishing. Readers
 * see only the live pictures, at /nations/<id>/pictures/<picture>.
 */
import { error } from '@sveltejs/kit';
import { pictureKey } from '#lib/nation-page-changes.ts';
import { picturesEverNamed } from '#lib/server/nation-page-changes.ts';
import { nationAndGranter } from '#lib/server/nation-team-access.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const { nation, database, bucket } = await nationAndGranter(event);
	const picture = (await picturesEverNamed(database, nation.identifier)).find(
		(candidate) => candidate.identifier === event.params.picture
	);
	const stored = picture ? await bucket.get(pictureKey(nation.identifier, picture.identifier)) : null;
	if (!picture || !stored) error(404, 'No such picture.');
	return new Response(await stored.arrayBuffer(), {
		headers: {
			'Content-Type': picture.type,
			'Cache-Control': 'private, no-store',
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
