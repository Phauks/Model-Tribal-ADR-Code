/**
 * Saving our copies of documents for offline reading (site/DESIGN.md, section 10). Trevor asked on
 * Nov. 23, 2026 for offline saving to follow which files the site may share: the United States
 * documents it holds are saved as one set, and each nation's constitutions, laws and court opinions as a set of
 * their own, from the nation's page, since all of them together come to several gigabytes.
 *
 * Copies keep their own cache, apart from the build's, because they do not change from one build to
 * the next: a new copy of a document gets a new address. When a build no longer lists a saved copy
 * (a nation asked us to remove it), the service worker deletes it from that cache as it installs.
 *
 * Shared by src/service-worker/index.ts, src/lib/offline-saving.ts and the build's lists
 * (src/routes/copies/offline/), so it must not use the page or the worker's own globals.
 */

/** The cache that holds saved copies. It does not start with the build caches' prefix, so updates leave it alone. */
export const documentsCacheName = 'documents';

/** A set of copies a reader can save: the United States documents, or one nation's documents. */
export type DocumentSet = 'federal' | `nation:${string}`;

/**
 * One copy: its address on this site, its size in bytes, its SHA-256, its title, the address it was
 * published at and the name it is saved under (src/lib/readable-file-names.ts).
 */
export type DocumentFile = [path: string, bytes: number, sha256: string, title?: string, original?: string, name?: string];

/** The list of a set's copies, built with the site. */
export interface DocumentSetList {
	title: string;
	files: DocumentFile[];
}

/** The short list of every set, built with the site, for the Data section. */
export interface DocumentSetSummary {
	federal: { title: string; count: number; bytes: number };
	nations: Record<string, { title: string; count: number; bytes: number }>;
}

export const summaryAddress = '/copies/offline.json';

export function nationSet(nation: string): DocumentSet {
	return `nation:${nation}`;
}

export function nationOfSet(set: DocumentSet): string | undefined {
	return set.startsWith('nation:') ? set.slice('nation:'.length) : undefined;
}

/** Where the build publishes a set's list. */
export function listAddress(set: DocumentSet): string {
	const nation = nationOfSet(set);
	return nation ? `/copies/offline/nations/${nation}.json` : '/copies/offline/federal.json';
}

/** Whether a string names a set, for messages and imported files. */
export function isDocumentSet(value: unknown): value is DocumentSet {
	return value === 'federal' || (typeof value === 'string' && /^nation:[a-z0-9-]+$/.test(value));
}

export interface DocumentSetStatus {
	set: DocumentSet;
	title: string;
	/** Copies in the set, in the list the device last read. */
	total: number;
	/** Copies of the set saved on this device. */
	saved: number;
	/** Bytes of the set saved on this device. */
	bytes: number;
	/** Bytes of the whole set. */
	totalBytes: number;
	/** The reader saved this set, so updates save its new copies too. */
	kept: boolean;
}

export interface DocumentsStatus {
	sets: DocumentSetStatus[];
}

/** The short list of every set, or undefined offline. */
export async function documentSummary(): Promise<DocumentSetSummary | undefined> {
	try {
		const response = await fetch(summaryAddress);
		return response.ok ? ((await response.json()) as DocumentSetSummary) : undefined;
	} catch {
		return undefined;
	}
}
