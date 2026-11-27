import { createHash } from 'node:crypto';
import type { R2Bucket } from '@cloudflare/workers-types/index.ts';
import { unzipSync, strFromU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { documentsZip, keyOfCopyPath } from '#lib/server/document-zips.ts';

function sha(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

describe('the ZIP of a set of documents', () => {
	it('holds the copies the bucket has, a list with each SHA-256 and lines sha256sum reads', async () => {
		const first = new TextEncoder().encode('%PDF-1.4 first');
		const objects = new Map([['constitutions/a/one file.pdf', first]]);
		const bucket = {
			get: async (key: string) => {
				const bytes = objects.get(key);
				return bytes ? { body: new Blob([bytes]).stream(), uploaded: new Date('2026-11-21T00:00:00Z') } : null;
			}
		};
		const list = {
			title: 'Example Nation',
			files: [
				['/copies/constitutions/a/one%20file.pdf', first.length, sha(first), 'Constitution', 'https://example.org/one.pdf'],
				['/copies/constitutions/a/missing.pdf', 10, 'b'.repeat(64), 'Law', 'https://example.org/law.pdf']
			] as [string, number, string, string, string][]
		};
		const served = new Set(['constitutions/a/one file.pdf', 'constitutions/a/missing.pdf']);
		const stream = documentsZip(list, bucket as unknown as R2Bucket, served, 'Read me');
		const zip = unzipSync(new Uint8Array(await new Response(stream).arrayBuffer()));
		expect(Object.keys(zip).sort()).toEqual(['README.txt', 'SHA256SUMS.txt', 'documents.csv', 'documents/one file.pdf', 'verify.ps1', 'verify.sh']);
		expect(sha(zip['documents/one file.pdf'])).toBe(sha(first));
		expect(strFromU8(zip['SHA256SUMS.txt'])).toBe(`${sha(first)}  documents/one file.pdf\n`);
		const csv = strFromU8(zip['documents.csv']);
		expect(csv).toContain(`${sha(first)},yes`);
		expect(csv).toContain(`${'b'.repeat(64)},no`);
		expect(keyOfCopyPath('/copies/constitutions/a/one%20file.pdf')).toBe('constitutions/a/one file.pdf');
	});

	it('names each file by its title when the list gives one', async () => {
		const first = new TextEncoder().encode('%PDF-1.4 first');
		const bucket = { get: async () => ({ body: new Blob([first]).stream(), uploaded: new Date('2026-11-21T00:00:00Z') }) };
		const list = {
			title: 'Example Nation',
			files: [['/copies/tribal-law/documents/6df61ccdf0a3cbf733b3.pdf', first.length, sha(first), 'Peacemaker Court', 'https://example.org/a.pdf', 'Peacemaker Court - Example Nation.pdf']] as [
				string,
				number,
				string,
				string,
				string,
				string
			][]
		};
		const stream = documentsZip(list, bucket as unknown as R2Bucket, new Set(['tribal-law/documents/6df61ccdf0a3cbf733b3.pdf']), 'Read me');
		const zip = unzipSync(new Uint8Array(await new Response(stream).arrayBuffer()));
		expect(Object.keys(zip)).toContain('documents/Peacemaker Court - Example Nation.pdf');
		expect(strFromU8(zip['SHA256SUMS.txt'])).toBe(`${sha(first)}  documents/Peacemaker Court - Example Nation.pdf\n`);
	});
});
