/**
 * Whether search engines may index the site. The site is a pre-release draft
 * (0.0.x): nation pages are drafted from public sources and have not been
 * reviewed by the nations, so until the first release every page says
 * `noindex` (src/routes/+layout.svelte) and robots.txt asks every crawler to
 * stay out (src/routes/robots.txt). The sitemap is built all the same
 * (src/lib/server/sitemap-build.ts, /sitemap.xml), so it is ready on the day.
 *
 * Opening the site is this one line: set it to true. The layout then drops
 * its `noindex`, and robots.txt lets crawlers in, still keeps them out of
 * private and signed-in pages, and names the sitemap (docs/domain-to-do.md,
 * section 2; docs/sitemap.md).
 */
export const openToSearchEngines = false;

/** The sitemap's address on the site: an index of its parts (src/routes/sitemap.xml). */
export const sitemapPath = '/sitemap.xml';

/**
 * robots.txt (RFC 9309). Closed, it asks every crawler to stay out and keeps
 * the Sitemap line commented out. Open, it keeps crawlers out of the private
 * and signed-in pages and names the sitemap.
 */
export function robotsText(siteAddress: string, privatePages: readonly string[], open = openToSearchEngines): string {
	const sitemap = `Sitemap: ${siteAddress.replace(/\/+$/, '')}${sitemapPath}`;
	if (!open) {
		return [
			'# The site is a pre-release draft (0.0.x). Nation pages are drafted from',
			'# public sources and have not been reviewed by the nations, so search engines',
			'# are asked not to index the site until the first release',
			'# (site/src/lib/search-engines.ts, openToSearchEngines).',
			'User-agent: *',
			'Disallow: /',
			'',
			`# ${sitemap}`,
			''
		].join('\n');
	}
	return ['User-agent: *', ...[...new Set(privatePages)].sort().map((prefix) => `Disallow: ${prefix}`), '', sitemap, ''].join('\n');
}
