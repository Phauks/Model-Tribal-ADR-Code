/**
 * Starts sending one file (docs/uploads.md). The Send files page posts the
 * file's name and size and the sender's answers, then sends the pieces to
 * /uploads/pieces/<reference>/<number>.
 */
import { error, json } from '@sveltejs/kit';
import { can } from '#lib/permissions.ts';
import { requireDocumentLevel } from '#lib/server/access.ts';
import { essayRow } from '#lib/server/essays.ts';
import { answering, looksLikeNation, senderOf, withinStartLimit } from '#lib/server/upload-requests.ts';
import { allowanceFor, readAnswers, startUpload, UploadProblem } from '#lib/server/uploads.ts';
import { storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const POST: RequestHandler = (event) =>
	answering(async () => {
		const account = senderOf(event);
		const { database, bucket } = storage(event);
		const body = (await event.request.json().catch(() => /* expected: a body that is not JSON is refused just below with 400 */ null)) as Record<string, unknown> | null;
		if (!body || typeof body !== 'object') error(400, 'Send the file’s name and size.');
		// A file from the pull list, sent by a workspace editor: no questions, no per-minute limit (docs/uploads.md, "Intake").
		const pulled = body.pulled === true;
		if (pulled && !(event.locals.person && can(event.locals.person, 'review-uploads'))) {
			error(403, 'Only workspace editors can send pulled files.');
		}
		if (!pulled && !(await withinStartLimit(account.subject))) {
			throw new UploadProblem('Too many files in a minute. Wait a minute and try again.', 429);
		}
		const fileName = typeof body.fileName === 'string' ? body.fileName : '';
		const sizeBytes = typeof body.sizeBytes === 'number' ? body.sizeBytes : 0;
		const groupIdentifier =
			typeof body.groupIdentifier === 'string' && /^[0-9a-f-]{36}$/.test(body.groupIdentifier)
				? body.groupIdentifier
				: crypto.randomUUID();

		// A figure for an essay, from the essay editor: the writer must be able to change the essay.
		if (body.wayIn === 'essay-figure') {
			const essay = typeof body.essay === 'string' ? body.essay : '';
			if (!(await essayRow(database, essay))) error(404, 'There is no such essay.');
			await requireDocumentLevel(event, database, { kind: 'essay', identifier: essay }, 'contribute');
			const started = await startUpload(
				database,
				bucket,
				{
					accountIdentifier: account.subject,
					personIdentifier: event.locals.person?.identifier ?? null,
					groupIdentifier,
					fileName,
					sizeBytes,
					wayIn: 'essay-figure',
					essayIdentifier: essay
				},
				await allowanceFor(database, account.subject, event.locals.person)
			);
			return json(started, { headers: { 'cache-control': 'no-store' } });
		}

		if (pulled) {
			const started = await startUpload(
				database,
				bucket,
				{
					accountIdentifier: account.subject,
					personIdentifier: event.locals.person?.identifier ?? null,
					groupIdentifier,
					fileName,
					sizeBytes,
					wayIn: 'send-files',
					fromPullList: true,
					note: typeof body.note === 'string' ? body.note : null
				},
				await allowanceFor(database, account.subject, event.locals.person)
			);
			return json(started, { headers: { 'cache-control': 'no-store' } });
		}

		const read = readAnswers((body.answers ?? {}) as Record<string, unknown>, looksLikeNation);
		if (!read.ok) return json({ message: 'Answer the questions about the files.', errors: read.errors }, { status: 400 });
		const started = await startUpload(
			database,
			bucket,
			{
				accountIdentifier: account.subject,
				personIdentifier: event.locals.person?.identifier ?? null,
				groupIdentifier,
				fileName,
				sizeBytes,
				wayIn: 'send-files',
				answers: read.answers
			},
			await allowanceFor(database, account.subject, event.locals.person)
		);
		return json(started, { headers: { 'cache-control': 'no-store' } });
	});
