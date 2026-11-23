import { error, json } from '@sveltejs/kit';
import { isMailRun } from '#lib/server/mail/internal-run.ts';
import { recordDeliveryEvent } from '#lib/server/mail/outbound.ts';
import { mailContext } from '#lib/server/mail/runtime.ts';
import type { RequestHandler } from './$types';

// Delivery events from Cloudflare Email Service, which a Queues event
// subscription delivers to the Worker's queue handler
// (tools/add-mail-handlers.mjs; site/MAIL.md, "Delivery reports").
export const prerender = false;

export const POST: RequestHandler = async ({ request }) => {
	if (!isMailRun(request)) error(404, 'Not found.');
	const context = mailContext();
	const events = (await request.json()) as unknown[];
	let recorded = 0;
	for (const event of Array.isArray(events) ? events : []) if (await recordDeliveryEvent(context, event)) recorded += 1;
	return json({ recorded }, { headers: { 'cache-control': 'no-store' } });
};
