/**
 * Guards for requests that change something in the workspace
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

/** Paths whose changes are guarded. */
export function isGuardedPath(path: string): boolean {
	return (
		path === '/workspace' ||
		path.startsWith('/workspace/') ||
		path === '/sign-out' ||
		path.startsWith('/sign-out/')
	);
}
