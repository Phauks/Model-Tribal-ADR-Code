import { createHash } from 'node:crypto';
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';
import { fileNumber, searchSelectionFiles } from '../src/lib/built-files.ts';

const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const shown = new TextEncoder().encode('%PDF-1.4 a United States statute');
const cited = new TextEncoder().encode('%PDF-1.4 a nation’s law it asked to cite only');
const hidden = new TextEncoder().encode('%PDF-1.4 a nation’s law it hid');

const records: Record<string, object> = {
	'/laws/statute': { copy: 'govinfo/statute.pdf', source: 'statute', item: { id: 'statute', type: 'legislation', title: 'Navajo and Hopi Indian Relocation Amendments of 1988' }, year: 1988, original: 'https://www.govinfo.gov/statute.pdf' },
	'/copies/view/tribal-law/a/cited.pdf': { copy: 'tribal-law/a/cited.pdf', nation: 'Example Nation' },
	'/copies/view/tribal-law/a/hidden.pdf': { copy: 'tribal-law/a/hidden.pdf', nation: 'Example Nation' }
};
const copies = new Map(
	[
		['govinfo/statute.pdf', shown],
		['tribal-law/a/cited.pdf', cited],
		['tribal-law/a/hidden.pdf', hidden]
	].map(([key, bytes]) => [key as string, { key: key as string, bytes: (bytes as Uint8Array).length, sha256: sha(bytes as Uint8Array), mediaType: 'application/pdf', links: [`https://example.org/${key}`] }])
);
const objects = new Map([
	['govinfo/statute.pdf', shown],
	['tribal-law/a/cited.pdf', cited],
	['tribal-law/a/hidden.pdf', hidden]
]);

vi.mock('#lib/server/environment.ts', () => ({
	workerEnvironment: () => ({
		database: {},
		ASSETS: {
			fetch: async (address: string) => {
				const number = Number(/\/(\d+)\.json$/.exec(address)?.[1]);
				const file = Object.fromEntries(Object.entries(records).filter(([link]) => fileNumber(link, searchSelectionFiles.count) === number));
				return new Response(JSON.stringify(file));
			}
		},
		sourceDocuments: {
			head: async (key: string) => (objects.has(key) ? {} : null),
			get: async (key: string) => (objects.has(key) ? { body: new Blob([objects.get(key) as Uint8Array<ArrayBuffer>]).stream() } : null)
		}
	})
}));
vi.mock('#lib/server/copy-list.ts', () => ({
	servedCopies: async (keys: Iterable<string>) => new Map([...keys].flatMap((key) => (copies.has(key) ? [[key, copies.get(key)]] : [])))
}));
vi.mock('#lib/server/nation-restrictions.ts', () => ({
	copyLevels: async () =>
		new Map([
			['tribal-law/a/cited.pdf', 'cite'],
			['tribal-law/a/hidden.pdf', 'hide']
		])
}));
vi.mock('#lib/server/essay-citations.ts', () => ({
	citationsFor: async () => new Map([['statute', 'Navajo and Hopi Indian Relocation Amendments of 1988, Pub. L. No. 100-666, 102 Stat. 3929.']])
}));

const { POST } = await import('../src/routes/search/download/+server.ts');

async function download(selection: object): Promise<Response> {
	const body = new FormData();
	body.set('selection', JSON.stringify(selection));
	const request = new Request('https://triballawproject.org/search/download', { method: 'POST', body });
	return (POST as unknown as (event: object) => Promise<Response>)({ request, fetch, url: new URL(request.url) });
}

const items = [
	{ link: '/laws/statute', title: 'Navajo and Hopi Indian Relocation Amendments of 1988', group: 'law' },
	{ link: '/copies/view/tribal-law/a/cited.pdf', title: 'Example Nation Code', group: 'document' },
	{ link: '/copies/view/tribal-law/a/hidden.pdf', title: 'Example Nation Hidden Law', group: 'document' },
	{ link: 'https://example.org/agreement', title: 'An Agreement', group: 'document', nation: 'Example Nation' }
];

describe('downloading several search results', () => {
	it('holds only copies the site may share, lists the rest, and leaves out what a nation hid', async () => {
		const response = await download({ items, options: {}, query: 'navajo' });
		expect(response.headers.get('content-disposition')).toMatch(/filename="navajo-search-\d{4}-\d{2}-\d{2}\.zip"/);
		const zip = unzipSync(new Uint8Array(await response.arrayBuffer()));
		expect(Object.keys(zip).sort()).toEqual(
			['README.txt', 'SHA256SUMS.txt', 'citations.txt', 'Federal law/Navajo and Hopi Indian Relocation Amendments of 1988.pdf', 'selection.csv', 'verify.ps1', 'verify.sh'].sort()
		);
		expect(zip['Federal law/Navajo and Hopi Indian Relocation Amendments of 1988.pdf']).toEqual(shown);
		expect(strFromU8(zip['SHA256SUMS.txt'])).toBe(`${sha(shown)}  Federal law/Navajo and Hopi Indian Relocation Amendments of 1988.pdf\n`);
		const list = strFromU8(zip['selection.csv']);
		expect(list).not.toContain('Hidden');
		expect(list).toContain('Example Nation Code,Laws and governing documents,Example Nation,,https://triballawproject.org/copies/view/tribal-law/a/cited.pdf,https://example.org/tribal-law/a/cited.pdf,,,');
		const citations = strFromU8(zip['citations.txt']);
		expect(citations).toContain('Pub. L. No. 100-666');
		expect(citations).toContain('An Agreement, https://example.org/agreement (last visited');
		expect(citations).not.toContain('Hidden');
		expect(strFromU8(zip['README.txt'])).toContain('3 results: 1 as a file');
	});

	it('sends the citations alone as one file', async () => {
		const response = await download({ items: items.slice(0, 1), options: { files: false, list: false, readme: false, format: 'bib' }, query: '' });
		expect(response.headers.get('content-disposition')).toMatch(/filename="search-\d{4}-\d{2}-\d{2}\.bib"/);
		expect(await response.text()).toMatch(/^@misc\{statute,/);
	});

	it('refuses a request with no results', async () => {
		await expect(download({ items: [], options: {} })).rejects.toMatchObject({ status: 400 });
	});
});
