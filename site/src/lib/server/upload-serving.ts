/**
 * Serves a file people sent (docs/uploads.md) from the private bucket, with
 * byte ranges so a video or recording can be played from any point and a
 * player can seek (MDN, "HTTP range requests",
 * https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Range_requests).
 *
 * Only pictures, sound and video are ever shown in the browser, and then
 * with a Content-Security-Policy that blocks scripts and a nosniff header, so
 * a file cannot run in the site's name (OWASP File Upload Cheat Sheet,
 * "File Storage Location" and "Content-Type validation"). Documents are
 * always downloaded. Nothing is served until its virus check allows it, for
 * the very bytes that were checked (site/SCANNING.md).
 */
import { error } from '@sveltejs/kit';
import type { R2Bucket, R2Object, R2ObjectBody } from '@cloudflare/workers-types/index.ts';
import type { UploadKind } from '#lib/uploads.ts';
import { mayServe, type FileScan } from './file-scans.ts';
import { servedRange } from './public-copy-serving.ts';

export interface ServedFile {
	key: string;
	name: string;
	mediaType: string;
	kind: UploadKind;
}

/** Whether a file of this kind may be shown in the browser rather than downloaded. */
export function mayShowInline(kind: UploadKind): boolean {
	return kind === 'picture' || kind === 'sound' || kind === 'video';
}

export async function serveUploadFile(
	request: Request,
	bucket: R2Bucket,
	file: ServedFile,
	options: { inline: boolean; cacheControl: string; scan: FileScan | null }
): Promise<Response> {
	if (!mayServe(options.scan)) error(409, 'This file is held until the virus check passes.');
	const wantsRange = request.headers.has('range');
	const stored = (await bucket.get(file.key, {
		onlyIf: request.headers as never,
		...(wantsRange ? { range: request.headers as never } : {})
	})) as R2Object | R2ObjectBody | null;
	if (!stored) error(404, 'The file is no longer stored.');
	// A copy replaced after its check is held again.
	if (!mayServe(options.scan, stored)) error(409, 'This file is held until the virus check passes.');

	const inline = options.inline && mayShowInline(file.kind);
	// Header values must be plain ASCII; the full name goes in filename*.
	const plainName = file.name.replace(/[^\x20-\x7e]|["\\]/g, '_');
	const headers = new Headers({
		'content-type': inline ? file.mediaType : 'application/octet-stream',
		'content-disposition': `${inline ? 'inline' : 'attachment'}; filename="${plainName}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
		'content-security-policy': "default-src 'none'; img-src 'self'; media-src 'self'; sandbox",
		'x-content-type-options': 'nosniff',
		'cross-origin-resource-policy': 'same-origin',
		'accept-ranges': 'bytes',
		'cache-control': options.cacheControl,
		etag: stored.httpEtag
	});
	if (!('body' in stored)) return new Response(null, { status: 304, headers });
	const range = servedRange(stored.range, stored.size);
	if (range) {
		headers.set('content-range', `bytes ${range.first}-${range.last}/${stored.size}`);
		headers.set('content-length', String(range.last - range.first + 1));
		return new Response(stored.body as unknown as ReadableStream, { status: 206, headers });
	}
	headers.set('content-length', String(stored.size));
	return new Response(stored.body as unknown as ReadableStream, { headers });
}
