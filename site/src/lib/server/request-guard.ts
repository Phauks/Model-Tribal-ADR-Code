/**
 * Guards for requests that change something anywhere on the site
 * (site/COLLABORATION.md, "Protection against unauthorized changes").
 *
 * SvelteKit already refuses form submissions from other sites by checking
 * the Origin header (SvelteKit configuration, "csrf"). This adds a second,
 * independent check that also covers requests that are not form submissions,
 * using the browser's Fetch Metadata header Sec-Fetch-Site where it is sent
 * and the Origin header otherwise, as the OWASP Cross-Site Request Forgery
 * Prevention Cheat Sheet recommends ("Fetch Metadata headers"; "Verifying
 * origin with standard headers"). The session cookie is also SameSite=Lax
 * (src/lib/server/sign-in.ts).
 */

/** Methods that change something. GET and HEAD must never change anything. */
export function changesSomething(method: string): boolean {
	return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}

/**
 * Whether a request that changes something came from another site. A
 * request with neither header (for example from a command-line tool) carries
 * no browser cookies from another site's page, so it is not a cross-site
 * forgery; it still needs a valid session to do anything.
 */
export function isCrossSite(request: Request, siteOrigin: string): boolean {
	const fetchSite = request.headers.get('sec-fetch-site');
	if (fetchSite) return fetchSite !== 'same-origin' && fetchSite !== 'none';
	const origin = request.headers.get('origin');
	if (origin) return origin !== siteOrigin;
	return false;
}

/**
 * Addresses that other services post to from their own servers, each
 * checked another way: payment and printer webhooks by their signature, and
 * a mail program's one-click unsubscribe (RFC 8058) by the token in its
 * address. A server sends neither Sec-Fetch-Site nor Origin, so these pass
 * the check anyway; listing them keeps them working if a service ever
 * starts sending an Origin header.
 */
const fromOtherServices: RegExp[] = [
	/^\/book\/payment-webhook\/?$/,
	/^\/book\/printer-webhook\/?$/,
	/^\/sponsorship\/payment-webhook\/?$/,
	/^\/mail\/unsubscribe\/[^/]+\/one-click\/?$/
];

/**
 * Paths whose changes are guarded: every path except the few that other
 * services post to. Until the site has its own domain, every other Worker on
 * the same workers.dev account address counts as the same site, so the
 * session cookie's SameSite setting alone would not stop a page there from
 * sending a change here; this check refuses "same-site" too.
 */
export function isGuardedPath(path: string): boolean {
	return !fromOtherServices.some((pattern) => pattern.test(path));
}
