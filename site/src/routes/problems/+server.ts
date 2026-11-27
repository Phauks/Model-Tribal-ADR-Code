/**
 * Where a reader's browser sends a problem that happened on a page
 * (src/lib/problem-reports.ts), to be reported like any other
 * (src/lib/server/report.ts, site/ERRORS.md). The answer is always empty:
 * the page has nothing to do with it.
 *
 * Anyone can send here, so what is kept is checked and cut short, and each
 * network address may send a limited number a minute (problemReportLimit in
 * wrangler.jsonc). The address is used only for that count and is not kept.
 */
import { isProblemCode, Problem } from '#lib/problems.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { reportHere } from '#lib/server/report-here.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

/** A report is a few kilobytes at most (src/lib/problem-reports.ts cuts its stack to 2,000 characters). */
const largestReport = 8 * 1024;

const nothing = () => new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });

function text(value: unknown, length: number): string | undefined {
	return typeof value === 'string' && value.length > 0 ? value.slice(0, length) : undefined;
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const limiter = workerEnvironment().problemReportLimit;
	if (limiter && !(await limiter.limit({ key: `problems:${getClientAddress()}` })).success) return nothing();
	if (Number(request.headers.get('content-length') ?? 0) > largestReport) return nothing();
	const raw = await request.text();
	if (raw.length > largestReport) return nothing();
	let body: Record<string, unknown>;
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== 'object') return nothing();
		body = parsed as Record<string, unknown>;
	} catch {
		// expected: anything that is not a report is ignored.
		return nothing();
	}
	const message = text(body.message, 500);
	const path = text(body.path, 300);
	if (!message || !path?.startsWith('/')) return nothing();

	const problem = new Problem(isProblemCode(body.code) ? body.code : 'browser.unexpected', message);
	problem.stack = text(body.stack, 2000);
	const causes = Array.isArray(body.causes) ? body.causes.map((cause) => text(cause, 500)).filter((cause) => cause !== undefined).slice(0, 4) : [];
	reportHere(problem, {
		source: 'browser',
		place: text(body.place, 200) ?? path,
		path,
		reference: text(body.reference, 12),
		details: causes.length > 0 ? { causes } : undefined
	});
	return nothing();
};
