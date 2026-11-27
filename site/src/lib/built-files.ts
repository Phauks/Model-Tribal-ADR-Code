/**
 * Data the build works out for the Worker, kept out of the Worker's code.
 * Cloudflare refuses a Worker whose code is over 64 MiB uncompressed, and
 * data bundled into the code is what took it there on Nov. 26, 2026
 * (src/lib/essay-citation-files.ts). Static files do not count toward that
 * limit, so the build writes the data as static files and the Worker reads
 * the ones it needs through its ASSETS binding (src/lib/server/built-files.ts).
 *
 * Files under /page-data/private/ hold what readers must not see as a whole,
 * such as the list of every copy the site keeps, which names copies a nation
 * chose to hide. The Worker answers "not found" when a reader asks for one
 * (tools/nation-page-changes-worker.js); only its own ASSETS binding reads
 * them.
 *
 * A large set of records is spread over a fixed number of files by a hash of
 * each key, so a page that needs a few records reads a few small files.
 * While the site is built, and in development, the same data is read from
 * one file in .svelte-kit/built-data/ instead.
 *
 * Shared by the build (in Node) and the Worker, so it must stay plain.
 */
import { pageDataPrefix } from './page-data.ts';

/** Where the Worker's private files are kept. */
export const privateDataPrefix = `${pageDataPrefix}/private`;

/** Where the build leaves the same data for itself and the development server, relative to site/. */
export const builtDataFolder = '.svelte-kit/built-data';

/** Which of `count` files holds a key: a 32-bit FNV-1a hash of the key, taken modulo the number of files. */
export function fileNumber(key: string, count: number): number {
	let hash = 0x811c9dc5;
	for (let index = 0; index < key.length; index++) {
		hash ^= key.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return hash % count;
}

/** A set of records spread over files by key. */
export interface SpreadFiles {
	/** Its name, which names its folder and its file in .svelte-kit/built-data/. */
	name: string;
	/** How many files the records are spread over. */
	count: number;
}

/** The address of one of a set's files, such as /page-data/private/copies/17.json. */
export function spreadFilePath(set: SpreadFiles, number: number): string {
	return `${privateDataPrefix}/${set.name}/${number}.json`;
}

/** The address of a single private file, such as /page-data/private/essay-case-names.json. */
export function privateFilePath(name: string): string {
	return `${privateDataPrefix}/${name}.json`;
}

/**
 * Every copy of a public document the Worker may serve at /copies/, with
 * its type, hash, size and original addresses (src/lib/public-copies.ts):
 * about 6 MB by Nov. 27, 2026, in files of about 25 KB.
 */
export const copyFiles: SpreadFiles = { name: 'copies', count: 256 };

/** The copies of nations' laws and court opinions, which follow the nations' choices (src/lib/nation-restrictions.ts): about 0.8 MB. */
export const restrictableCopiesFile = 'restrictable-copies';

/**
 * Saved web pages whose reading page opens another copy of the same document,
 * a PDF or a text, by key (src/lib/server/content.ts, copyMoves): a few
 * dozen, by Nov. 27, 2026.
 */
export const copyMovesFile = 'copy-moves';

/**
 * What essays draw case and law boxes from, by record (src/lib/server/essay-library.ts):
 * each box's facts and parts, a case's page and its opinions.
 */
export const essayRecordFiles: SpreadFiles = { name: 'essay-records', count: 512 };

/** Every court case's name and date, which an essay needs whole to link the case names in its text. */
export const essayCaseNamesFile = 'essay-case-names';

/**
 * The pages a citation inside a document's text links to, by the key the
 * linker finds it by, such as "case:309 us 506" or "usc:25:5321"
 * (src/lib/server/text-link-index.ts): about 2 MB, in files of about 30 KB.
 */
export const textLinkFiles: SpreadFiles = { name: 'text-links', count: 64 };

/**
 * Each search result's copy, citation and nation, by the result's link, which the Worker reads when a
 * reader downloads several results at once (src/lib/server/search-selection.ts).
 */
export const searchSelectionFiles: SpreadFiles = { name: 'search-selection', count: 256 };

/** Spreads records over a set's files, as the build writes them. */
export function spreadRecords<T>(set: SpreadFiles, records: Record<string, T>): Record<string, T>[] {
	const files: Record<string, T>[] = Array.from({ length: set.count }, () => ({}));
	for (const [key, record] of Object.entries(records)) files[fileNumber(key, set.count)][key] = record;
	return files;
}
