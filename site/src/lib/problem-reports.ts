/**
 * Sends a problem that happened in the reader's browser to the site
 * (POST /problems, src/routes/problems/+server.ts), where it is reported
 * like any other (src/lib/server/report.ts, site/ERRORS.md). Until Nov. 27,
 * 2026 an error in a reader's browser never left it.
 *
 * What is sent: the problem's code, its message and stack with secrets taken
 * out, the page's path without its query, and the reference the reader was
 * shown. Nothing about the reader is sent. A page sends at most ten, and the
 * same message once, so a loop cannot flood the site.
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

/** What goes to the site for a problem. Exported for tests. */
export function browserProblem(problem: unknown, where: { code?: string; path: string; place?: string; reference?: string }): BrowserProblem {
	const [message = 'Unknown problem', ...causes] = causeChain(problem).map((text) => cut(withoutSecrets(text), 500));
	const body: BrowserProblem = {
		code: codeOf(problem, where.code ?? 'browser.unexpected'),
		reference: isReference(where.reference) ? where.reference : newReference(),
		message,
		causes,
		path: where.path.split('?')[0] ?? where.path
	};
	if (where.place) body.place = where.place;
	if (problem instanceof Error && problem.stack) body.stack = cut(withoutSecrets(problem.stack), 2000);
	return body;
}

/**
 * Sends a problem from the browser and returns the reference to show the
 * reader. Sending never throws: if it cannot go, the reader still sees the
 * reference, and the problem stays in the browser's console.
 */
export function sendProblem(problem: unknown, where: { code?: string; path: string; place?: string; reference?: string }): string {
	const body = browserProblem(problem, where);
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
