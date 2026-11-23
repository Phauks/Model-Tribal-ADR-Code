import { error } from '@sveltejs/kit';
import { orderByIdentifier } from '#lib/server/book-orders.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import type { PageServerLoad } from './$types';

// An order's page is read from the database when it is opened.
export const prerender = false;

/**
 * Where a printed copy stands (docs/book-orders.md). The address is long and
 * random, so only the person who ordered knows it; the page still shows no
 * address, telephone or email.
 */
export const load: PageServerLoad = async ({ params, url }) => {
	if (!/^[0-9a-f-]{36}$/.test(params.identifier)) error(404, 'No such order');
	const order = await orderByIdentifier(workerEnvironment().database, params.identifier);
	if (!order) error(404, 'No such order');
	return {
		justPaid: url.searchParams.get('paid') === '1',
		order: {
			title: order.title,
			mode: order.mode,
			status: order.status,
			pages: order.page_count,
			priceCents: order.price_cents,
			trackingLink: order.tracking_link,
			placedAt: order.created_at
		}
	};
};
