import { error, fail } from '@sveltejs/kit';
import { isProblemKind, kindsWithPhoto, longestProblemText } from '#lib/book-order-problems.ts';
import { problemsOfOrder, reportProblem } from '#lib/server/book-order-problems.ts';
import { orderByIdentifier } from '#lib/server/book-orders.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { now } from '#lib/server/identifiers.ts';
import { readFile } from '#lib/server/request-form.ts';
import type { Actions, PageServerLoad } from './$types';

// An order's page is read from the database when it is opened.
export const prerender = false;

const orderPattern = /^[0-9a-f-]{36}$/;

/**
 * Where a printed copy stands (docs/book-orders.md). The address is long and
 * random, so only the person who ordered knows it; the page still shows no
 * address, telephone or email. From here the buyer reports a problem with
 * the order ("Your orders and problems").
 */
export const load: PageServerLoad = async ({ params, url, locals }) => {
	if (!orderPattern.test(params.identifier)) error(404, 'No such order');
	const database = workerEnvironment().database;
	const order = await orderByIdentifier(database, params.identifier);
	if (!order) error(404, 'No such order');
	const problems = await problemsOfOrder(database, order.identifier);
	return {
		justPaid: url.searchParams.get('paid') === '1',
		order: {
			title: order.title,
			mode: order.mode,
			status: order.status,
			pages: order.page_count,
			priceCents: order.price_cents,
			refundedCents: order.refunded_cents,
			refundedAt: order.refunded_at,
			trackingLink: order.tracking_link,
			placedAt: order.created_at,
			mayReport: order.status !== 'awaiting-payment' && order.status !== 'expired',
			onAccount: Boolean(locals.account && order.account_identifier === locals.account.subject)
		},
		problems: problems.map((problem) => ({
			identifier: problem.identifier,
			kind: problem.kind,
			details: problem.details,
			hasPhoto: problem.hasPhoto,
			status: problem.status,
			answer: problem.answer,
			reportedAt: problem.reportedAt
		}))
	};
};

export const actions: Actions = {
	problem: async ({ params, request, getClientAddress }) => {
		if (!orderPattern.test(params.identifier)) error(404, 'No such order');
		const environment = workerEnvironment();
		const order = await orderByIdentifier(environment.database, params.identifier);
		if (!order) error(404, 'No such order');
		if (order.status === 'awaiting-payment' || order.status === 'expired') {
			return fail(409, { problemError: 'This order was not paid for, so there is nothing to fix.' });
		}

		const limiter = environment.requestFormLimit;
		if (limiter && !(await limiter.limit({ key: `book-order-problem:${getClientAddress()}` })).success) {
			return fail(429, { problemError: 'Too many reports from this connection. Wait a minute and try again.' });
		}

		const form = await request.formData();
		const kind = form.get('kind');
		const details = String(form.get('details') ?? '')
			.normalize('NFC')
			.trim();
		const values = { kind: typeof kind === 'string' ? kind : '', details };
		if (!isProblemKind(kind)) return fail(400, { problemError: 'Choose what went wrong.', values });
		if (details === '') return fail(400, { problemError: 'Say what happened.', values });
		if (details.length > longestProblemText) return fail(400, { problemError: 'Please keep this under 4,000 characters.', values });

		const errors: Record<string, string> = {};
		const photo = await readFile(form, 'photo', errors);
		if (errors.photo) return fail(400, { problemError: errors.photo, values });
		if (photo && !photo.type.startsWith('image/')) return fail(400, { problemError: 'Send a photo: PNG, JPEG or WebP.', values });
		if (!photo && kindsWithPhoto.includes(kind)) {
			return fail(400, { problemError: 'Add a photo of the problem. The printer asks for one before it replaces a copy.', values });
		}

		const saved = await reportProblem(environment.database, environment.sourceDocuments, order.identifier, { kind, details, photo }, now());
		if (!saved.saved) return fail(409, { problemError: saved.reason, values });
		return { problemSent: true };
	}
};
