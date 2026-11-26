/**
 * Page families drawn by the Worker when a reader opens a page, from data
 * built with the site (src/lib/server/page-data.ts). Shared with the service
 * worker and tools/write-offline-sizes.mjs, so it must stay plain.
 */

/** Where each family's built page data lives: /page-data/<family>/<key>.json. */
export const pageDataPrefix = '/page-data';

export const pageDataFamilies = ['cases', 'laws', 'biographies', 'justices', 'presidents', 'courts'] as const;

export type PageDataFamily = (typeof pageDataFamilies)[number];

export function pageDataPath(family: PageDataFamily, key: string): string {
	return `${pageDataPrefix}/${family}/${encodeURIComponent(key)}.json`;
}
