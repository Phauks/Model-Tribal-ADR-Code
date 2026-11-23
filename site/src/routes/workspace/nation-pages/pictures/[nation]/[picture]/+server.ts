/**
 * Shows the project any picture a nation's changes have named, so it can
 * review pictures before or after they go live. Readers see only the live
 * pictures, at /nations/<id>/pictures/<picture>.
 */
import { error } from '@sveltejs/kit';
import { pictureKey } from '#lib/nation-page-changes.ts';
import { picturesEverNamed } from '#lib/server/nation-page-changes.ts';
import { requirePermission, storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	requirePermission(event, 'review-nation-pages');
	const { database, bucket } = storage(event);
	const { nation, picture: identifier } = event.params;
	const picture = (await picturesEverNamed(database, nation)).find((candidate) => candidate.identifier === identifier);
	const stored = picture ? await bucket.get(pictureKey(nation, picture.identifier)) : null;
	if (!picture || !stored) error(404, 'No such picture.');
	return new Response(await stored.arrayBuffer(), {
		headers: {
			'Content-Type': picture.type,
			'Cache-Control': 'private, no-store',
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
