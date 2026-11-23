/**
 * One piece of a big file sent as a link, as the request body: 10 MiB, or
 * less for the last, well under the Workers request size limit
 * (site/MAIL.md, "Big files as links").
 */
import { error, json } from '@sveltejs/kit';
import { requireMail } from '#lib/server/mail/inbox-access.ts';
import { LinkedFileError, linkedPieceBytes, ownLinkedFile, receiveLinkedPiece } from '#lib/server/mail/linked-files.ts';
import { mailContext } from '#lib/server/mail/runtime.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const PUT: RequestHandler = async (event) => {
	const person = await requireMail(event);
	const declared = Number(event.request.headers.get('content-length') ?? 0);
	if (declared > linkedPieceBytes) error(413, 'This piece is too large.');
	try {
		const context = mailContext();
		const file = await ownLinkedFile(context, person.identifier, event.params.file);
		// The file is put in line for the virus check when it is finished, and served only once it passes.
		const bytes = new Uint8Array(await event.request.arrayBuffer());
		if (bytes.byteLength > linkedPieceBytes) error(413, 'This piece is too large.');
		const outcome = await receiveLinkedPiece(context, file, Number(event.params.piece), bytes);
		return json(outcome, { headers: { 'cache-control': 'no-store' } });
	} catch (problem) {
		if (problem instanceof LinkedFileError) error(problem.status, problem.message);
		throw problem;
	}
};
