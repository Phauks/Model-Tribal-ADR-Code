import { error, json } from '@sveltejs/kit';
import { isMailRun } from '#lib/server/mail/internal-run.ts';
import { sendDueMessages } from '#lib/server/mail/outbound.ts';
import { runOutreach } from '#lib/server/mail/outreach.ts';
import { mailCarriers, mailContext } from '#lib/server/mail/runtime.ts';
import { purgeDeleted, wakeSnoozed } from '#lib/server/mail/store.ts';
import type { RequestHandler } from './$types';

// The mail run every five minutes (wrangler.jsonc, "triggers"): scheduled
// messages whose time has come, snoozed conversations whose time has come,
// the next outreach messages, and conversations deleted 30 days ago. Does
// nothing while email is off.
export const prerender = false;

export const POST: RequestHandler = async ({ request }) => {
	if (!isMailRun(request)) error(404, 'Not found.');
	const context = mailContext();
	if (!context.settings.domain) return json({ off: true });
	const carriers = mailCarriers(context);
	const result = {
		scheduled: await sendDueMessages(context, carriers),
		woken: await wakeSnoozed(context),
		outreach: await runOutreach(context, carriers),
		purged: await purgeDeleted(context)
	};
	return json(result, { headers: { 'cache-control': 'no-store' } });
};
