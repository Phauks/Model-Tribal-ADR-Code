/**
 * Starts sending a big file to go with a message as a download link
 * (site/MAIL.md, "Big files as links"). The composer then sends the pieces
 * to links/<file>/<piece> and finishes with a POST to links/<file>.
 */
import { error, json } from '@sveltejs/kit';
import { requireMail } from '#lib/server/mail/inbox-access.ts';
import { LinkedFileError, startLinkedFile } from '#lib/server/mail/linked-files.ts';
import { mailContext } from '#lib/server/mail/runtime.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const POST: RequestHandler = async (event) => {
	const person = await requireMail(event);
	const asked = (await event.request.json().catch(() => /* expected: a body that is not JSON is refused just below with 400 */ null)) as { filename?: unknown; size?: unknown; type?: unknown } | null;
	if (!asked || typeof asked.filename !== 'string' || typeof asked.size !== 'number') error(400, 'Say which file to send.');
	try {
		const started = await startLinkedFile(mailContext(), person.identifier, {
			filename: asked.filename,
			sizeBytes: asked.size,
			mediaType: typeof asked.type === 'string' ? asked.type : ''
		});
		return json(started, { headers: { 'cache-control': 'no-store' } });
	} catch (problem) {
		if (problem instanceof LinkedFileError) error(problem.status, problem.message);
		throw problem;
	}
};
