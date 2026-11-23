import { error, json } from '@sveltejs/kit';
import { mailContext } from '#lib/server/mail/runtime.ts';
import { deleteDraft, draftFieldsFrom, saveDraft, WritingError } from '#lib/server/mail/writing.ts';
import type { RequestHandler } from './$types';
import { requireMail } from '#lib/server/mail/inbox-access.ts';

// Where the box for writing mail saves its draft a moment after each change,
// and throws it away on Discard (src/routes/workspace/inbox/Composer.svelte).
// A draft is the writer's own: nobody else sees it.
export const prerender = false;

export const POST: RequestHandler = async (event) => {
	const person = await requireMail(event);
	const body = (await event.request.json().catch(() => null)) as { identifier?: unknown; thread?: unknown; fields?: unknown } | null;
	if (!body || typeof body !== 'object') error(400, 'Send the draft to save.');
	try {
		const saved = await saveDraft(mailContext(), person.identifier, {
			identifier: typeof body.identifier === 'string' ? body.identifier.slice(0, 100) : null,
			threadIdentifier: typeof body.thread === 'string' ? body.thread.slice(0, 100) : null,
			fields: draftFieldsFrom(body.fields)
		});
		return json(saved, { headers: { 'cache-control': 'no-store' } });
	} catch (problem) {
		if (problem instanceof WritingError) error(409, problem.message);
		throw problem;
	}
};

export const DELETE: RequestHandler = async (event) => {
	const person = await requireMail(event);
	const identifier = event.url.searchParams.get('identifier');
	if (!identifier) error(400, 'Name the draft to throw away.');
	await deleteDraft(mailContext(), person.identifier, { identifier: identifier.slice(0, 100) });
	return new Response(null, { status: 204 });
};
