/**
 * Which pages take comments (docs/editing.md, "Comments on other pages"),
 * shared by the page (src/lib/components/PageComments.svelte) and the server
 * (src/lib/server/page-comments.ts). A page is named by its path without the
 * leading slash, such as "laws/indian-removal-act-1830".
 */

/** First parts of addresses whose pages take no comments: workspace and account pages, and essays, which have their own. */
const withoutComments = new Set([
	'workspace',
	'account',
	'account-deleted',
	'profile',
	'sign-in',
	'sign-out',
	'rooms',
	'orders',
	'offline',
	'mail',
	'files',
	'uploads',
	'search',
	'zip',
	'copies',
	'restricted-files',
	'restricted-pages',
	'site-text',
	'essays',
	'back-matter',
	'published-essays',
	'foundations',
	'requests',
	'verify'
]);

/**
 * The page a comment is on, from an address such as "/laws/x/" or
 * "laws/x", or null for an address that takes no comments.
 */
export function pagePath(address: string): string | null {
	const path = address.split(/[?#]/u)[0].replace(/^\/+|\/+$/gu, '');
	if (path.length > 300 || !/^[a-z0-9][a-z0-9._~\-/]*$/u.test(path) || path.includes('..') || path.includes('//')) return null;
	if (withoutComments.has(path.split('/')[0])) return null;
	return path;
}

