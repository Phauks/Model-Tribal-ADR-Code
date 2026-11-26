/**
 * Copies of public documents that the website serves itself (Trevor asked for
 * this on Nov. 22, 2026): a Statutes at Large page, a Federal Register notice
 * or another work of the United States government that a page links to. The
 * copy sits in the private sourceDocuments bucket and is served at
 * /copies/<key>, so a reader gets it from this site, quickly, rather than from
 * a government site that may be slow, moved or down. The original address
 * stays the cited source.
 *
 * Since decision record 0031 (Trevor, Nov. 22, 2026) the site also serves its
 * copies of nations' constitutions and laws, until a nation asks for a copy
 * to be removed or redacted.
 *
 * The list comes from the capture index, research/capture-index.csv
 * (decision record 0030), which has one row for every file in the bucket.
 * Only rows whose redistribution column says "yes" are listed here, and only
 * PDFs and saved web pages, so a private capture (a Westlaw printout, a
 * journal article) is never served, whatever the bucket holds.
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
	/** The capture index topic, such as govinfo or constitutions. */
	topic: string;
	/** The nations the document belongs to, by record id. */
	nations: string[];
	/** Why the project may share it, in words (project analysis, not legal advice). */
	rights: string;
	/**
	 * A Tribal court opinion with protected people's names replaced by initials.
	 * It has no links: the original still has the names in it.
	 */
	namesReplaced?: boolean;
}

/** Media types the Worker serves as copies. A saved web page is served in a sandbox, with nothing it could load or run. */
export const servedMediaTypes = new Set(['application/pdf', 'text/html']);

/** How a link names the file's kind, such as "PDF" or "saved web page". */
export function mediaLabel(mediaType: string): string {
	return mediaType === 'text/html' ? 'saved web page' : 'PDF';
}

/** The request form, filled in to ask that a name in a court opinion be replaced with initials (docs/requests.md). */
export function nameRequestPath(copy: Pick<PublicCopy, 'key'>): string {
	return `/requests?${new URLSearchParams({ kind: 'replace-name', record: `copies/${copy.key}` }).toString().replaceAll('%2F', '/')}`;
}

/** The request form, filled in to ask that a copy be taken down or redacted (docs/requests.md). */
export function removalRequestPath(copy: Pick<PublicCopy, 'key'>): string {
	return `/requests?${new URLSearchParams({ kind: 'remove', record: `copies/${copy.key}` }).toString().replaceAll('%2F', '/')}`;
}

/**
 * The site's own address of a copy's file: what a download, a ZIP, offline
 * saving and the Verify page use. A reader clicking a link to read a document
 * goes to copyPagePath instead.
 */
export function copyPath(copy: Pick<PublicCopy, 'key'>): string {
	return `/copies/${encodedKey(copy.key)}`;
}

/**
 * The page that shows a copy inside the site, with the masthead and the left
 * sidebar, and the file in a frame below its title, date and SHA-256 (Trevor,
 * Nov. 23, 2026: "clicking into a document should still invoke the header and
 * left sidebar, otherwise you completely lose navigation"). Every link that
 * opens a document for reading goes here; the file stays at copyPath.
 */
export function copyPagePath(copy: Pick<PublicCopy, 'key'>): string {
	return `${copyPagePrefix}${encodedKey(copy.key)}`;
}

/** Where the document pages live: /copies/view/<key>. */
export const copyPagePrefix = '/copies/view/';

function encodedKey(key: string): string {
	return key.split('/').map(encodeURIComponent).join('/');
}

/**
 * The prebuilt file that holds a copy's title, date and other details for
 * its page (src/routes/copies/details/[shard].json): copies are split by the
 * first two characters of their SHA-256, so the Worker reads one small file
 * rather than carrying every title in its own code.
 */
export function copyDetailsShard(copy: Pick<PublicCopy, 'sha256'>): string {
	return copy.sha256.slice(0, 2).toLowerCase();
}

export function copyDetailsPath(shard: string): string {
	return `/copies/details/${shard}.json`;
}

/** What a copy's page shows beyond the build-time list (src/lib/server/copy-lists.ts, copyDetails). */
export interface CopyDetails {
	title: string;
	/** "PDF" or "saved web page". */
	kind: string;
	/** YYYY-MM-DD, or empty. */
	captured: string;
	nations: { id: string; name: string }[];
	/** The short list the copy is in, below /copies/list/. */
	list: { slug: string; title: string };
	/** For a tribal court opinion: its name, citation, court and date decided. */
	opinion?: { name: string; citation: string; court: string; decided: string; docket: string; namesReplaced?: boolean };
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
