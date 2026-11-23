/**
 * Shows a nation's team any picture its changes have named, including drafts
 * and earlier versions, so they can see what they are publishing. Readers
 * see only the live pictures, at /nations/<id>/pictures/<picture>. A
 * picture shows only once the virus check passes (site/SCANNING.md).
 */
import { error } from '@sveltejs/kit';
import { pictureKey } from '#lib/nation-page-changes.ts';
import { heldFileAnswer, openScannedFile } from '#lib/server/file-scans.ts';
import { picturesEverNamed } from '#lib/server/nation-page-changes.ts';
import { nationAndGranter } from '#lib/server/nation-team-access.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const { nation, database, bucket } = await nationAndGranter(event);
	const picture = (await picturesEverNamed(database, nation.identifier)).find(
		(candidate) => candidate.identifier === event.params.picture
	);
	if (!picture) error(404, 'No such picture.');
	const opened = await openScannedFile(database, bucket, pictureKey(nation.identifier, picture.identifier));
	if (opened.state !== 'ready') {
		const answer = heldFileAnswer(opened);
		error(answer.status, answer.message);
	}
	const stored = opened.object;
	return new Response(await stored.arrayBuffer(), {
		headers: {
			'Content-Type': picture.type,
			'Cache-Control': 'private, no-store',
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
