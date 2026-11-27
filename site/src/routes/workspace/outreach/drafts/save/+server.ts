import { error, json } from '@sveltejs/kit';
import { discardBatchDraft, saveBatchDraft } from '#lib/server/mail/outreach.ts';
import { mailContext } from '#lib/server/mail/runtime.ts';
import { requirePermission } from '#lib/server/workspace.ts';
import { draftOf, replyChoicesOf } from '../../new/batch-form.ts';
import type { RequestHandler } from './$types';

// Where the New batch page saves what is written a moment after each change, and throws it away on Discard, as the inbox's box for writing mail does with its drafts (../../../inbox/drafts/save/+server.ts). The page sends its own form.
export const prerender = false;

export const POST: RequestHandler = async (event) => {
	const person = requirePermission(event, 'send-outreach');
	const context = mailContext();
	const form = await event.request.formData().catch(() => null);
	if (!form) error(400, 'Send the batch to save.');
	const saved = await saveBatchDraft(context, person.identifier, draftOf(form, (await replyChoicesOf(context)).choices.map((choice) => choice.value)));
	return json(saved, { headers: { 'cache-control': 'no-store' } });
};

export const DELETE: RequestHandler = async (event) => {
	const person = requirePermission(event, 'send-outreach');
	const identifier = event.url.searchParams.get('identifier');
	if (!identifier) error(400, 'Name the draft to throw away.');
	await discardBatchDraft(mailContext(), person.identifier, identifier.slice(0, 100));
	return new Response(null, { status: 204 });
};
