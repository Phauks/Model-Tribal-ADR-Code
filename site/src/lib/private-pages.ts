/**
 * The site's private and signed-in pages, by the start of their address.
 * src/hooks.server.ts reads these to keep private pages out of caches and
 * frames and to look up who is signed in; robots.txt and the sitemap
 * (src/lib/search-engines.ts, src/lib/server/sitemap-build.ts) read them so
 * search engines are never sent to any of them.
 */

/** Pages that show private information and must never be cached or framed. */
export const privatePrefixes = ['/workspace', '/profile', '/account', '/sign-in', '/sign-out', '/requests', '/following', '/uploads', '/orders', '/book/orders', '/book/files', '/events', '/rooms', '/sponsorship'];

/** Pages that need to know who is signed in. Recent changes needs it for "Only pages I follow". */
export const signedInPrefixes = ['/workspace', '/profile', '/account', '/sign-in', '/following', '/uploads', '/files', '/events', '/rooms', '/sponsorship/invite', '/changes'];

/** Whether an address is the page at a prefix or under it. */
export function isUnder(path: string, prefixes: readonly string[]): boolean {
	return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/** Whether an address is a private or signed-in page. */
export const isPrivatePage = (path: string) => isUnder(path, privatePrefixes) || isUnder(path, signedInPrefixes);

/** Each private start of an address once, leaving out those another already covers, such as /sponsorship/invite under /sponsorship: what robots.txt keeps crawlers out of. */
export function disallowedPrefixes(): string[] {
	const all = [...new Set([...privatePrefixes, ...signedInPrefixes])];
	return all.filter((prefix) => !isUnder(prefix, all.filter((other) => other !== prefix)));
}
