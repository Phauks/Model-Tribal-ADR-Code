/**
 * The download link for a big file sent from the inbox (site/MAIL.md, "Big
 * files as links"). Anyone with the link can download the file until it runs
 * out, once it has passed the virus check. Nothing records who downloaded it.
 */
import { error } from '@sveltejs/kit';
import { heldFileAnswer, openScannedFile } from '#lib/server/file-scans.ts';
import { linkedFileForDownload } from '#lib/server/mail/linked-files.ts';
import { mailContext } from '#lib/server/mail/runtime.ts';
import { readToken } from '#lib/server/mail/tokens.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async ({ params }) => {
	const context = mailContext();
	const identifier = context.settings.signingKey ? await readToken(context.settings.signingKey, 'file', params.token) : null;
	const file = identifier ? await linkedFileForDownload(context, identifier) : null;
	if (!file) error(404, 'There is no file at this link.');
	if (file === 'expired') error(410, 'This link has run out, and the file has been deleted. Ask whoever sent it for a new link.');
	const opened = await openScannedFile(context.database, context.bucket, file.bucket_key);
	if (opened.state !== 'ready') {
		const answer = heldFileAnswer(opened);
		error(answer.status, answer.message);
	}
	const safeName = file.filename.replace(/[^\w.() -]/g, '_');
	return new Response(opened.object.body as unknown as ReadableStream, {
		headers: {
			'content-type': file.media_type,
			'content-length': String(file.size_bytes),
			'content-disposition': `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
			'x-content-type-options': 'nosniff',
			'content-security-policy': "default-src 'none'; sandbox",
			'cache-control': 'private, no-store',
			'referrer-policy': 'no-referrer'
		}
	});
};
