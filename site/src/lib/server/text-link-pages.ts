/**
 * Reads the pages a citation inside a document's text links to from the
 * build's private files (text-link-index.ts writes them; src/lib/built-files.ts).
 */
import { textLinkFiles } from '../built-files.ts';
import { privateSpreadReader } from './built-files.ts';

const textLinks = privateSpreadReader<string>(textLinkFiles, 64);

/** The pages for these keys; a key with no page here is left out. */
export function textLinkPages(keys: Iterable<string>): Promise<Map<string, string>> {
	return textLinks.recordsFor(keys);
}
