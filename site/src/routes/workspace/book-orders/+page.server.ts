import { fail } from '@sveltejs/kit';
import { longestProblemText } from '#lib/book-order-problems.ts';
import { allOrders, answerProblem, recordRefund, unsettledProblems } from '#lib/server/book-order-problems.ts';
import { orderingState } from '#lib/server/book-orders.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { now } from '#lib/server/identifiers.ts';
import { formText, requirePermission, storage } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';

// Every printed-copy order, the problems buyers report, and refunds
// (docs/book-orders.md, "Your orders and problems"). The lead author only.
export const load: PageServerLoad = async (event) => {
	requirePermission(event, 'manage-book-orders');
	const { database } = storage(event);
	const state = orderingState(workerEnvironment());
	const [orders, problems] = await Promise.all([allOrders(database), unsettledProblems(database)]);
	const titles = new Map(orders.map((order) => [order.identifier, order]));
	return {
		ordering: state.open ? { open: true as const, mode: state.settings.mode } : { open: false as const, reason: state.reason },
		orders,
		problems: problems.map((problem) => {
			const order = titles.get(problem.orderIdentifier);
			return { ...problem, orderPlacedAt: order?.placedAt ?? null, orderStatus: order?.status ?? null, orderMode: order?.mode ?? null };
		})
	};
};

/** Dollars typed by the lead author, in cents, or NaN. */
function centsOf(text: string): number {
	const cleaned = text.replace(/[$,\s]/g, '');
	if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return Number.NaN;
	return Math.round(Number(cleaned) * 100);
}

export const actions: Actions = {
	answer: async (event) => {
		requirePermission(event, 'manage-book-orders');
		const form = await event.request.formData();
		const problem = formText(form, 'problem') ?? '';
		const answer = formText(form, 'answer', longestProblemText + 1) ?? '';
		const status = formText(form, 'status') === 'closed' ? 'closed' : 'answered';
		if (answer.length > longestProblemText) return fail(400, { problem, answerError: 'Please keep the answer under 4,000 characters.' });
		if (answer === '' && status === 'answered') return fail(400, { problem, answerError: 'Write an answer, or close the problem without one.' });
		const saved = await answerProblem(storage(event).database, problem, answer === '' ? null : answer, status, now());
		if (!saved) return fail(404, { problem, answerError: 'That problem is gone.' });
		return { answered: problem };
	},
	refund: async (event) => {
		requirePermission(event, 'manage-book-orders');
		const form = await event.request.formData();
		const order = formText(form, 'order') ?? '';
		const cents = centsOf(formText(form, 'amount') ?? '');
		if (!Number.isInteger(cents)) return fail(400, { order, refundError: 'Give the amount refunded in dollars, such as 23.41.' });
		const saved = await recordRefund(storage(event).database, order, cents, now());
		if (!saved) return fail(400, { order, refundError: 'The refund cannot be more than the buyer paid, gift included.' });
		return { refunded: order };
	}
};
