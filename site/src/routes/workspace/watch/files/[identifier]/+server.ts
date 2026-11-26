import { error } from '@sveltejs/kit';
import { heldFileAnswer, openScannedFile } from '#lib/server/file-scans.ts';
import { requirePermission, storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

/**
 * Downloads the source watch's private copy of an item's file, for the people
 * who review the watch. Like every fetched file, it is held until the virus
 * check passes (site/SCANNING.md), always downloaded rather than shown as a
 * page of this site, and never cached.
 */
export const GET: RequestHandler = async (event) => {
	requirePermission(event, 'review-watch');
	const { database, bucket } = storage(event);
	const identifier = Number(event.params.identifier);
	if (!Number.isInteger(identifier)) error(404, 'No such file.');
	const row = await database.prepare('SELECT capture_key, source_identifier, status FROM watch_candidates WHERE identifier = ?').bind(identifier).first<{ capture_key: string | null; source_identifier: string; status: string }>();
	if (!row?.capture_key) error(404, 'No such file.');
	const opened = await openScannedFile(database, bucket, row.capture_key);
	if (opened.state !== 'ready') {
		const answer = heldFileAnswer(opened);
		error(answer.status, answer.message);
	}
	const extension = row.capture_key.split('.').pop() ?? 'bin';
	const name = `${row.source_identifier.replace(/[^A-Za-z0-9.-]+/g, '-').slice(0, 80)}.${extension}`;
	return new Response(opened.object.body as unknown as ReadableStream, {
		headers: {
			'content-type': opened.object.httpMetadata?.contentType ?? 'application/octet-stream',
			'content-disposition': `attachment; filename="${name}"`,
			'x-content-type-options': 'nosniff',
			'cache-control': 'no-store'
		}
	});
};
