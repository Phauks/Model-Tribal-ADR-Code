/** Adds a YouTube video in place of a file (decision record 0038). */
import { error, json } from '@sveltejs/kit';
import { answering, looksLikeNation, senderOf, withinStartLimit } from '#lib/server/upload-requests.ts';
import { addYoutubeLink, allowanceFor, readAnswers, UploadProblem } from '#lib/server/uploads.ts';
import { storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const POST: RequestHandler = (event) =>
	answering(async () => {
		const account = senderOf(event);
		const { database } = storage(event);
		const body = (await event.request.json().catch(() => null)) as Record<string, unknown> | null;
		if (!body || typeof body !== 'object' || typeof body.link !== 'string') error(400, 'Send the link.');
		if (!(await withinStartLimit(account.subject))) {
			throw new UploadProblem('Too many files in a minute. Wait a minute and try again.', 429);
		}
		const read = readAnswers((body.answers ?? {}) as Record<string, unknown>, looksLikeNation);
		if (!read.ok) return json({ message: 'Answer the questions about the files.', errors: read.errors }, { status: 400 });
		const added = await addYoutubeLink(
			database,
			{
				accountIdentifier: account.subject,
				personIdentifier: event.locals.person?.identifier ?? null,
				link: body.link,
				groupIdentifier:
					typeof body.groupIdentifier === 'string' && /^[0-9a-f-]{36}$/.test(body.groupIdentifier)
						? body.groupIdentifier
						: undefined,
				wayIn: 'send-files',
				answers: read.answers
			},
			await allowanceFor(database, account.subject, event.locals.person)
		);
		return json(added, { headers: { 'cache-control': 'no-store' } });
	});
