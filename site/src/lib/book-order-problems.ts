// Problems a buyer reports about a printed-copy order, from the order's own
// page (docs/book-orders.md, "Your orders and problems"). The words here are
// shared by that page and the workspace's Book orders page.
//
// Lulu replaces a copy that arrives damaged or misprinted when it sees
// photos that show the problem, taken with a phone or camera in good light
// ("Providing digital defect images", help.lulu.com, read Nov. 23, 2026),
// and replaces an order that never arrived when told within 30 days of the
// day it shipped ("Shipping FAQ", help.api.lulu.com, read Nov. 23, 2026).
// The project is Lulu's customer, so it makes those claims for the buyer.

export const problemKinds = ['damaged', 'misprinted', 'never-arrived', 'wrong-address', 'cancel', 'return-or-refund', 'other'] as const;
export type ProblemKind = (typeof problemKinds)[number];

export const problemKindLabels: Record<ProblemKind, string> = {
	damaged: 'It arrived damaged',
	misprinted: 'It was printed wrong',
	'never-arrived': 'It never arrived',
	'wrong-address': 'The address is wrong',
	cancel: 'Cancel the order',
	'return-or-refund': 'Return it or get a refund',
	other: 'Something else'
};

export const problemKindHints: Record<ProblemKind, string> = {
	damaged: 'Add a photo taken with a phone or camera in good light, showing every damaged corner or page. The printer asks for one before it replaces a copy.',
	misprinted: 'Add a photo of the pages or cover that are wrong, and say which pages. The printer asks for one before it replaces a copy.',
	'never-arrived': 'Tell us within 30 days of the day it shipped, so the printer can send another copy.',
	'wrong-address': 'Give the right address. It can be changed only before the copy is printed, about two hours after you pay.',
	cancel: 'An order can be canceled only before printing starts, about two hours after you pay. After that, ask for a return or refund.',
	'return-or-refund': 'Say what happened. Copies are printed for you, so the project decides each request. For a damaged or misprinted copy, choose that instead, so the printer can replace it.',
	other: 'Tell us what you need.'
};

/** Kinds that need a photo, because the printer asks for one before replacing a copy. */
export const kindsWithPhoto: readonly ProblemKind[] = ['damaged', 'misprinted'];

export function isProblemKind(value: unknown): value is ProblemKind {
	return typeof value === 'string' && (problemKinds as readonly string[]).includes(value);
}

export const problemStatuses = ['open', 'answered', 'closed'] as const;
export type ProblemStatus = (typeof problemStatuses)[number];

export const problemStatusLabels: Record<ProblemStatus, string> = {
	open: 'Waiting for the project',
	answered: 'Answered',
	closed: 'Closed'
};

/** The longest problem or answer, in characters. */
export const longestProblemText = 4000;

/** Open problems one order may have at once, so a leaked link cannot flood the project. */
export const openProblemsPerOrder = 5;

/** What a buyer reads about an order's status, on its page and on Account, Orders. */
export const orderStatusText: Record<string, string> = {
	'awaiting-payment': 'Waiting for payment. If you closed the payment page, you can order again from the book page.',
	paid: 'Paid. The order is on its way to the printer.',
	'sent-to-printer': 'With Lulu. Printing starts within two hours and takes about 3 to 5 business days, then the copy ships.',
	'printer-refused': 'Lulu could not print this order. The project will fix it or refund you, and will write to you by email.',
	shipped: 'Shipped.',
	canceled: 'Canceled.',
	expired: 'The payment page expired before payment, so nothing was charged.'
};

/** A short status for lists. */
export const orderStatusLabels: Record<string, string> = {
	'awaiting-payment': 'Not paid',
	paid: 'Paid',
	'sent-to-printer': 'Printing',
	'printer-refused': 'Printer refused',
	shipped: 'Shipped',
	canceled: 'Canceled',
	expired: 'Expired'
};
