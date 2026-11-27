import { describe, expect, it } from 'vitest';
import { copiesByLink, copyDetailsShard, copyPagePath, copyPath, copyPreference, linkForMatching, type PublicCopy } from '../src/lib/public-copies.ts';
import { copyDetailShardNames, copyDetails } from '../src/lib/server/copy-lists.ts';
import { copyMoves, publicCopies } from '../src/lib/server/content.ts';
import { navigationSectionOf } from '../src/lib/site-navigation.ts';
import {
	copyContentType,
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

	it('gives each copy a page inside the site, in the Library section, apart from its file', () => {
		const page = copyPagePath({ key: 'constitutions/a b/law.pdf' });
		expect(page).toBe('/copies/view/constitutions/a%20b/law.pdf');
		expect(navigationSectionOf(page)?.label).toBe('Library');
	});
});

describe('the details a copy’s page shows', () => {
	it('lists every copy once, in the file named by its SHA-256', () => {
		const copies = publicCopies();
		if (copies.length === 0) return;
		const shards = copyDetailShardNames();
		expect(shards.every((shard) => /^[0-9a-f]{2}$/.test(shard))).toBe(true);
		const listed = shards.reduce((total, shard) => total + Object.keys(copyDetails(shard) ?? {}).length, 0);
		expect(listed).toBe(new Set(copies.map((each) => each.key)).size);
		const first = copies[0];
		const details = copyDetails(copyDetailsShard(first))?.[first.key];
		expect(details?.title).toBe(first.title);
		expect(details?.list.slug).toBeTruthy();
		// The first call works out every copy's details, citing each copy's record, which took 15 to 25 seconds on a CI runner
		// and more than 60 once the Indian Claims Commission's and the repatriation notices' 9,700 copies came (Nov. 27, 2026).
	}, 180_000);

	it('gives a tribal court opinion its citation', () => {
		const opinion = publicCopies().find((each) => each.topic === 'caselaw-access-project');
		if (!opinion) return;
		const details = copyDetails(copyDetailsShard(opinion))?.[opinion.key];
		expect(details?.opinion?.citation).toBeTruthy();
		expect(details?.list.slug.startsWith('opinions-')).toBe(true);
	});

	it('gives a Supreme Court report its citation, without repeating the name, and its own list', () => {
		const report = publicCopies().find((each) => each.records.includes('fletcher-v-peck'));
		if (!report) return;
		const details = copyDetails(copyDetailsShard(report))?.[report.key];
		expect(details?.citation).toBe('10 U.S. 87 (1810).');
		expect(details?.isCase).toBe(true);
		expect(details?.casePage).toBe('/cases/fletcher-v-peck');
		expect(details?.list).toEqual({ slug: 'supreme-court', title: 'Supreme Court opinions' });
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

	it('gives up on a government site that does not answer', async () => {
		// A site that never answers, as www.govinfo.gov did on Nov. 27, 2026, until the request is called off.
		const silent = ((_link: string, init?: RequestInit) =>
			new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)))) as typeof fetch;
		const started = Date.now();
		expect(await fetchOriginal(copy, silent, 50)).toBeUndefined();
		expect(Date.now() - started).toBeLessThan(2_000);
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

	it('names the file by its title, not the code in its key', async () => {
		const { bucket } = memoryBucket({ [copy.key]: { bytes: pdf, sha256 } });
		const named = { ...copy, name: 'Peacemaker Court - Alabama-Coushatta Tribe of Texas.pdf' };
		const response = await servePublicCopy(new Request('https://site.test/copies/x'), named, bucket, network({}));
		expect(response.headers.get('content-disposition')).toBe('inline; filename="Peacemaker Court - Alabama-Coushatta Tribe of Texas.pdf"');
		expect(await response.text()).toBe('%PDF-1.4 a statute page');
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

describe('reading the capture index', async () => {
	const { parseCsv } = await import('../src/lib/csv.ts');
	it('reads quoted fields with commas, quotes and line breaks', () => {
		const rows = parseCsv('key,title,link\r\na.pdf,"Rule 2.4, ""Lawyer""",https://x.gov/a.pdf https://y.gov/b\nb.pdf,"two\nlines",\n');
		expect(rows).toEqual([
			{ key: 'a.pdf', title: 'Rule 2.4, "Lawyer"', link: 'https://x.gov/a.pdf https://y.gov/b' },
			{ key: 'b.pdf', title: 'two\nlines', link: '' }
		]);
	});

	it('matches Python on the real index header', () => {
		const [row] = parseCsv('key,bytes,redistribution\nwestlaw/x.pdf,10,no\n');
		expect(row).toEqual({ key: 'westlaw/x.pdf', bytes: '10', redistribution: 'no' });
	});
});

describe('copies of nations’ documents', async () => {
	const { removalRequestPath, mediaLabel } = await import('../src/lib/public-copies.ts');
	it('links each copy to a filled-in removal request', () => {
		expect(removalRequestPath({ key: 'constitutions/sample-nation/0123456789abcdef.pdf' })).toBe(
			'/requests?kind=remove&record=copies/constitutions/sample-nation/0123456789abcdef.pdf'
		);
	});

	it('serves a saved web page in a sandbox', async () => {
		const page = new TextEncoder().encode('<html><script>x()</script>Constitution</html>').buffer as ArrayBuffer;
		const saved: ServableCopy = {
			key: 'constitutions/sample-nation/0123456789abcdef.html',
			mediaType: 'text/html',
			sha256: await hexDigest(page),
			bytes: page.byteLength,
			links: ['https://sample-nation.example/constitution']
		};
		const { bucket } = memoryBucket({ [saved.key]: { bytes: page, sha256: saved.sha256 } });
		const response = await servePublicCopy(new Request('https://site.test/copies/x'), saved, bucket, network({}));
		expect(response.headers.get('content-security-policy')).toContain('sandbox');
		// No scripts, but a clicked link may leave the frame (an opinion's citations).
		expect(response.headers.get('content-security-policy')).not.toContain('allow-scripts');
		expect(response.headers.get('content-security-policy')).toContain('allow-top-navigation-by-user-activation');
		expect(mediaLabel(saved.mediaType)).toBe('saved web page');
		// Named as UTF-8, so a page with no <meta charset> is not read as Windows-1252.
		expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
	});

	it('names a saved page’s own encoding when it is not UTF-8', () => {
		expect(copyContentType({ mediaType: 'text/html', charset: 'windows-1252' })).toBe('text/html; charset=windows-1252');
		expect(copyContentType({ mediaType: 'text/plain' })).toBe('text/plain; charset=utf-8');
		expect(copyContentType({ mediaType: 'application/pdf' })).toBe('application/pdf');
	});
});

describe('more than one copy of the same document', () => {
	const order = (mediaType: string, key: string) =>
		({ key, mediaType, links: ['https://treaties.okstate.edu/treaties/executive-order-fort-stanton-indian-reserve-1873'] }) as PublicCopy;

	it('opens a PDF or a text before a saved web page, whatever order they come in', () => {
		const page = order('text/html', 'jurisdiction/order.html');
		const text = order('text/plain', 'executive-orders/order.txt');
		for (const copies of [
			[page, text],
			[text, page]
		]) {
			expect(copiesByLink(copies).get(page.links[0])?.key).toBe(text.key);
		}
		expect(copyPreference('application/pdf')).toBeLessThan(copyPreference('text/plain'));
	});

	it('sends a saved page of an executive order to the order’s text', () => {
		const moves = copyMoves();
		const served = new Set(publicCopies().map((copy) => copy.key));
		for (const [from, to] of Object.entries(moves)) {
			expect(served.has(to)).toBe(true);
			expect(from.endsWith('.html')).toBe(true);
		}
		if (served.has('executive-orders/executive-order-1873-05-29-mescalero-apache-reservation.txt')) {
			expect(moves['jurisdiction/executive-order-1873-05-29-mescalero-apache-reservation.html']).toBe(
				'executive-orders/executive-order-1873-05-29-mescalero-apache-reservation.txt'
			);
		}
	});
});
