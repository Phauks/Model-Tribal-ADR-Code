/**
 * Keeping a copy of every file a watcher fetches (docs/source-watch.md,
 * "Storage and hosting"). Each file goes into the private bucket at
 *
 *   watch/captures/<watcher>/<year>/<source identifier>/<sha256>.<extension>
 *
 * with the address, headers and time it was fetched, and is put in line for
 * the malware scan (scan purpose watch-capture). Nothing opens it, the models
 * included, until the scan says clean, and the site serves nothing from here:
 * when an accepted item lands as a record, the capture index and its scripts
 * decide what the site serves, as for every other source.
 */
import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import { requestScan } from '../file-scans.ts';
import type { FetchedFile } from './watcher.ts';

export const capturePrefix = 'watch/captures/';

const extensions: Record<string, string> = {
	'application/pdf': 'pdf',
	'text/html': 'html',
	'application/xhtml+xml': 'html',
	'application/xml': 'xml',
	'text/xml': 'xml',
	'application/json': 'json',
	'text/plain': 'txt',
	'application/msword': 'doc',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
	'application/rtf': 'rtf'
};

export function extensionFor(mediaType: string): string {
	return extensions[mediaType.split(';')[0].trim().toLowerCase()] ?? 'bin';
}

/** A source identifier as one safe folder name. */
export function folderName(sourceIdentifier: string): string {
	const safe = sourceIdentifier
		.replace(/^https?:\/\//, '')
		.replace(/[^A-Za-z0-9._-]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return (safe || 'item').slice(0, 120);
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function captureKey(watcher: string, sourceIdentifier: string, sha256: string, mediaType: string, now: Date): string {
	return `${capturePrefix}${watcher}/${now.getUTCFullYear()}/${folderName(sourceIdentifier)}/${sha256}.${extensionFor(mediaType)}`;
}

/**
 * Stores a fetched file and puts it in line for the scan. The same bytes
 * under the same item are stored once; the scan is asked for again only for
 * a new key.
 */
export async function storeCapture(
	bucket: R2Bucket,
	database: D1Database,
	watcher: string,
	sourceIdentifier: string,
	file: FetchedFile,
	now: Date
): Promise<{ key: string; sha256: string }> {
	const sha256 = await sha256Hex(file.bytes);
	const key = captureKey(watcher, sourceIdentifier, sha256, file.mediaType, now);
	const existing = await bucket.head(key);
	if (!existing) {
		await bucket.put(key, file.bytes, {
			httpMetadata: { contentType: file.mediaType },
			customMetadata: {
				address: file.address,
				fetchedAt: now.toISOString(),
				...(file.entityTag ? { entityTag: file.entityTag } : {}),
				...(file.lastModified ? { lastModified: file.lastModified } : {})
			},
			sha256
		});
		await requestScan(database, { objectKey: key, purpose: 'watch-capture', subject: `${watcher}:${sourceIdentifier}` }, now);
	}
	return { key, sha256 };
}
