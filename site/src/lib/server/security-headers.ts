/**
 * Security headers sent with every page and file (decision record 0055).
 * The Worker adds them to the pages it answers (src/hooks.server.ts); the
 * pages and files built ahead of time get the same lines from site/_headers,
 * which tests/security-headers.test.ts keeps in step with this list.
 *
 * The Content Security Policy that limits scripts is SvelteKit's own
 * (vite.config.ts, "csp"): it lists a hash of each script the site writes
 * into a page, so a script that arrives inside essay, glossary or timeline
 * text shown with {@html} does not run. SvelteKit writes it into each page
 * built ahead of time as a <meta> tag, where frame-ancestors cannot go, so
 * the directives below are sent as a second policy in a header. A browser
 * applies both.
 */

/** Who may show a page in a frame: the site's own pages only. */
export const publicFrameAncestors = "'self'";

/**
 * The second policy: no plugins (object, embed), no <base> pointing links
 * elsewhere, and who may frame the page.
 */
export function framePolicy(frameAncestors: string): string {
	return `frame-ancestors ${frameAncestors}; object-src 'none'; base-uri 'self'`;
}

/** Headers for every public page and file. Private pages tighten some of them (hooks.server.ts). */
export const publicSecurityHeaders: Readonly<Record<string, string>> = {
	'content-security-policy': framePolicy(publicFrameAncestors),
	'x-content-type-options': 'nosniff',
	'referrer-policy': 'strict-origin-when-cross-origin',
	'x-frame-options': 'SAMEORIGIN'
};
