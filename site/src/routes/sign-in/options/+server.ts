import { json } from '@sveltejs/kit';
import { workerEnvironment } from '#lib/server/environment.ts';
import { availableProviders } from '#lib/server/outside-sign-in.ts';
import { emailDelivery } from '#lib/server/sign-in-email.ts';
import { turnstileSiteKey } from '#lib/server/turnstile.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

/**
 * What the masthead's sign-in panel needs to know before it shows its forms
 * (src/lib/components/AccountLink.svelte): whether this copy of the site can
 * send codes by email, which Email me a code and Create an account need; the
 * site key of the "are you a person?" check, when it is on
 * (src/lib/server/turnstile.ts); and whether Google and Microsoft sign-in are
 * switched on (src/lib/server/outside-sign-in.ts). The pages that open the
 * panel are built ahead of time, so they ask here.
 */
export const GET: RequestHandler = ({ url }) => {
	const environment = workerEnvironment();
	return json(
		{
			codesAvailable: emailDelivery(environment, url).kind !== 'none',
			turnstileSiteKey: turnstileSiteKey(environment) ?? null,
			providers: availableProviders(environment)
		},
		{ headers: { 'cache-control': 'no-store' } }
	);
};
