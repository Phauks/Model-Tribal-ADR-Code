import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { partBytes, partsListFile, splitLargeFiles, splitOver } from '../tools/split-large-files.mjs';
import { joinedAssets, withJoinedFiles } from '../tools/joined-files-worker.js';
import { withNationPageChanges } from '../tools/nation-page-changes-worker.js';

// The env the site imports from "cloudflare:workers" (src/lib/server/environment.ts), which withEnv sets for the work inside it.
const imported = vi.hoisted(() => ({ env: undefined as unknown }));
vi.mock('cloudflare:workers', () => ({
	withEnv: async (env: unknown, work: () => unknown) => {
		const before = imported.env;
		imported.env = env;
		try {
			return await work();
		} finally {
			imported.env = before;
		}
	}
}));
type Bindings = { ASSETS: { fetch(input: string): Promise<Response> } };

const types: Record<string, string> = { '.csv': 'text/csv', '.json': 'application/json', '.html': 'text/html' };

/** The ASSETS binding over a folder, as Cloudflare answers it: the file, its type by extension and a tag. */
function folderAssets(folder: string, asked: string[] = []) {
	return {
		async fetch(input: Request | string | URL, init?: RequestInit): Promise<Response> {
			const request = new Request(input, init);
			const { pathname } = new URL(request.url);
			asked.push(pathname);
			const file = path.join(folder, pathname.slice(1));
			if (!existsSync(file) || !statSync(file).isFile()) return new Response('Not found', { status: 404 });
			const content = readFileSync(file);
			return new Response(request.method === 'HEAD' ? null : content, {
				headers: { 'content-type': types[path.extname(file)] ?? 'application/octet-stream', etag: '"part"', 'x-content-type-options': 'nosniff' }
			});
		}
	};
}

const sha256 = (content: Uint8Array) => createHash('sha256').update(content).digest('hex');

