import { error } from '@sveltejs/kit';
import { mailContext } from '#lib/server/mail/runtime.ts';
import { getMessageHtmlKey } from '#lib/server/mail/store.ts';
import type { RequestHandler } from './$types';
import { requireMessage } from '#lib/server/mail/inbox-access.ts';

// A message's HTML version, shown in a sandboxed frame on the conversation
// page. Scripts, forms and plug-ins never run, and nothing outside the
// message loads, so pictures from the web stay hidden and nobody learns the
// message was opened (site/MAIL.md, "Reading HTML mail").
export const prerender = false;

export const GET: RequestHandler = async (event) => {
	const person = await requireMessage(event, event.params.message);
	const context = mailContext();
	const key = await getMessageHtmlKey(context, event.params.message, person.identifier);
	if (!key) error(404, 'This message has no HTML version.');
	const object = await context.bucket.get(key);
	if (!object) error(404, 'The HTML version is missing from storage.');
	return new Response(await object.text(), {
		headers: {
			'content-type': 'text/html; charset=utf-8',
			'content-security-policy': "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; frame-ancestors 'self'",
			'x-content-type-options': 'nosniff',
			'cache-control': 'no-store'
		}
	});
};
