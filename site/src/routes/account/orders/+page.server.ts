import { ordersOfAccount } from '#lib/server/book-order-problems.ts';
import { requireAccount, storage } from '#lib/server/workspace.ts';
import type { PageServerLoad } from './$types';

/**
 * Your orders, on the Account pages (docs/store.md; docs/book-orders.md, "Your orders and
 * problems"): everything bought from the Store while signed in to this account,
 * with where each stands and its tracking link. An order placed while signed
 * out keeps only its private link, and is never matched by email, because
 * the email on an order is not checked.
 */
export const load: PageServerLoad = async (event) => {
	const account = requireAccount(event);
	const orders = await ordersOfAccount(storage(event).database, account.subject);
	return { orders };
};
