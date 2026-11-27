import { describe, expect, it, vi } from 'vitest';
import { citationFileCount, citationFileNumber, citationFilePath, citationTextsPath, plainCitation } from '#lib/essay-citation-files.ts';

const worker = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock('$app/env', () => ({ version: 'test-build', building: false, dev: false }));
vi.mock('cloudflare:workers', () => ({ env: worker.env, waitUntil: () => {} }));

const { citationsFor, citationTexts, renderWithCitations } = await import('#lib/server/essay-citations.ts');

const citations: Record<string, string> = {
	'worcester-v-georgia': '<i>Worcester v. Georgia</i>, 31 U.S. 515 (1832).',
	'johnson-v-mintosh': '<i>Johnson v. M&#38;Intosh</i>, 21 U.S. 543 (1823). <span class="reading-links"><button>Where</button></span>'
};

/** Static files as the build writes them, and the addresses asked for. */
function staticFiles() {
	const files = new Map<string, string>();
	for (const [key, html] of Object.entries(citations)) {
		const address = citationFilePath(citationFileNumber(key));
		files.set(address, JSON.stringify({ ...JSON.parse(files.get(address) ?? '{}'), [key]: html }));
	}
	files.set(citationTextsPath, JSON.stringify(Object.entries(citations).map(([key, html]) => [key, plainCitation(html)])));
	const asked: string[] = [];
	return {
		asked,
		async fetch(request: string) {
			const address = new URL(request).pathname;
			asked.push(address);
			const body = files.get(address);
			// Every one of the citation files is built, even an empty one.
			if (body === undefined && address.startsWith('/page-data/essay-citations/')) return new Response('{}');
			return body === undefined ? new Response('Not found', { status: 404 }) : new Response(body);
		}
	};
}

const library = { citation: () => undefined, term: () => undefined };

describe('the citation files', () => {
	it('spreads keys over the files by a stable hash', () => {
		const number = citationFileNumber('worcester-v-georgia');
		expect(number).toBe(citationFileNumber('worcester-v-georgia'));
		expect(number).toBeGreaterThanOrEqual(0);
		expect(number).toBeLessThan(citationFileCount);
		expect(citationFilePath(number)).toBe(`/page-data/essay-citations/${number}.json`);
	});

	it('gives a citation as plain text without where to read it', () => {
		expect(plainCitation(citations['johnson-v-mintosh'])).toBe('Johnson v. M&Intosh, 21 U.S. 543 (1823).');
	});
});

describe('reading citations in the Worker', () => {
	it('reads only the files that hold the keys asked for, once each', async () => {
		const files = staticFiles();
		worker.env.ASSETS = files;
		const found = await citationsFor(['worcester-v-georgia', 'no-such-source']);
		expect(found.get('worcester-v-georgia')).toBe(citations['worcester-v-georgia']);
		expect(found.has('no-such-source')).toBe(false);
		const asked = files.asked.length;
		expect(asked).toBeLessThanOrEqual(2);
		await citationsFor(['worcester-v-georgia']);
		expect(files.asked.length).toBe(asked);
	});

	it('draws an essay with the citations of the sources it cites', async () => {
		worker.env.ASSETS = staticFiles();
		const rendered = await renderWithCitations('# A\n\nOne [@worcester-v-georgia]. Two [@no-such-source].\n', library);
		expect(rendered.sources.map((source) => source.html)).toEqual([citations['worcester-v-georgia'], 'no-such-source']);
	});

	it('gives every source as plain text for the editor', async () => {
		worker.env.ASSETS = staticFiles();
		expect(await citationTexts()).toEqual([
			['worcester-v-georgia', 'Worcester v. Georgia, 31 U.S. 515 (1832).'],
			['johnson-v-mintosh', 'Johnson v. M&Intosh, 21 U.S. 543 (1823).']
		]);
	});
});
