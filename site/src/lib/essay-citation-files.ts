/**
 * Where the full citation of every source record is kept for the Worker.
 * They are too big to go in the Worker's own code: by Nov. 26, 2026 the
 * 22,672 citations came to about 51 MB, which took the Worker past
 * Cloudflare's 64 MiB limit and stopped every deploy. So the build writes
 * them as static files under /page-data/essay-citations/ (vite.config.ts,
 * "essay-library"), and the Worker reads the ones a page needs when it draws
 * it (src/lib/server/essay-citations.ts). Every source is public, as its
 * record page is, so the files hold only what the public pages already show.
 *
 * The citations are spread over a fixed number of files by a hash of the
 * key, so a page that cites a few sources reads a few small files, and the
 * number of files stays the same however many sources are added.
 *
 * Shared by the build (in Node) and the Worker, so it must stay plain.
 */
import { pageDataPrefix } from './page-data.ts';

/** How many files the citations are spread over: about 20 citations, 50 KB, in each. */
export const citationFileCount = 1024;

/** Which file holds a key's citation: a 32-bit FNV-1a hash of the key, taken modulo the number of files. */
export function citationFileNumber(key: string): number {
	let hash = 0x811c9dc5;
	for (let index = 0; index < key.length; index++) {
		hash ^= key.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return hash % citationFileCount;
}

/** The address of a citation file, such as /page-data/essay-citations/417.json. */
export function citationFilePath(number: number): string {
	return `${pageDataPrefix}/essay-citations/${number}.json`;
}

/** The address of the list of every source's key and citation as plain text, for the editor's "Cite a source" search. */
export const citationTextsPath = `${pageDataPrefix}/essay-citations/plain.json`;

/** A citation's HTML as plain text, without the list of where to read it. */
export function plainCitation(html: string): string {
	return html
		.replace(/ ?<span class="reading-links">[\s\S]*$/, '')
		.replace(/<[^>]+>/g, '')
		.replaceAll('&amp;', '&')
		.replaceAll('&#38;', '&')
		.replaceAll('&lt;', '<')
		.replaceAll('&gt;', '>')
		.replaceAll('&quot;', '"')
		.replaceAll('&#39;', "'")
		.replace(/\s+/g, ' ')
		.trim();
}
