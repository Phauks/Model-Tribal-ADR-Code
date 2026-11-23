import { error, json } from '@sveltejs/kit';
import { isMailRun } from '#lib/server/mail/internal-run.ts';
import { sendDueMessages } from '#lib/server/mail/outbound.ts';
import { runOutreach } from '#lib/server/mail/outreach.ts';
import { mailCarriers, mailContext } from '#lib/server/mail/runtime.ts';
import { fileWaitingArrivals } from '#lib/server/mail/arrivals.ts';
import { removeExpiredLinkedFiles } from '#lib/server/mail/linked-files.ts';
import { bringBackReminders, purgeDeleted } from '#lib/server/mail/store.ts';
import type { RequestHandler } from './$types';

// The mail run every five minutes (wrangler.jsonc, "triggers"): arriving
// mail whose filing failed, scheduled messages whose time has come (and
// replies waiting to be tried again), conversations whose reminder has come
// due, the next outreach messages, conversations deleted 30 days ago, and
// files sent as links whose 30 days are up. Does nothing while email is off.
export const prerender = false;

export const POST: RequestHandler = async ({ request }) => {
	if (!isMailRun(request)) error(404, 'Not found.');
	const context = mailContext();
	if (!context.settings.domain) return json({ off: true });
	const carriers = mailCarriers(context);
	const result = {
		arrivals: await fileWaitingArrivals(context, carriers),
		scheduled: await sendDueMessages(context, carriers),
		reminders: await bringBackReminders(context),
		outreach: await runOutreach(context, carriers),
		purged: await purgeDeleted(context),
		expiredLinks: await removeExpiredLinkedFiles(context)
	};
	return json(result, { headers: { 'cache-control': 'no-store' } });
};
