/**
 * Recognizes the Worker's own scheduled run (tools/add-scheduled-run.mjs).
 * The scheduled handler makes a random token at its first run, keeps it
 * on globalThis under the key below, and sends it in a header when it passes
 * the run to /following/scheduled inside the same copy of the Worker. Nothing
 * outside that copy can know the token, and without a scheduled handler
 * (on a computer, in tests) there is no token and every request is refused.
 */
import { sameSecret } from './same-secret.ts';

export const scheduledTokenKey = 'model-tribal-adr-code.scheduled-run-token';
export const scheduledTokenHeader = 'x-scheduled-run';

export function isScheduledRun(request: Request): boolean {
	const expected = (globalThis as Record<string, unknown>)[scheduledTokenKey];
	const given = request.headers.get(scheduledTokenHeader);
	return typeof expected === 'string' && expected.length >= 32 && sameSecret(given, expected);
}
