/**
 * Lulu tells the site here when a print job changes status, such as when it
 * ships (Print API, "Webhooks", topic PRINT_JOB_STATUS_CHANGED;
 * docs/book-orders.md). Each call is signed with the Lulu API secret.
 */
import { orderingState, recordPrinterStatus, removeOldPersonalDetails } from '#lib/server/book-orders.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { now } from '#lib/server/identifiers.ts';
import { isLuluWebhook, type PrintJob } from '#lib/server/lulu.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

const plain = (text: string, status: number) => new Response(text, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

export const POST: RequestHandler = async ({ request }) => {
	const environment = workerEnvironment();
	const state = orderingState(environment);
	if (!state.open) return plain('Ordering is closed.', 503);

	const rawBody = await request.text();
	if (!(await isLuluWebhook(state.settings.lulu, rawBody, request.headers.get('lulu-hmac-sha256')))) {
		return plain('Signature does not match.', 400);
	}
	const submission = JSON.parse(rawBody) as { topic?: string; data?: PrintJob };
	const job = submission.data;
	if (submission.topic !== 'PRINT_JOB_STATUS_CHANGED' || !job?.id || !job.status?.name) return plain('Ignored.', 200);

	const tracking = job.line_items?.flatMap((item) => item.tracking_urls ?? [])[0];
	await recordPrinterStatus(environment.database, job.id, job.status.name, job.status.message, tracking, now());
	// Shipped orders lose their personal details after 90 days; this is a convenient time to check.
	await removeOldPersonalDetails(environment.database, new Date());
	return plain('Noted.', 200);
};
