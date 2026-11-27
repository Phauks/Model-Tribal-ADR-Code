/**
 * Sends a problem that happened in the reader's browser to the site
 * (POST /problems, src/routes/problems/+server.ts), where it is reported
 * like any other (src/lib/server/report.ts, site/ERRORS.md). Until Nov. 27,
 * 2026 an error in a reader's browser never left it.
 *
 * What is sent: the problem's code, its message and stack with secrets taken
 * out, the page's path without its query, and the reference the reader was
 * shown. Nothing about the reader is sent. A page sends at most ten, and the
 * same message once, so a loop cannot flood the site. A request that failed
 * because the reader is offline, or the network dropped it, is not sent: it
 * says nothing about the site, and could not reach it anyway.
 */
import { causeChain, codeOf, cut, isReference, newReference, withoutSecrets } from './problems.ts';

export const problemReportPath = '/problems';

export interface BrowserProblem {
	code: string;
	reference: string;
	message: string;
	causes: string[];
	path: string;
	place?: string;
	stack?: string;
}

const mostPerPage = 10;
const sent = new Set<string>();

/** Where a problem happened. The path defaults to the page's own. */
export interface ProblemPlace {
	code?: string;
	path?: string;
	place?: string;
	reference?: string;
}

/**
 * Whether a problem is the network's rather than the site's: the reader is
 * offline, or a request never got an answer ("Failed to fetch" in Chrome,
 * "NetworkError when attempting to fetch resource." in Firefox, "Load
 * failed" in Safari). An answer with an error status is not one of these;
 * the site reports its own errors where they happen.
 */
export function isNetworkFailure(problem: unknown): boolean {
	if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
	if (problem instanceof DOMException && problem.name === 'NetworkError') return true;
	return problem instanceof TypeError && /fetch|network|load failed/iu.test(problem.message);
}

function pagePath(): string {
	return typeof location === 'undefined' ? '/' : location.pathname;
}

/** What goes to the site for a problem. Exported for tests. */
export function browserProblem(problem: unknown, where: ProblemPlace): BrowserProblem {
	const path = where.path ?? pagePath();
	const [message = 'Unknown problem', ...causes] = causeChain(problem).map((text) => cut(withoutSecrets(text), 500));
	const body: BrowserProblem = {
		code: codeOf(problem, where.code ?? 'browser.unexpected'),
		reference: isReference(where.reference) ? where.reference : newReference(),
		message,
		causes,
		path: path.split('?')[0] ?? path
	};
	if (where.place) body.place = where.place;
	if (problem instanceof Error && problem.stack) body.stack = cut(withoutSecrets(problem.stack), 2000);
	return body;
}

/**
 * Sends a problem from the browser and returns the reference to show the
 * reader. Sending never throws: if it cannot go, the reader still sees the
 * reference, and the problem stays in the browser's console. A network
 * failure (isNetworkFailure) is only noted in the console, and a request
 * the page cancelled itself (AbortError) not at all.
 */
export function sendProblem(problem: unknown, where: ProblemPlace = {}): string {
	const body = browserProblem(problem, where);
	// A request the page cancelled itself, as when the reader moved on, is not a problem at all.
	if (problem instanceof DOMException && problem.name === 'AbortError') return body.reference;
	if (isNetworkFailure(problem)) {
		console.warn(body.code, body.reference, problem);
		return body.reference;
	}
	console.error(body.code, body.reference, problem);
	const key = `${body.code}|${body.message}`;
	if (sent.has(key) || sent.size >= mostPerPage) return body.reference;
	sent.add(key);
	try {
		const blob = new Blob([JSON.stringify(body)], { type: 'application/json' });
		if (!navigator.sendBeacon?.(problemReportPath, blob)) {
			void fetch(problemReportPath, { method: 'POST', body: blob, keepalive: true, credentials: 'same-origin' }).catch(() => {
				// expected: offline or the site is down; the problem is in the console above.
			});
		}
	} catch {
		// expected: a browser without Blob or beacons; the problem is in the console above.
	}
	return body.reference;
}

/** Noise from the browser itself or from extensions, which says nothing about the site. */
export function isBrowserNoise(message: string, file?: string): boolean {
	if (/^ResizeObserver loop/u.test(message)) return true;
	if (message === 'Script error.' || message === 'Script error') return true;
	if (file && typeof location !== 'undefined' && !file.startsWith(location.origin)) return true;
	return false;
}
