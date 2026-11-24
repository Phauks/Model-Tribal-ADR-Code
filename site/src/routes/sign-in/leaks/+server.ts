/**
 * The live "Not found in known password leaks" check under Choose a password
 * (SignInForms.svelte). The browser hashes what was typed with SHA-1 and asks
 * here for the first five characters of the hash only; this answers with Have
 * I Been Pwned's list of hash endings that start with them (padded with
 * made-up entries), and the browser looks for its own ending in the list. The
 * password and its full hash never leave the browser, and the reader's
 * browser never contacts Have I Been Pwned itself. The server still checks the
 * password when the form is sent (src/lib/server/password-checks.ts).
 */
import { error } from '@sveltejs/kit';
import { pwnedPasswordsRange } from '#lib/server/password-checks.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async ({ url, fetch }) => {
	const prefix = (url.searchParams.get('prefix') ?? '').toUpperCase();
	if (!/^[0-9A-F]{5}$/.test(prefix)) error(400, 'Give the first five characters of a SHA-1 hash.');
	try {
		const response = await fetch(`${pwnedPasswordsRange}${prefix}`, {
			headers: { 'add-padding': 'true', 'user-agent': 'model-tribal-adr-code-password-check' },
			signal: AbortSignal.timeout(4000)
		});
		if (!response.ok) throw new Error(`Pwned Passwords answered ${response.status}`);
		return new Response(await response.text(), {
			headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'private, max-age=3600' }
		});
	} catch (problem) {
		console.warn('Could not ask Pwned Passwords for a range', problem);
		error(503, 'The leak check is not available right now.');
	}
};
