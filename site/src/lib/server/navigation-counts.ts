/**
 * The counts beside the links in the section menus (src/lib/site-navigation.ts):
 * each collection's count from the Statistics page's registry
 * (src/lib/server/collections.ts), worked out once while the site is built.
 * The Worker never counts: pages it renders show the menus without counts.
 */
import { collectionCounts } from './collections.ts';
import type { NavigationCounts } from '../site-navigation.ts';

let counted: NavigationCounts | undefined;

export function navigationCounts(): NavigationCounts {
	counted ??= Object.fromEntries(collectionCounts().map((collection) => [collection.identifier, collection.count]));
	return counted;
}
