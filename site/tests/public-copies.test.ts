import { describe, expect, it } from 'vitest';
import { copiesByLink, copyPath, linkForMatching, type PublicCopy } from '../src/lib/public-copies.ts';
import {
	fetchOriginal,
	hexDigest,
	isIndexedFile,
	mayFetchFrom,
	servePublicCopy,
	servedRange,
	type ServableCopy
} from '../src/lib/server/public-copy-serving.ts';

const pdf = new TextEncoder().encode('%PDF-1.4 a statute page').buffer as ArrayBuffer;
const sha256 = await hexDigest(pdf);

const copy: ServableCopy = {
	key: 'govinfo/STATUTE-108/STATUTE-108-Pg4791.pdf',
	mediaType: 'application/pdf',
	sha256,
	bytes: pdf.byteLength,
	links: [
		'https://www.govinfo.gov/content/pkg/STATUTE-108/pdf/STATUTE-108-Pg4791.pdf',
		'https://www.govinfo.gov/link/statute/108/4791?link-type=pdf'
	]
};

/** A bucket that holds objects in memory, with only what the route uses. */
function memoryBucket(objects: Record<string, { bytes: ArrayBuffer; sha256?: string }> = {}) {
	const stored = new Map(Object.entries(objects));
	const put: string[] = [];
	const bucket = {
		async get(key: string, options?: { onlyIf?: Headers }) {
			const object = stored.get(key);
			if (!object) return null;
			const head = {
				size: object.bytes.byteLength,
				httpEtag: '"etag-1"',
				customMetadata: object.sha256 ? { sha256: object.sha256 } : {},
				checksums: {}
			};
			if (options?.onlyIf?.get('if-none-match') === '"etag-1"') return head;
			return { ...head, body: new Blob([object.bytes]).stream() };
		},
		async put(key: string, bytes: ArrayBuffer, options: { customMetadata: { sha256: string } }) {
			stored.set(key, { bytes, sha256: options.customMetadata.sha256 });
			put.push(key);
			return { httpEtag: '"etag-1"' };
		}
	};
	return { bucket: bucket as never, put };
}

function network(responses: Record<string, ArrayBuffer>): typeof fetch {
	return (async (link: string) =>
		responses[link] ? new Response(responses[link]) : new Response('missing', { status: 404 })) as typeof fetch;
}

describe('matching a page link to a copy', () => {
	it('ignores the fragment and http or https', () => {
		expect(linkForMatching('http://www.govinfo.gov/a.pdf#page=1')).toBe('https://www.govinfo.gov/a.pdf');
		expect(linkForMatching('mailto:someone@example.org')).toBeUndefined();
		expect(linkForMatching('not a link')).toBeUndefined();
	});

	it('finds a copy by any address it was published at', () => {
		const byLink = copiesByLink([copy as PublicCopy]);
		expect(byLink.get('https://www.govinfo.gov/link/statute/108/4791?link-type=pdf')?.key).toBe(copy.key);
		expect(byLink.get('https://www.govinfo.gov/content/pkg/STATUTE-108/pdf/STATUTE-108-Pg4791.pdf')?.key).toBe(copy.key);
	});

	it('gives each copy an address on this site', () => {
		expect(copyPath(copy)).toBe('/copies/govinfo/STATUTE-108/STATUTE-108-Pg4791.pdf');
	});
});

describe('filling the bucket', () => {
	it('fetches only from United States government sites over https', () => {
		expect(mayFetchFrom('https://www.govinfo.gov/a.pdf')).toBe(true);
		expect(mayFetchFrom('http://www.govinfo.gov/a.pdf')).toBe(false);
		expect(mayFetchFrom('https://www.govinfo.gov.example.org/a.pdf')).toBe(false);
		expect(mayFetchFrom('https://www.law.cornell.edu/uscode/text/25/5131')).toBe(false);
	});

	it('keeps a fetched file only when it is the indexed file', async () => {
		const changed = new TextEncoder().encode('%PDF-1.4 a different page').buffer as ArrayBuffer;
		expect(await fetchOriginal(copy, network({ [copy.links[0]]: changed }))).toBeUndefined();
		expect((await fetchOriginal(copy, network({ [copy.links[1]]: pdf })))?.source).toBe(copy.links[1]);
	});
});

describe('serving a copy', () => {
	it('serves the bucket copy when it is the indexed file', async () => {
		const { bucket, put } = memoryBucket({ [copy.key]: { bytes: pdf, sha256 } });
		const response = await servePublicCopy(new Request('https://site.test/copies/x'), copy, bucket, network({}));
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('application/pdf');
		expect(await response.text()).toBe('%PDF-1.4 a statute page');
		expect(put).toEqual([]);
	});

	it('answers "not modified" when the reader has the current copy', async () => {
		const { bucket } = memoryBucket({ [copy.key]: { bytes: pdf, sha256 } });
		const request = new Request('https://site.test/copies/x', { headers: { 'If-None-Match': '"etag-1"' } });
		expect((await servePublicCopy(request, copy, bucket, network({}))).status).toBe(304);
	});

	it('fills the bucket from the government copy the first time', async () => {
		const { bucket, put } = memoryBucket();
		const response = await servePublicCopy(
			new Request('https://site.test/copies/x'),
			copy,
			bucket,
			network({ [copy.links[0]]: pdf })
		);
		expect(response.status).toBe(200);
		expect(put).toEqual([copy.key]);
	});

	it('replaces a bucket object that is not the indexed file', async () => {
		const { bucket, put } = memoryBucket({ [copy.key]: { bytes: pdf, sha256: '0'.repeat(64) } });
		await servePublicCopy(new Request('https://site.test/copies/x'), copy, bucket, network({ [copy.links[0]]: pdf }));
		expect(put).toEqual([copy.key]);
	});

	it('sends the reader to the original address when no copy can be had', async () => {
		const { bucket } = memoryBucket();
		const response = await servePublicCopy(new Request('https://site.test/copies/x'), copy, bucket, network({}));
		expect(response.status).toBe(302);
		expect(response.headers.get('location')).toBe(copy.links[0]);
	});
});

describe('byte ranges', () => {
	it('gives the first and last byte R2 returned', () => {
		expect(servedRange({ offset: 0, length: 10 }, 100)).toEqual({ first: 0, last: 9 });
		expect(servedRange({ suffix: 10 }, 100)).toEqual({ first: 90, last: 99 });
		expect(servedRange({ offset: 0, length: 100 }, 100)).toBeUndefined();
		expect(servedRange(undefined, 100)).toBeUndefined();
	});

	it('checks an object by its size and recorded digest', () => {
		expect(isIndexedFile({ size: copy.bytes, customMetadata: { sha256 } } as never, copy)).toBe(true);
		expect(isIndexedFile({ size: copy.bytes + 1, customMetadata: { sha256 } } as never, copy)).toBe(false);
		expect(isIndexedFile({ size: copy.bytes, customMetadata: {} } as never, copy)).toBe(true);
	});
});
