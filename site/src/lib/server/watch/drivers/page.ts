/**
 * The page driver (docs/source-watch.md, "Change detection"): fetch a page
 * or file, and compare it with last time.
 *
 * 1. Ask cheaply: send If-None-Match and If-Modified-Since when the server
 *    gave an ETag or Last-Modified date, and stop on 304 Not Modified.
 * 2. Don't trust a header alone: for a web page, compare a SHA-256 of its main
 *    text (menus, headers, footers and per-visit text removed), since some
 *    hosts send a fresh Last-Modified on pages that did not change; for any
 *    other file, compare a SHA-256 of its bytes.
 * 3. Keep both versions: a changed page or file is stored again under its new
 *    SHA-256, and the item carries a short difference of the text.
 */
import type { R2Bucket } from '@cloudflare/workers-types/index.ts';
import type { CheckContext, Feed, FoundItem } from '../watcher.ts';
import { sha256Hex } from '../capture.ts';
import { mainText, shortDifference } from './markup.ts';

export interface PageCheck {
	address: string;
	/** The item's identifier when it changed; the address by default. */
	sourceIdentifier?: string;
	title: string;
	feeds?: Feed[];
	/** Text that changes on every visit, removed before comparing (a printed date, a token). */
	alsoRemove?: RegExp[];
	/** A SHA-256 the project already holds for this address (a record's file.checksum, perhaps cut by shortHash), compared on the first visit. */
	knownSha256?: string | null;
	/** The least spacing between requests to this host, in seconds. */
	spacingSeconds?: number;
}

export type PageOutcome =
	| { outcome: 'unchanged' }
	| { outcome: 'first-visit' }
	| { outcome: 'changed'; item: FoundItem }
	| { outcome: 'gone'; status: number; item: FoundItem };

/** Where the main text of each version of a watched page is kept, so the next change can show a difference. */
export function pageTextKey(watcher: string, sha256: string): string {
	return `watch/page-text/${watcher}/${sha256}.txt`;
}

/** Reads and writes page text snapshots. */
export interface PageTexts {
	read(key: string): Promise<string | null>;
	write(key: string, text: string): Promise<void>;
}

/** Page text snapshots in the private bucket. They are text the Worker extracted, never files, and are not served. */
export function bucketPageTexts(bucket: R2Bucket): PageTexts {
	return {
		async read(key) {
			const object = await bucket.get(key);
			return object ? await object.text() : null;
		},
		async write(key, text) {
			await bucket.put(key, text, { httpMetadata: { contentType: 'text/plain; charset=utf-8' } });
		}
	};
}

function isWebPage(mediaType: string): boolean {
	return /^(text\/html|application\/xhtml\+xml)/i.test(mediaType);
}

export async function checkPage(context: CheckContext, watcher: string, check: PageCheck): Promise<PageOutcome> {
	const texts = context.pageTexts;
	const memory = await context.pages.read(check.address);
	const { response, modelMayRead } = await context.fetch(check.address, {
		conditional: memory ? { entityTag: memory.entityTag, lastModified: memory.lastModified } : undefined,
		spacingSeconds: check.spacingSeconds
	});
	const checkedAt = context.now.toISOString();
	const sourceIdentifier = check.sourceIdentifier ?? check.address;
	if (response.status === 304 && memory) {
		await context.pages.write(check.address, { ...memory, status: 304, checkedAt });
		return { outcome: 'unchanged' };
	}
	if (response.status === 404 || response.status === 410) {
		await response.body?.cancel();
		const wasGone = memory?.status === 404 || memory?.status === 410;
		await context.pages.write(check.address, { entityTag: null, lastModified: null, sha256: memory?.sha256 ?? null, captureKey: memory?.captureKey ?? null, status: response.status, checkedAt });
		if (wasGone) return { outcome: 'unchanged' };
		return {
			outcome: 'gone',
			status: response.status,
			item: { sourceIdentifier: `${sourceIdentifier}#gone-${checkedAt.slice(0, 10)}`, kind: 'link-gone', title: check.title, link: check.address, feeds: check.feeds, facts: { status: response.status }, noModelText: true }
		};
	}
	if (!response.ok) {
		await response.body?.cancel();
		throw new Error(`${new URL(check.address).hostname} answered ${response.status}`);
	}
	const mediaType = response.headers.get('content-type') ?? 'application/octet-stream';
	const bytes = await response.arrayBuffer();
	const entityTag = response.headers.get('etag');
	const lastModified = response.headers.get('last-modified');
	const webPage = isWebPage(mediaType);
	const text = webPage ? mainText(new TextDecoder().decode(bytes), check.alsoRemove) : null;
	const sha256 = text !== null ? await sha256Hex(new TextEncoder().encode(text).buffer as ArrayBuffer) : await sha256Hex(bytes);
	const bytesSha256 = text !== null ? await sha256Hex(bytes) : sha256;
	// A web page's bytes change on every visit (dates, tokens), so a record's file checksum is compared only for other files.
	const previousSha256 = memory?.sha256 ?? (text === null ? (check.knownSha256 ?? null) : null);
	const changed = previousSha256 !== null && !sha256.startsWith(previousSha256.toLowerCase());

	let captureKey = memory?.captureKey ?? null;
	let difference: string | undefined;
	if (changed || !memory) {
		if (text !== null) await texts.write(pageTextKey(watcher, sha256), text);
	}
	if (changed) {
		const kept = await context.keep(sourceIdentifier, { bytes, mediaType, address: check.address, entityTag, lastModified });
		captureKey = kept.key;
		if (text !== null && memory?.sha256) {
			const before = await texts.read(pageTextKey(watcher, memory.sha256));
			if (before !== null) difference = shortDifference(before, text);
		}
	}
	await context.pages.write(check.address, { entityTag, lastModified, sha256, captureKey, status: response.status, checkedAt });
	if (!changed) return memory ? { outcome: 'unchanged' } : { outcome: 'first-visit' };
	return {
		outcome: 'changed',
		item: {
			sourceIdentifier: `${sourceIdentifier}#${sha256.slice(0, 16)}`,
			kind: 'changed-file',
			title: check.title,
			link: check.address,
			feeds: check.feeds,
			capture: { key: captureKey as string, sha256: bytesSha256 },
			change: { previousKey: memory?.captureKey ?? null, previousSha256, difference },
			facts: { mediaType: mediaType.split(';')[0] },
			noModelText: !modelMayRead
		}
	};
}
