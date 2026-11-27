/**
 * Which pages take comments (docs/editing.md, "Comments on other pages"),
 * shared by the page (src/lib/components/PageComments.svelte) and the server
 * (src/lib/server/page-comments.ts). A page is named by its path without the
 * leading slash, such as "laws/indian-removal-act-1830".
 */

/**
 * First parts of addresses whose pages take no comments (Trevor, Nov. 27,
 * 2026: commenting "should be" on every page). Each is left out for a reason
 * a comment cannot get around:
 * - private to the person or the team, where a comment's quoted words would
 *   copy what only some people may see to everyone who reads the page's
 *   comments: the workspace, accounts, profiles, signing in and out, your
 *   uploads and your book orders;
 * - addresses that carry a secret, which a comment would keep: links from
 *   emails and sponsorship invitations;
 * - video calls, which fill the window without the masthead: rooms (and an
 *   event's room, below);
 * - addresses that are files or data, not pages: files, uploads, zip files,
 *   site text, published essays' text and restricted files, and the address
 *   the Worker draws restricted pages at, whose comments belong to the
 *   page's own address.
 */
const withoutComments = new Set([
	'workspace',
	'account',
	'account-deleted',
	'profile',
	'sign-in',
	'sign-out',
	'uploads',
	'orders',
	'mail',
	'sponsorship',
	'rooms',
	'files',
	'zip',
	'site-text',
	'published-essays',
	'restricted-files',
	'restricted-pages'
]);

/** Sections whose own pages, such as /essays/<slug>, have the essays' commenting on drafts (EssayArticle.svelte); their lists and history pages take page comments. */
const withOwnComments = new Set(['essays', 'foundations', 'back-matter', 'news']);

/** The home page's name, since a page's name is its address without the slashes. */
export const homePage = 'home';

/**
 * The page a comment is on, from an address such as "/laws/x/" or
 * "laws/x", or null for an address that takes no comments. The home page
 * is "home". Addresses keep their capitals and %-escapes, as a source
 * document's copy does (/copies/view/govinfo/STATUTE-100/...).
 */
export function pagePath(address: string): string | null {
	const path = address.split(/[?#]/u)[0].replace(/^\/+|\/+$/gu, '') || homePage;
	if (path.length > 300 || !/^[a-z0-9][A-Za-z0-9._~%\-/]*$/u.test(path) || path.includes('..') || path.includes('//')) return null;
	const parts = path.split('/');
	if (withoutComments.has(parts[0])) return null;
	if (withOwnComments.has(parts[0]) && parts.length === 2) return null;
	if (parts[0] === 'events' && parts[2] === 'room') return null;
	return path;
}

/** The address of a page named by pagePath(), for links to its comments. */
export function pageAddress(path: string): string {
	return path === homePage ? '/' : `/${path}`;
}
