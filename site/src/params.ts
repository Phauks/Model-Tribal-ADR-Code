/**
 * The site's address matchers (SvelteKit's defineParams). `browse` matches a
 * Federal collection with a browsing page, such as /laws/executive-orders,
 * ahead of the law pages at /laws/<key> (src/lib/browse-identifiers.ts).
 */
import { defineParams } from '@sveltejs/kit/params';
import { browseIdentifiers, type BrowseIdentifier } from '#lib/browse-identifiers.ts';

export const params = defineParams({
	browse: (parameter: string): BrowseIdentifier | undefined => (browseIdentifiers as readonly string[]).includes(parameter) ? (parameter as BrowseIdentifier) : undefined
});
