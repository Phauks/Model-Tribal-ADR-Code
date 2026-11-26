/**
 * How a piece of editable text is named (docs/site-text.md), in a module of
 * its own so pages built from records can name their text without loading the
 * Svelte compiler that src/lib/site-text-markers.ts needs.
 */

/**
 * A short, stable name made from the file, the kind of text and the words
 * (cyrb53, a small 53-bit string hash, written in base 36). The same words
 * in the same file and place keep the same name from build to build.
 */
export function siteTextKey(file: string, words: string, attribute = '', occurrence = 1): string {
	const input = `${file}\n${attribute}\n${words}\n${occurrence}`;
	let first = 0xdeadbeef;
	let second = 0x41c6ce57;
	for (let index = 0; index < input.length; index++) {
		const code = input.charCodeAt(index);
		first = Math.imul(first ^ code, 2654435761);
		second = Math.imul(second ^ code, 1597334677);
	}
	first = Math.imul(first ^ (first >>> 16), 2246822507) ^ Math.imul(second ^ (second >>> 13), 3266489909);
	second = Math.imul(second ^ (second >>> 16), 2246822507) ^ Math.imul(first ^ (first >>> 13), 3266489909);
	const value = 4294967296 * (2097151 & second) + (first >>> 0);
	return value.toString(36).padStart(11, '0').slice(-10);
}
