/**
 * The Federal collections with a browsing page of their own at
 * /laws/<identifier> (src/lib/server/browse-collections.ts). Kept plain, for
 * the address matcher (src/params/browse.ts), which runs in the browser too.
 */
export const browseIdentifiers = ['executive-orders'] as const;

export type BrowseIdentifier = (typeof browseIdentifiers)[number];

/** The collection a law page's record kind is browsed in, for the page's previous and next. */
const browsedKinds: Record<string, BrowseIdentifier> = { 'executive-order': 'executive-orders' };

export const browseCollectionOfKind = (kind: string): BrowseIdentifier | undefined => browsedKinds[kind];
