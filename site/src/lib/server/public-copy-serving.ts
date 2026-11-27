/**
 * Serves a copy of a public document from the private bucket
 * (src/lib/public-copies.ts). Kept apart from the route so the tests can give
 * it a bucket and a network of their own.
 *
 * Only copies on the build-time list are served. When the bucket does not
 * have a copy yet, the Worker fills it the first time it is asked for, as it
 * does for nations' images: it fetches the document from the government
 * address recorded in the capture index and keeps it only if it is byte for
 * byte the file that was indexed (same SHA-256). If that fails, the reader is
 * sent to the original address, so a link never ends at an error page.
 */
import type { R2Bucket, R2Object, R2ObjectBody, R2Range } from '@cloudflare/workers-types/index.ts';
import type { PublicCopy } from '../public-copies.ts';
import { contentDisposition } from '../readable-file-names.ts';

/** A copy as it is served; `name` is the name a reader saves it under (src/lib/readable-file-names.ts). */
export type ServableCopy = Pick<PublicCopy, 'key' | 'mediaType' | 'sha256' | 'bytes' | 'links' | 'charset'> & { name?: string };

/** Larger files are left at their original address; reading one would strain the Worker. */
export const largestFill = 64 * 1024 * 1024;

/**
 * How long the Worker waits for a government site, in milliseconds, before
 * sending the reader to the original address instead. On Nov. 27, 2026
 * www.govinfo.gov stopped answering at all, and a law page whose Statutes at
 * Large copy was not in the bucket yet never finished loading: its embedded
 * copy waited on the Worker, which waited on govinfo.gov.
 */
export const fillWaitAtMost = 8_000;

/** The Worker fetches copies only from United States government sites, over https. */
export function mayFetchFrom(link: string): boolean {
	if (!URL.canParse(link)) return false;
	const address = new URL(link);
	return address.protocol === 'https:' && (address.hostname.endsWith('.gov') || address.hostname === 'gov');
}

