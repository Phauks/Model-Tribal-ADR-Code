import { error } from '@sveltejs/kit';
import { heldFileAnswer, openScannedFile } from '#lib/server/file-scans.ts';
import { requirePermission, storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

/**
 * Downloads a file sent with a request, for editors only. The file is always
 * downloaded, never shown as a page of this site, and never cached, so an
 * uploaded file cannot run in the site's name. It is held until the virus
 * check passes (site/SCANNING.md).
 */
export const GET: RequestHandler = async (event) => {
	requirePermission(event, 'read-requests');
	const { database, bucket } = storage(event);
	const source = await database
		.prepare(
			`SELECT request_sources.file_key AS fileKey, request_sources.file_name AS fileName,
			        request_sources.file_type AS fileType
			 FROM request_sources JOIN requests ON requests.identifier = request_sources.request_identifier
			 WHERE requests.reference = ? AND request_sources.identifier = ?`
		)
		.bind(event.params.reference, event.params.source)
		.first<{ fileKey: string | null; fileName: string | null; fileType: string | null }>();
	if (!source?.fileKey) error(404, 'No such file.');
	const opened = await openScannedFile(database, bucket, source.fileKey);
	if (opened.state !== 'ready') {
		const answer = heldFileAnswer(opened);
		error(answer.status, answer.message);
	}
	const object = opened.object;

	const name = source.fileName ?? 'file';
	// Header values must be plain ASCII; the full name goes in filename*.
	const plainName = name.replace(/[^\x20-\x7e]|["\\]/g, '_');
	return new Response(object.body as unknown as ReadableStream, {
		headers: {
			'content-type': source.fileType ?? 'application/octet-stream',
			'content-disposition': `attachment; filename="${plainName}"; filename*=UTF-8''${encodeURIComponent(name)}`,
			'x-content-type-options': 'nosniff',
			'cache-control': 'no-store'
		}
	});
};
