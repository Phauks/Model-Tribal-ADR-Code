/**
 * Recognizes the Worker's own mail runs (tools/add-mail-handlers.mjs). The
 * Worker's email, queue and scheduled handlers pass their work to routes
 * under /mail/internal/ inside the same copy of the Worker, with a random
 * token made at the first run and kept only in that copy's memory, under the
 * key below. Nothing outside can know the token, and without the handlers
 * (on a computer, in tests) there is no token and every request is refused.
 */
import { sameSecret } from '../same-secret.ts';

export const mailRunTokenKey = 'model-tribal-adr-code.mail-run-token';
export const mailRunHeader = 'x-mail-run';

export function isMailRun(request: Request): boolean {
	const expected = (globalThis as Record<string, unknown>)[mailRunTokenKey];
	const given = request.headers.get(mailRunHeader);
	return typeof expected === 'string' && expected.length >= 32 && sameSecret(given, expected);
}
