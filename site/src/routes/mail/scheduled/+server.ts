import { error, json } from '@sveltejs/kit';
import { sendDailySummaries } from '#lib/server/mail/alerts.ts';
import { mailCarriers, mailContext } from '#lib/server/mail/runtime.ts';
import { isScheduledRun } from '#lib/server/scheduled-run.ts';
import type { RequestHandler } from './$types';

// The inbox's part of the hourly run (site/MAIL.md, "New-mail alerts"): the
// daily summaries of new mail that are due. The Worker's scheduled handler
// (tools/add-scheduled-run.mjs) passes the run here with a token only that
// copy of the Worker holds; every other request is refused as if the
// address did not exist. Does nothing while email is off.
export const prerender = false;

export const POST: RequestHandler = async ({ request }) => {
	if (!isScheduledRun(request)) error(404, 'Not found.');
	const context = mailContext();
	if (!context.settings.domain) return json({ off: true }, { headers: { 'cache-control': 'no-store' } });
	return json({ summaries: await sendDailySummaries(context, mailCarriers(context)) }, { headers: { 'cache-control': 'no-store' } });
};
