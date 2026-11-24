/**
 * The catalog of every piece of fixed text this build found
 * (src/lib/site-text-markers.ts), by name. Only Worker code may import it.
 */
import { builtPublication, siteTextCatalog } from 'virtual:site-text-catalog';
import type { SiteTextEntry } from '#lib/site-text-markers.ts';

export { builtPublication };

let byKey: Map<string, SiteTextEntry> | undefined;

/** Each piece of text by its name. */
export function catalogByKey(): Map<string, SiteTextEntry> {
	byKey ??= new Map(siteTextCatalog.map((entry) => [entry.key, entry]));
	return byKey;
}

export function catalogEntries(): readonly SiteTextEntry[] {
	return siteTextCatalog;
}
