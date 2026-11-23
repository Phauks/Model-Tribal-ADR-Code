import { error, json } from '@sveltejs/kit';
import { receiveMail } from '#lib/server/mail/inbound.ts';
import { isMailRun } from '#lib/server/mail/internal-run.ts';
import { sendNewMailNotice } from '#lib/server/mail/outbound.ts';
import { mailCarriers, mailContext } from '#lib/server/mail/runtime.ts';
import { sendAwayReply } from '#lib/server/mail/writing.ts';
import type { RequestHandler } from './$types';

// One message from Cloudflare Email Routing. The Worker's email handler
// (tools/add-mail-handlers.mjs) passes the raw message here with the
// envelope's sender and recipient, and refuses the message when this says
// so. Requests from outside the Worker cannot carry the run token.
export const prerender = false;

export const POST: RequestHandler = async ({ request, url }) => {
	if (!isMailRun(request)) error(404, 'Not found.');
	const context = mailContext();
	const result = await receiveMail(context, {
		from: url.searchParams.get('from') ?? '',
		to: url.searchParams.get('to') ?? '',
		raw: await request.arrayBuffer()
	});
	if (result.outcome === 'filed' && result.notify) {
		// A notice that fails is logged; the message is already filed.
		await sendNewMailNotice(context, mailCarriers(context)).catch((problem) => console.error('The new-mail notice failed', problem));
	}
	if (result.outcome === 'filed' && result.answerable) {
		// The away message, when it is on (src/lib/server/mail/writing.ts); like the notice, a failure only gets logged.
		await sendAwayReply(context, mailCarriers(context), result).catch((problem) => console.error('The away message failed', problem));
	}
	return json(result, { headers: { 'cache-control': 'no-store' } });
};
