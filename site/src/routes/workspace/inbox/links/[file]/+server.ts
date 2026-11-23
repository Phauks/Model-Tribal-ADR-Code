/**
 * Finishes a big file once all its pieces are in (POST), or takes it back
 * before it goes with a message (DELETE). Site/MAIL.md, "Big files as links".
 */
import { error, json } from '@sveltejs/kit';
import { requireMail } from '#lib/server/mail/inbox-access.ts';
import { finishLinkedFile, LinkedFileError, ownLinkedFile, removeLinkedFile } from '#lib/server/mail/linked-files.ts';
import { mailContext } from '#lib/server/mail/runtime.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

async function answering(work: () => Promise<Response>): Promise<Response> {
	try {
		return await work();
	} catch (problem) {
		if (problem instanceof LinkedFileError) error(problem.status, problem.message);
		throw problem;
	}
}

export const POST: RequestHandler = async (event) => {
	const person = await requireMail(event);
	return answering(async () => {
		const context = mailContext();
		await finishLinkedFile(context, await ownLinkedFile(context, person.identifier, event.params.file));
		return json({ finished: true }, { headers: { 'cache-control': 'no-store' } });
	});
};

export const DELETE: RequestHandler = async (event) => {
	const person = await requireMail(event);
	return answering(async () => {
		const context = mailContext();
		await removeLinkedFile(context, await ownLinkedFile(context, person.identifier, event.params.file));
		return json({ removed: true }, { headers: { 'cache-control': 'no-store' } });
	});
};
