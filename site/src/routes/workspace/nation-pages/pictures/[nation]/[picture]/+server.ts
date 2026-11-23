/**
 * Shows the project any picture a nation's changes have named, so it can
 * review pictures before or after they go live. Readers see only the live
 * pictures, at /nations/<id>/pictures/<picture>. A picture shows only once
 * the virus check passes (site/SCANNING.md).
 */
import { error } from '@sveltejs/kit';
import { pictureKey } from '#lib/nation-page-changes.ts';
import { heldFileAnswer, openScannedFile } from '#lib/server/file-scans.ts';
import { picturesEverNamed } from '#lib/server/nation-page-changes.ts';
import { requirePermission, storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	requirePermission(event, 'review-nation-pages');
	const { database, bucket } = storage(event);
	const { nation, picture: identifier } = event.params;
	const picture = (await picturesEverNamed(database, nation)).find((candidate) => candidate.identifier === identifier);
	if (!picture) error(404, 'No such picture.');
	const opened = await openScannedFile(database, bucket, pictureKey(nation, picture.identifier));
	if (opened.state !== 'ready') {
		const answer = heldFileAnswer(opened);
		error(answer.status, answer.message);
	}
	return new Response(await opened.object.arrayBuffer(), {
		headers: {
			'Content-Type': picture.type,
			'Cache-Control': 'private, no-store',
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
