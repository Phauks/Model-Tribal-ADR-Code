import { error } from '@sveltejs/kit';
import { mailContext } from '#lib/server/mail/runtime.ts';
import { openScannedFile } from '#lib/server/file-scans.ts';
import { getAttachment } from '#lib/server/mail/store.ts';
import { requirePermission } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

// An attachment, always downloaded rather than shown, because a file someone
// sent could hold anything. Every attachment is held until the virus check
// says clean (site/SCANNING.md, src/lib/server/mail/scans.ts).
export const prerender = false;

export const GET: RequestHandler = async (event) => {
	requirePermission(event, 'read-mail');
	const context = mailContext();
	const attachment = await getAttachment(context, event.params.attachment);
	if (!attachment) error(404, 'Not found.');
	const opened = await openScannedFile(context.database, context.bucket, attachment.bucketKey);
	if (opened.state === 'missing') error(404, 'The file is missing from storage.');
	if (opened.state === 'held') {
		error(423, 'This file is held until the virus check says it is clean. The conversation shows where the check stands.');
	}
	const object = opened.object;
	const name = attachment.filename.replace(/[^\p{L}\p{N} ._()-]/gu, '_');
	return new Response(object.body as unknown as ReadableStream, {
		headers: {
			'content-type': 'application/octet-stream',
			'content-disposition': `attachment; filename="${name.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`,
			'content-length': String(attachment.size),
			'x-content-type-options': 'nosniff',
			'cache-control': 'no-store'
		}
	});
};
