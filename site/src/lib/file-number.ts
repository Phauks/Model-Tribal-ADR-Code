/**
 * Which of a fixed number of files holds a key, for data spread over files
 * by key (src/lib/built-files.ts, src/lib/page-data.ts). Shared by the build
 * (in Node), the Worker and the service worker, so it must stay plain.
 */

/** Which of `count` files holds a key: a 32-bit FNV-1a hash of the key, taken modulo the number of files. */
export function fileNumber(key: string, count: number): number {
	let hash = 0x811c9dc5;
	for (let index = 0; index < key.length; index++) {
		hash ^= key.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return hash % count;
}