export async function hexDigest(bytes: ArrayBuffer): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hex(bytes: ArrayBuffer | undefined): string | undefined {
	return bytes ? [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('') : undefined;
}

/**
 * Whether the bucket's object is the indexed file. Hashing every download
 * would slow each one, so the object's recorded SHA-256 (set when the Worker
 * or the upload script stored it) and its size stand in for the bytes.
 */
export function isIndexedFile(object: R2Object, copy: ServableCopy): boolean {
	if (object.size !== copy.bytes) return false;
	const recorded = object.customMetadata?.sha256 ?? hex(object.checksums?.sha256);
	return recorded === undefined || recorded === copy.sha256;
}

/** The document from its government address, or undefined unless it matches the indexed file. */
export async function fetchOriginal(
	copy: ServableCopy,
	fetcher: typeof fetch = fetch,
	waitAtMost = fillWaitAtMost
): Promise<{ bytes: ArrayBuffer; source: string } | undefined> {
	if (copy.bytes > largestFill) return undefined;
	// One limit for every address together, so a reader waits at most this long however many there are.
	const signal = AbortSignal.timeout(waitAtMost);
	for (const link of copy.links.filter(mayFetchFrom)) {
		if (signal.aborted) break;
		try {
			const response = await fetcher(link, {
				redirect: 'follow',
				signal,
				headers: { 'User-Agent': 'model-tribal-adr-code website (public document copy)' }
			});
			if (!response.ok) continue;
			const length = Number(response.headers.get('content-length') ?? 0);
			if (length > largestFill) continue;
			const bytes = await response.arrayBuffer();
			if (bytes.byteLength === copy.bytes && (await hexDigest(bytes)) === copy.sha256) return { bytes, source: link };
		} catch {
			// expected: try the next address.
		}
	}
	return undefined;
}

/**
 * The name the file is saved under: its title, from the build's list, rather than the code its key
 * ends in (Trevor, Nov. 27, 2026: files were "downloading with unreadable codes like
 * 6df61ccdf0a3cbf733b3.pdf"). A copy listed without a name keeps the key's own.
 */
export function savedFileName(copy: ServableCopy): string {
	return copy.name || (copy.key.split('/').at(-1) ?? 'document.pdf').replace(/[^A-Za-z0-9._-]/g, '_');
}

/** What a saved web page may still do, in its frame or opened on its own: follow a link the reader clicks. */
export const copySandbox = 'allow-top-navigation-by-user-activation allow-popups allow-popups-to-escape-sandbox';

/**
 * The Content-Type a copy is served with. Text and saved web pages name their
 * encoding, UTF-8 unless the copy says otherwise (research/copy-charsets.csv),
 * so accented letters, dashes and section signs show as written. Until
 * Nov. 27, 2026 saved pages were served as plain "text/html", and a browser
 * read the ones with no <meta charset> near the top, such as the Caselaw
 * Access Project's opinion fragments, as Windows-1252: "§" showed as "Â§".
 * The header wins over a page's own <meta charset>, which a few pages state
 * wrongly.
 */
export function copyContentType(copy: Pick<ServableCopy, 'mediaType' | 'charset'>): string {
	if (copy.mediaType !== 'text/plain' && copy.mediaType !== 'text/html') return copy.mediaType;
	return `${copy.mediaType}; charset=${copy.charset ?? 'utf-8'}`;
}

function copyHeaders(copy: ServableCopy, etag?: string): Headers {
	const headers = new Headers({
		'Content-Type': copyContentType(copy),
		// Inline, so it opens in the browser; a browser's Save and a link's download both use this name.
		'Content-Disposition': contentDisposition(savedFileName(copy), 'inline'),
		// A day: the file never changes under its key, but a copy taken off the list should stop being served soon.
		'Cache-Control': 'public, max-age=86400',
		'Accept-Ranges': 'bytes',
		'X-Content-Type-Options': 'nosniff',
		'Cross-Origin-Resource-Policy': 'same-origin'
	});
	if (copy.mediaType === 'text/html') {
		// A saved web page runs nothing and loads nothing: its text and layout show, its scripts, frames and images do not.
		// Its links still work when a reader clicks one, in the window or a new tab (the opinion copies' citations).
		headers.set('Content-Security-Policy', `default-src 'none'; style-src 'unsafe-inline'; sandbox ${copySandbox}`);
	}
	if (etag) headers.set('ETag', etag);
	return headers;
}

/** The byte range R2 returned, as first and last byte, or undefined for the whole file. */
export function servedRange(range: R2Range | undefined, size: number): { first: number; last: number } | undefined {
	if (!range) return undefined;
	let first: number;
	let last: number;
	if ('suffix' in range && range.suffix !== undefined) {
		first = Math.max(0, size - range.suffix);
		last = size - 1;
	} else {
		first = 'offset' in range && range.offset !== undefined ? range.offset : 0;
		const length = 'length' in range && range.length !== undefined ? range.length : size - first;
		last = Math.min(size - 1, first + length - 1);
	}
	if (first === 0 && last === size - 1) return undefined;
	return { first, last };
}

/** The response for /copies/<key>, for a copy on the build-time list. */
export async function servePublicCopy(
	request: Request,
	copy: ServableCopy,
	bucket: R2Bucket,
	fetcher: typeof fetch = fetch
): Promise<Response> {
	const wantsRange = request.headers.has('range');
	const stored = (await bucket.get(copy.key, {
		onlyIf: request.headers as never,
		...(wantsRange ? { range: request.headers as never } : {})
	})) as R2Object | R2ObjectBody | null;

	if (stored && isIndexedFile(stored, copy)) {
		if (!('body' in stored)) {
			// The reader's saved copy is current (If-None-Match or If-Modified-Since).
			return new Response(null, { status: 304, headers: copyHeaders(copy, stored.httpEtag) });
		}
		const headers = copyHeaders(copy, stored.httpEtag);
		const range = servedRange(stored.range, stored.size);
		if (range) {
			headers.set('Content-Range', `bytes ${range.first}-${range.last}/${stored.size}`);
			headers.set('Content-Length', String(range.last - range.first + 1));
			return new Response(stored.body as unknown as ReadableStream, { status: 206, headers });
		}
		headers.set('Content-Length', String(stored.size));
		return new Response(stored.body as unknown as ReadableStream, { headers });
	}

	const original = await fetchOriginal(copy, fetcher);
	if (!original) {
		const fallback = copy.links[0];
		// A redacted opinion has no address to fall back to: its original still has the names in it.
		if (!fallback) return new Response('This copy is not available right now.', { status: 503, headers: { 'Cache-Control': 'no-store' } });
		return new Response(null, {
			status: 302,
			headers: { Location: fallback, 'Cache-Control': 'no-store' }
		});
	}
	const written = await bucket.put(copy.key, original.bytes, {
		httpMetadata: { contentType: copy.mediaType },
		customMetadata: { sha256: copy.sha256, source: original.source }
	});
	const headers = copyHeaders(copy, written?.httpEtag);
	headers.set('Content-Length', String(original.bytes.byteLength));
	return new Response(original.bytes, { headers });
}
