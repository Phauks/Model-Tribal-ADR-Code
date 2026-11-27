/**
 * The list of every copy of a public document the Worker may serve at
 * /copies/ (src/lib/public-copies.ts): only capture index rows marked for
 * redistribution. A file left off this list is never served, whatever the
 * private bucket holds.
 *
 * The list is about 6 MB, too big for the Worker's code (src/lib/built-files.ts),
 * so the build writes it as private static files and the Worker reads the
 * ones that hold the copies asked for. It names copies a nation chose to
 * hide, so no reader is sent the files themselves
 * (tools/nation-page-changes-worker.js). The copies of nations' laws and
 * court opinions, which the nations' choices apply to, are also in a file
 * of their own, for the filters that need all of them at once, which read
 * it only once a nation has restricted something.
 */
import { copyFiles, copyMovesFile, restrictableCopiesFile } from '../built-files.ts';
import type { CopyRestriction } from '../nation-restrictions.ts';
import type { PublicCopy } from '../public-copies.ts';
import { privateFile, privateSpreadReader } from './built-files.ts';

/**
 * A copy as the Worker serves it: its key, type, hash, size and original
 * addresses, a saved web page's encoding when it is not UTF-8, the name it
 * is saved under (src/lib/readable-file-names.ts), and for a nation's law or
 * court opinion, the choices it follows.
 */
export type ServedCopy = Pick<PublicCopy, 'key' | 'mediaType' | 'sha256' | 'bytes' | 'links' | 'charset'> & { name?: string; restrict?: CopyRestriction };

/** A copy as its file keeps it, under its key. */
export type StoredCopy = Omit<ServedCopy, 'key'>;

/** Files kept in memory in one copy of the Worker; each is about 25 KB. */
const copies = privateSpreadReader<StoredCopy>(copyFiles, 128);

/** The copies of these keys that the site serves; a key it does not serve is left out. */
export async function servedCopies(keys: Iterable<string>): Promise<Map<string, ServedCopy>> {
	const found = await copies.recordsFor(keys);
	return new Map([...found].map(([key, copy]) => [key, { key, ...copy }]));
}

/** The copy with this key, or undefined when the site does not serve one. */
export async function servedCopy(key: string): Promise<ServedCopy | undefined> {
	const copy = await copies.recordOf(key);
	return copy ? { key, ...copy } : undefined;
}

const moves = privateFile<Record<string, string>>(copyMovesFile, {});

/** The key of the copy a saved web page's reading page opens instead, such as the text of the same executive order, if there is one. */
export async function movedCopy(key: string): Promise<string | undefined> {
	const found = await moves();
	return Object.hasOwn(found, key) ? found[key] : undefined;
}

/** A copy of a nation's law or court opinion: its key and the choices it follows. */
export type RestrictableCopy = { key: string; restrict: CopyRestriction };

/** Every copy of a nation's law or court opinion, read once in each copy of the Worker. */
export const restrictableCopies: () => Promise<RestrictableCopy[]> = privateFile<RestrictableCopy[]>(restrictableCopiesFile, []);

let restrictableByKey: { list: RestrictableCopy[]; byKey: Map<string, RestrictableCopy> } | undefined;

/** The same copies by key. */
export async function restrictableCopyMap(): Promise<ReadonlyMap<string, RestrictableCopy>> {
	const list = await restrictableCopies();
	if (restrictableByKey?.list !== list) restrictableByKey = { list, byKey: new Map(list.map((copy) => [copy.key, copy])) };
	return restrictableByKey.byKey;
}
