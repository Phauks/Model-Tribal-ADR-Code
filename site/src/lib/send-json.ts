/**
 * Sending a change to the workspace as JSON and reading its JSON answer, as the essay workspace's comments, sharing, credits and new-essay forms do.
 */

/** What a form shows when a change did not go through and the server gave no reason. */
export const notThroughProblem = 'That did not go through. Try again.';

/** The answer, when the change went through, or the problem to show when it did not. */
export type SentJson<Answer> = { ok: true; answer: Answer } | { ok: false; problem: string };

/**
 * Sends the payload as JSON with the method and reads the answer as JSON. It went through when the network answered, the status is 2xx, the answer is JSON and `complete` accepts it (by default, any answer); otherwise the problem is the server's own message or notThroughProblem.
 */
export async function sendJson<Answer extends object>(
	address: string,
	method: string,
	payload: unknown,
	options: { complete?: (answer: Answer) => boolean; headers?: Record<string, string> } = {}
): Promise<SentJson<Answer>> {
	const response = await fetch(address, {
		method,
		headers: { 'content-type': 'application/json', ...options.headers },
		body: JSON.stringify(payload)
	}).catch(() => /* expected: the request never got an answer; the caller shows notThroughProblem. */ null);
	const answer = (await response?.json().catch(() => /* expected: an answer that is not JSON gives the caller notThroughProblem to show. */ null)) as (Answer & { message?: string }) | null;
	if (!response?.ok || !answer || (options.complete && !options.complete(answer))) {
		return { ok: false, problem: answer?.message || notThroughProblem };
	}
	return { ok: true, answer };
}
