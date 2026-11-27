/**
 * Page families drawn by the Worker when a reader opens a page, from data
 * built with the site (src/lib/server/page-data.ts). Shared with the service
 * worker and tools/write-offline-sizes.mjs, so it must stay plain.
 *
 * Each family's pages are packed into a fixed number of files by a hash of
 * each page's key: /page-data/<family>/<number>.json, a JSON object from each
 * key to that page's data as devalue writes it. One file for each page came
 * to some 46,000 files by Nov. 27, 2026, more than half of the site's, and
 * Cloudflare takes at most 100,000 in a version.
 */
import { fileNumber } from './file-number.ts';

/** Where each family's built page data lives: /page-data/<family>/<number>.json. */
export const pageDataPrefix = '/page-data';

/**
 * `collections`: a Federal collection browsed with filters, such as the executive orders, at /laws/<identifier> (src/lib/server/browse-collections.ts).
 * `sections`: each section of Title 25 of the Code, at /laws/usc-25/<section> (src/lib/server/code-outline.ts).
 */
export const pageDataFamilies = ['cases', 'laws', 'collections', 'sections', 'biographies', 'justices', 'presidents', 'courts'] as const;

export type PageDataFamily = (typeof pageDataFamilies)[number];

/**
 * How many files each family's pages are packed into, chosen in Nov. 2026 so
 * each file is about 100 to 250 kB: a page view reads one whole file. A
 * change moves most pages to another file, which is fine, since every file
 * is written again with each build.
 */
export const pageDataFileCounts: Record<PageDataFamily, number> = {
	cases: 512,
	laws: 512,
	collections: 4,
	sections: 256,
	biographies: 128,
	justices: 32,
	presidents: 16,
	courts: 4
};

/** The number of the file that holds a page's data. */
export function pageDataFileNumber(family: PageDataFamily, key: string): number {
	return fileNumber(key, pageDataFileCounts[family]);
}

/** The address of one of a family's files, such as /page-data/cases/17.json. */
export function pageDataFilePath(family: PageDataFamily, number: number): string {
	return `${pageDataPrefix}/${family}/${number}.json`;
}

/** The address of the file that holds a page's data. */
export function pageDataPath(family: PageDataFamily, key: string): string {
	return pageDataFilePath(family, pageDataFileNumber(family, key));
}
