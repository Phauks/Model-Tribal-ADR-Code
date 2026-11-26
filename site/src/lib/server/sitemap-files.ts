/**
 * The sitemap's files as this build writes them (src/routes/sitemaps/built),
 * worked out once per build: the parts and the list of them. Kept apart
 * from sitemap-build.ts because finding the stubs draws every case's and
 * law's page, which needs the whole site build.
 */
import type { BuiltSitemapIndex, BuiltSitemapPart } from '../sitemap.ts';
import { sitemapIndexFile, sitemapParts } from './sitemap-build.ts';
import { stubList } from './stub-list.ts';

let built: { parts: BuiltSitemapPart[]; index: BuiltSitemapIndex } | undefined;

export function builtSitemap(): { parts: BuiltSitemapPart[]; index: BuiltSitemapIndex } {
	if (!built) {
		const parts = sitemapParts(new Set(stubList().map((stub) => stub.link)));
		built = { parts, index: sitemapIndexFile(parts) };
	}
	return built;
}
