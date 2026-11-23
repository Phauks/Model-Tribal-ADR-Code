/**
 * Opens a ZIP file in the browser so each file inside is sent, checked and
 * scanned on its own (docs/uploads.md, "The upload table"). The server never
 * takes archives, because nobody can see what is inside one.
 *
 * Guards: the sizes a ZIP claims are added up from its directory before
 * anything is unpacked, and fflate never writes more than the size an entry
 * claims, so a ZIP bomb stops at the limits below instead of filling memory.
 * Paths inside are only ever used as names in the table: "..", "." and empty
 * parts are dropped and nothing is written to disk.
 */
import { unzipSync } from 'fflate';

/** A ZIP larger than this is not opened here; the sender unpacks it first. */
export const largestZipBytes = 1024 * 1024 * 1024;
/** The most the files inside one ZIP (with any ZIPs inside it) may add up to. */
export const largestUnpackedBytes = 2 * 1024 * 1024 * 1024;
export const mostFilesInZip = 10_000;
/** A ZIP inside a ZIP is opened too, this many levels down. */
export const deepestZip = 3;
/** One entry claiming to grow more than this many times over, and past 100 MB, is a ZIP bomb. */
const mostGrowth = 1000;

export interface UnzippedFile {
	/** Its place inside the ZIP, cleaned, such as "folder/file.pdf". */
	path: string;
	bytes: Uint8Array;
}

export class ZipProblem extends Error {}

export function isZipName(name: string): boolean {
	return /\.zip$/i.test(name);
}

/** "a/../b//./c.pdf" becomes "a/b/c.pdf"; a name with nothing left is null. */
export function cleanZipPath(name: string): string | null {
	const parts = name
		.replaceAll('\\', '/')
		.split('/')
		.filter((part) => part !== '' && part !== '.' && part !== '..');
	return parts.length > 0 ? parts.join('/') : null;
}

/** Leftovers that zipping on a Mac or Windows adds: never worth sending. */
function isLeftover(path: string): boolean {
	const base = path.split('/').at(-1) ?? '';
	return path.startsWith('__MACOSX/') || base.startsWith('.') || base === 'desktop.ini' || base === 'Thumbs.db';
}

/** Every file inside a ZIP, with ZIPs inside it opened too. Throws ZipProblem with a reason the sender can read. */
export function unzipFiles(zip: Uint8Array): UnzippedFile[] {
	const budget = { bytes: 0, files: 0 };
	return open(zip, '', 1, budget);
}

function open(zip: Uint8Array, prefix: string, depth: number, budget: { bytes: number; files: number }): UnzippedFile[] {
	if (zip.byteLength > largestZipBytes) throw new ZipProblem('This ZIP is too large to open here. Unpack it on your computer and send the folder.');
	let entries: Record<string, Uint8Array>;
	try {
		entries = unzipSync(zip, {
			filter: (entry) => {
				if (entry.name.endsWith('/')) return false;
				const path = cleanZipPath(entry.name);
				if (!path || isLeftover(path)) return false;
				budget.files += 1;
				budget.bytes += entry.originalSize;
				if (budget.files > mostFilesInZip) throw new ZipProblem(`This ZIP has more than ${mostFilesInZip.toLocaleString('en-US')} files. Unpack it on your computer and send the folder.`);
				if (budget.bytes > largestUnpackedBytes) throw new ZipProblem('This ZIP unpacks to more than 2 GB. Unpack it on your computer and send the folder.');
				if (entry.originalSize > 100 * 1024 * 1024 && entry.originalSize > entry.size * mostGrowth) {
					throw new ZipProblem('This ZIP looks built to fill memory when opened, so it was not opened.');
				}
				return true;
			}
		});
	} catch (problem) {
		if (problem instanceof ZipProblem) throw problem;
		throw new ZipProblem('This ZIP could not be opened. It may be damaged or locked with a password.');
	}
	const files: UnzippedFile[] = [];
	for (const [name, bytes] of Object.entries(entries)) {
		const path = `${prefix}${cleanZipPath(name)}`;
		if (isZipName(path) && depth < deepestZip) files.push(...open(bytes, `${path}/`, depth + 1, budget));
		else files.push({ path, bytes });
	}
	return files;
}