describe('files too large for Cloudflare, split into parts and joined again', () => {
	let folder: string;
	let list: Buffer;
	let catalog: Buffer;
	const small = Buffer.from('{"small":true}\n');

	beforeAll(() => {
		folder = mkdtempSync(path.join(tmpdir(), 'joined-files-'));
		// Rows of varying length, so a part ends inside a row and inside a character of more than one byte.
		const rows: string[] = ['title,copy,sha256'];
		for (let index = 0, length = 0; length < splitOver + partBytes / 2; index += 1) {
			const row = `Copy ${index} — Ō,/copies/${index}.pdf,${'ab'.repeat(index % 40)}`;
			rows.push(row);
			length += row.length + 1;
		}
		list = Buffer.from(`${rows.join('\n')}\n`);
		catalog = Buffer.alloc(splitOver + 1, 'x');
		mkdirSync(path.join(folder, 'copies'), { recursive: true });
		mkdirSync(path.join(folder, 'offline-catalog'), { recursive: true });
		mkdirSync(path.join(folder, '_app/immutable'), { recursive: true });
		writeFileSync(path.join(folder, 'copies/list.csv'), list);
		writeFileSync(path.join(folder, 'offline-catalog/index.json'), catalog);
		writeFileSync(path.join(folder, 'copies/offline.json'), small);
		writeFileSync(path.join(folder, '_app/immutable/big.wasm'), Buffer.alloc(splitOver + 1));
		splitLargeFiles(folder);
	});

	afterAll(() => rmSync(folder, { recursive: true, force: true }));

	it('splits each file over the limit into parts under it, kept private, and lists them', () => {
		const split = JSON.parse(readFileSync(path.join(folder, partsListFile), 'utf8'));
		expect(Object.keys(split).sort()).toEqual(['/copies/list.csv', '/offline-catalog/index.json']);
		expect(split['/copies/list.csv']).toEqual({
			bytes: list.length,
			sha256: sha256(list),
			parts: Array.from({ length: Math.ceil(list.length / partBytes) }, (_, index) => `/page-data/private/parts/copies/list.csv/${index + 1}.csv`)
		});
		expect(split['/offline-catalog/index.json'].parts).toHaveLength(3);
		for (const file of Object.values(split) as { parts: string[] }[]) {
			for (const part of file.parts) expect(statSync(path.join(folder, part)).size).toBeLessThanOrEqual(partBytes);
		}
		expect(existsSync(path.join(folder, 'copies/list.csv'))).toBe(false);
		expect(existsSync(path.join(folder, 'copies/offline.json'))).toBe(true);
		// A script that large is left for the size check to name.
		expect(existsSync(path.join(folder, '_app/immutable/big.wasm'))).toBe(true);
	});

	it('answers a split file at its own address with the same bytes, type and size', async () => {
		const inner = { fetch: async () => new Response('inner') };
		const worker = withJoinedFiles(inner);
		const env = { ASSETS: folderAssets(folder) };
		const response = await worker.fetch(new Request('https://site.test/copies/list.csv'), env, {});
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('text/csv');
		expect(response.headers.get('content-length')).toBe(String(list.length));
		expect(response.headers.get('x-content-type-options')).toBe('nosniff');
		expect(Buffer.from(await response.arrayBuffer()).equals(list)).toBe(true);
		const catalogResponse = await worker.fetch(new Request('https://site.test/offline-catalog/index.json'), env, {});
		expect(catalogResponse.headers.get('content-type')).toBe('application/json');
		expect(Buffer.from(await catalogResponse.arrayBuffer()).equals(catalog)).toBe(true);
	});

	it('answers "not modified" for the tag it gave, and a HEAD request without a body', async () => {
		const worker = withJoinedFiles({ fetch: async () => new Response('inner') });
		const env = { ASSETS: folderAssets(folder) };
		const first = await worker.fetch(new Request('https://site.test/copies/list.csv'), env, {});
		await first.body?.cancel();
		const tag = first.headers.get('etag') ?? '';
		expect(tag).toBe(`"${sha256(list)}"`);
		const again = await worker.fetch(new Request('https://site.test/copies/list.csv', { headers: { 'if-none-match': `W/${tag}` } }), env, {});
		expect(again.status).toBe(304);
		const head = await worker.fetch(new Request('https://site.test/copies/list.csv', { method: 'HEAD' }), env, {});
		expect(head.status).toBe(200);
		expect(head.headers.get('content-length')).toBe(String(list.length));
		expect(await head.text()).toBe('');
	});

	it('lets the Worker read a split file through ASSETS, and passes every other request on', async () => {
		let read: Buffer | undefined;
		const inner = {
			async fetch(request: Request) {
				const env = imported.env as Bindings;
				read = Buffer.from(await (await env.ASSETS.fetch(new URL('/copies/list.csv', request.url).toString())).arrayBuffer());
				return env.ASSETS.fetch(request.url);
			}
		};
		const response = await withJoinedFiles(inner).fetch(new Request('https://site.test/copies/offline.json'), { ASSETS: folderAssets(folder) }, {});
		expect(read?.equals(list)).toBe(true);
		expect(Buffer.from(await response.arrayBuffer()).equals(small)).toBe(true);
	});

	it('gives the scheduled handler the same files', async () => {
		let read = 0;
		const inner = {
			fetch: async () => new Response('inner'),
			async scheduled() {
				read = (await (await (imported.env as Bindings).ASSETS.fetch('https://site.test/offline-catalog/index.json')).arrayBuffer()).byteLength;
			}
		};
		await (withJoinedFiles(inner) as unknown as { scheduled: (event: unknown, env: unknown, context: unknown) => Promise<void> }).scheduled({}, { ASSETS: folderAssets(folder) }, {});
		expect(read).toBe(catalog.length);
	});

	it('sends the list of copies through the restriction filter, never straight from its parts', async () => {
		const seen: string[] = [];
		const inner = {
			async fetch(request: Request) {
				const env = imported.env as Bindings;
				const { pathname } = new URL(request.url);
				seen.push(pathname);
				if (pathname !== '/restricted-files/copies/list.csv') return new Response('Not found', { status: 404 });
				// What src/routes/restricted-files does: reads the built file through ASSETS and filters it.
				const text = await (await env.ASSETS.fetch(new URL('/copies/list.csv', request.url).toString())).text();
				return new Response(text.split('\n').filter((row) => !row.startsWith('Copy 7 ')).join('\n'));
			}
		};
		const worker = withNationPageChanges(withJoinedFiles(inner));
		const env = { ASSETS: folderAssets(folder) };
		const filtered = await (await worker.fetch(new Request('https://site.test/copies/list.csv'), env, {})).text();
		expect(seen).toEqual(['/restricted-files/copies/list.csv']);
		expect(filtered).not.toContain('Copy 7 ');
		expect(filtered).toContain('Copy 8 ');
		const part = await worker.fetch(new Request('https://site.test/page-data/private/parts/copies/list.csv/1.csv'), env, {});
		expect(part.status).toBe(404);
	});

	it('fails a download whose part is missing, rather than send a file cut short', async () => {
		const assets = folderAssets(folder);
		const missingPart = {
			fetch: (input: Request | string | URL, init?: RequestInit) => (new Request(input, init).url.endsWith('/2.csv') ? Promise.resolve(new Response('Not found', { status: 404 })) : assets.fetch(input, init))
		};
		const response = await joinedAssets(missingPart).fetch('https://site.test/copies/list.csv');
		expect(response.status).toBe(200);
		await expect(response.arrayBuffer()).rejects.toThrow(/Part 2/);
	});

	it('leaves a build with nothing split as it is', async () => {
		const empty = mkdtempSync(path.join(tmpdir(), 'joined-files-none-'));
		try {
			const response = await joinedAssets(folderAssets(empty)).fetch('https://site.test/copies/list.csv');
			expect(response.status).toBe(404);
		} finally {
			rmSync(empty, { recursive: true, force: true });
		}
	});
});
