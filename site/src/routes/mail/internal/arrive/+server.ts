import { error, json } from '@sveltejs/kit';
import { afterArrival, arrivalFailed, dropArrival, fileArrival } from '#lib/server/mail/arrivals.ts';
import { receiveMail } from '#lib/server/mail/inbound.ts';
import { isMailRun } from '#lib/server/mail/internal-run.ts';
import { mailCarriers, mailContext } from '#lib/server/mail/runtime.ts';
import type { RequestHandler } from './$types';

// One message from Cloudflare Email Routing. The Worker's email handler
// (tools/add-mail-handlers.mjs) first keeps the raw message in the mail
// bucket under mail/incoming/ and passes its key here (site/MAIL.md, "When
// something fails"); this files it, and the handler refuses the message when
// this says so. If filing fails, the answer says "kept": the message is
// accepted and the mail run tries again. A raw message in the body, from a
// handler built before the bucket, is still filed directly. Requests from
// outside the Worker cannot carry the run token.
export const prerender = false;

export const POST: RequestHandler = async ({ request, url }) => {
	if (!isMailRun(request)) error(404, 'Not found.');
	const context = mailContext();
	const carriers = mailCarriers(context);
	const key = url.searchParams.get('key');
	if (key) {
		if (!key.startsWith('mail/incoming/')) error(400, 'Not an arriving message.');
		try {
			const result = await fileArrival(context, key);
			if (result?.outcome === 'rejected') await dropArrival(context, key);
			await afterArrival(context, carriers, result);
			return json(result ?? { outcome: 'kept' }, { headers: { 'cache-control': 'no-store' } });
		} catch (problem) {
			console.error('Filing an arriving message failed; the mail run will try again', problem);
			await arrivalFailed(context, key, problem);
			return json({ outcome: 'kept' }, { headers: { 'cache-control': 'no-store' } });
		}
	}
	const result = await receiveMail(context, {
		from: url.searchParams.get('from') ?? '',
		to: url.searchParams.get('to') ?? '',
		raw: await request.arrayBuffer()
	});
	await afterArrival(context, carriers, result);
	return json(result, { headers: { 'cache-control': 'no-store' } });
};
