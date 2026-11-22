/**
 * Copies of public documents that the website serves itself (Trevor asked for
 * this on Nov. 22, 2026): a Statutes at Large page, a Federal Register notice
 * or another work of the United States government that a page links to. The
 * copy sits in the private sourceDocuments bucket and is served at
 * /copies/<key>, so a reader gets it from this site, quickly, rather than from
 * a government site that may be slow, moved or down. The original address
 * stays the cited source.
 *
 * The list comes from the capture index, research/capture-index.csv
 * (decision record 0027), which has one row for every file in the bucket.
 * Only rows whose redistribution column says "yes" are listed here, and only
 * PDF files, so a private capture (a Westlaw printout, a nation's
 * constitution) is never served, whatever the bucket holds.
 */

export interface PublicCopy {
	/** The file's key in the bucket, which is also its path below /copies/. */
	key: string;
	mediaType: string;
	sha256: string;
	bytes: number;
	/** The addresses the file was published at, the address it was fetched from first. */
	links: string[];
	/** The date the copy was made, as YYYY-MM-DD. */
	captured: string;
	title: string;
	/** Why the project may share it, in words (project analysis, not legal advice). */
	rights: string;
}

/** Media types the Worker serves as copies. */
export const servedMediaTypes = new Set(['application/pdf']);

/** The site's own address of a copy. */
export function copyPath(copy: Pick<PublicCopy, 'key'>): string {
	return `/copies/${copy.key.split('/').map(encodeURIComponent).join('/')}`;
}

/**
 * The form of an address used to match a page's link to a copy: the same
 * address without a fragment such as #page=1, and with http and https alike.
 */
export function linkForMatching(link: string): string | undefined {
	if (!URL.canParse(link)) return undefined;
	const address = new URL(link);
	if (address.protocol !== 'https:' && address.protocol !== 'http:') return undefined;
	address.hash = '';
	address.protocol = 'https:';
	return address.href;
}

/** Looks up copies by any of the addresses they were published at. */
export function copiesByLink(copies: PublicCopy[]): Map<string, PublicCopy> {
	const byLink = new Map<string, PublicCopy>();
	for (const copy of copies) {
		for (const link of copy.links) {
			const matching = linkForMatching(link);
			if (matching && !byLink.has(matching)) byLink.set(matching, copy);
		}
	}
	return byLink;
}

/** A file size in words, such as "1.2 MB". */
export function fileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} bytes`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
