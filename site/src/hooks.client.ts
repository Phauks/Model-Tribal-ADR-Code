/**
 * Errors in the reader's browser (site/ERRORS.md). An error SvelteKit catches
 * while moving between pages, and any other error a page's scripts throw
 * and nothing catches, goes to the site (src/lib/problem-reports.ts), and
 * the error page shows its reference.
 */
import type { ClientInit, HandleClientError } from '@sveltejs/kit/hooks';
import { isBrowserNoise, sendProblem } from '#lib/problem-reports.ts';

export const handleError: HandleClientError = ({ kind, error, event }) => {
	if (kind !== 'unknown') return;
	const reference = sendProblem(error, { code: 'page.unexpected', path: event.url.pathname, place: event.route.id ?? undefined });
	return { reference };
};

export const init: ClientInit = () => {
	addEventListener('error', (event) => {
		if (isBrowserNoise(event.message, event.filename)) return;
		sendProblem(event.error ?? event.message, { code: 'browser.uncaught', path: location.pathname, place: event.filename ? new URL(event.filename).pathname : undefined });
	});
	addEventListener('unhandledrejection', (event) => {
		const reason: unknown = event.reason;
		if (isBrowserNoise(reason instanceof Error ? reason.message : String(reason))) return;
		sendProblem(reason, { code: 'browser.unhandled', path: location.pathname });
	});
};
