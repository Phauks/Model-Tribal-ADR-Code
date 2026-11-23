/**
 * The SHA-256 of every file a reader can download from this site, and of every copy of a document
 * it holds (site/DESIGN.md, section 10, "Checking a file"). Trevor asked on Nov. 23, 2026 for every
 * download and document to come with a way to check it. tools/write-checksums.mjs writes the lists
 * after the build:
 *
 * - /checksums.json: every file, as { built, files: { "/path": { sha256, bytes } } };
 * - /checksums.txt: the same in the form sha256sum reads, "<hash>  <path>";
 * - /checksums/downloads.json: the same shape, without the document copies and each nation's own
 *   files, so a page that shows a hash beside a download reads a small file.
 *
 * The ZIPs of documents are put together when they are asked for, so they have no hash of their
 * own; each one lists the SHA-256 of every file inside it.
 */

export const checksumsAddress = '/checksums.json';
export const checksumsTextAddress = '/checksums.txt';
export const downloadChecksumsAddress = '/checksums/downloads.json';
/**
 * Where a reader checks a file: the "Checking a file" section of the Downloads page (Trevor asked on
 * Nov. 23, 2026 that verifying be part of that page rather than a page of its own). The old /verify
 * address sends readers there, with whatever hash its link carried.
 */
export const verifyPage = '/downloads';
export const verifySection = 'checking';
export const verifyAddress = `${verifyPage}#${verifySection}`;

export interface ChecksumEntry {
	sha256: string;
	bytes: number;
}

export interface ChecksumManifest {
	/** The build the list was made with. */
	built: string;
	files: Record<string, ChecksumEntry>;
}

const loaded = new Map<string, Promise<ChecksumManifest | undefined>>();

function load(address: string): Promise<ChecksumManifest | undefined> {
	let manifest = loaded.get(address);
	if (!manifest) {
		manifest = fetch(address)
			.then((response) => (response.ok ? (response.json() as Promise<ChecksumManifest>) : undefined))
			.catch(() => undefined);
		loaded.set(address, manifest);
		// A failed read is tried again next time, perhaps once the reader is back online.
		void manifest.then((value) => value ?? loaded.delete(address));
	}
	return manifest;
}

/** The small list: downloads offered on the Downloads page and in the model forms. */
export function downloadChecksums(): Promise<ChecksumManifest | undefined> {
	return load(downloadChecksumsAddress);
}

/** The whole list, with every document copy. About half a megabyte. */
export function allChecksums(): Promise<ChecksumManifest | undefined> {
	return load(checksumsAddress);
}

/** The hash of one file on this site, such as "/zip/data.zip", or undefined if none is listed. */
export async function checksumFor(path: string): Promise<ChecksumEntry | undefined> {
	return (await downloadChecksums())?.files[path] ?? (await allChecksums())?.files[path];
}

/** The files on this site with this hash. */
export function pathsWithHash(manifest: ChecksumManifest, sha256: string): string[] {
	const wanted = sha256.trim().toLowerCase();
	return Object.entries(manifest.files)
		.filter(([, entry]) => entry.sha256 === wanted)
		.map(([path]) => path);
}

/** The Downloads page's file checker, set to check a file against this hash. */
export function verifyLink(sha256: string, name?: string): string {
	const query = new URLSearchParams({ sha256 });
	if (name) query.set('name', name);
	return `${verifyPage}?${query}#${verifySection}`;
}

/** The name a path's file is saved under, "/copies/a/b%20c.pdf" -> "b c.pdf". */
export function fileName(path: string): string {
	const last = path.split('/').at(-1) ?? path;
	try {
		return decodeURIComponent(last);
	} catch {
		return last;
	}
}
