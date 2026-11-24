import { isHttpError } from '@sveltejs/kit';
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { essayHistory, essayIndex, essayPage, generatedKind, renderedVersion, renderWithGenerated, storageForPages } from '#lib/server/essay-pages.ts';
import { publishVersion, saveVersion, setPublicationListed } from '#lib/server/essays.ts';
import { memoryBucket } from './mail-fixtures.ts';
import { testDatabase } from './database.ts';

const bindings = vi.hoisted(() => ({}) as Record<string, unknown>);
vi.mock('cloudflare:workers', () => ({ env: bindings, waitUntil: () => undefined }));
vi.mock('$app/env', () => ({ version: 'test-build' }));
vi.mock('virtual:essay-library', () => ({
	essayBoxFacts: { cases: {}, laws: {} },
	essayCaseLinks: {},
	essayCaseNames: {
		'worcester-v-georgia': { title: 'Worcester v. Georgia', date: [1832, 3, 3] },
		'cherokee-nation-v-georgia': { title: 'Cherokee Nation v. Georgia', date: [1831, 3, 18] }
	},
	essayCitations: {},
	essayOpinions: {},
	essayTerms: {},
	// Nothing in git, so the pages are built only from what each test saves.
	essaysInGit: {}
}));

let database: D1Database;
let bucket: ReturnType<typeof memoryBucket>;

const text = (title: string, body: string, frontMatter = '') => `---\ntitle: "${title}"\n${frontMatter}---\n\n# ${title}\n\n${body}\n`;

/** Saves a new version of an essay and returns its number. */
async function save(identifier: string, content: string): Promise<number> {
	const latest = await database
		.prepare('SELECT MAX(number) AS number FROM essay_versions WHERE essay_identifier = ?')
		.bind(identifier)
		.first<{ number: number | null }>();
	const { version } = await saveVersion(database, bucket, { identifier, text: content, basedOn: latest?.number ?? null, personIdentifier: 'lead', origin: 'editor' });
	return version.number;
}

async function publish(identifier: string, content: string): Promise<number> {
	return publishVersion(database, identifier, await save(identifier, content), 'lead');
}

async function refusal(check: Promise<unknown>): Promise<number> {
	try {
		await check;
	} catch (problem) {
		if (isHttpError(problem)) return problem.status;
		throw problem;
	}
	throw new Error('The page was served.');
}

beforeEach(async () => {
	for (const key of Object.keys(bindings)) delete bindings[key];
	database = testDatabase();
	bucket = memoryBucket();
	Object.assign(bindings, { database, sourceDocuments: bucket });
	await database
		.prepare(`INSERT INTO people (identifier, email, display_name, role, status, added_at) VALUES ('lead', 'lead@example.org', 'Lead', 'lead-author', 'active', '2026-11-20T00:00:00Z')`)
		.run();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('generatedKind', () => {
	it('reads the kind of generated page from the front matter', () => {
		expect(generatedKind(text('Cases by topic', '', 'generated: cases-by-topic\n'))).toBe('cases-by-topic');
		expect(generatedKind(text('An essay', 'Body.'))).toBeUndefined();
		expect(generatedKind(text('Blank', '', 'generated: \n'))).toBeUndefined();
	});
});

describe('storageForPages', () => {
	it('answers 503 while the database or the bucket is not connected', async () => {
		delete bindings.sourceDocuments;
		expect(await refusal(Promise.resolve().then(() => storageForPages()))).toBe(503);
	});
});

describe('essayPage', () => {
	it('answers 404 for an essay that does not exist, or under another part’s address', async () => {
		expect(await refusal(essayPage('essays', 'no-such-essay'))).toBe(404);
		await publish('i-timeline', text('Timeline', 'One.'));
		expect(await refusal(essayPage('essays', 'i-timeline'))).toBe(404);
		expect((await essayPage('foundations', 'timeline')).path).toBe('/foundations/timeline');
	});

	it('says an essay that is saved but not published is not published yet, and shows nothing of it', async () => {
		await save('peacemaking', text('Peacemaking', 'A draft nobody should read yet.'));
		const page = await essayPage('essays', 'peacemaking');
		expect(page).toMatchObject({ identifier: 'peacemaking', title: 'Not published yet', html: '', unpublished: true, publicationCount: 0, publication: undefined });
		expect(await refusal(essayPage('essays', 'peacemaking', 1))).toBe(404);
	});

	it('shows the newest publication, not a draft saved after it', async () => {
		await publish('peacemaking', text('Peacemaking', 'The published text.'));
		await save('peacemaking', text('Peacemaking, revised', 'A draft saved later.'));
		const page = await essayPage('essays', 'peacemaking');
		expect(page.title).toBe('Peacemaking');
		expect(page.html).toContain('The published text.');
		expect(page.html).not.toContain('A draft saved later.');
		expect(page).toMatchObject({ path: '/essays/peacemaking', isNewest: true, publicationCount: 1, unpublished: false });
		expect(page.publication).toMatchObject({ number: 1, versionNumber: 1, title: 'Peacemaking', link: '/essays/peacemaking' });
		expect(page.newest).toEqual(page.publication);
		expect(page.outline.title).toBe('Peacemaking');
	});

	it('shows an earlier publication at its own address, pointing to the newest', async () => {
		await publish('peacemaking', text('Peacemaking', 'First words.'));
		await publish('peacemaking', text('Peacemaking', 'Second words.'));
		const older = await essayPage('essays', 'peacemaking', 1);
		expect(older.html).toContain('First words.');
		expect(older).toMatchObject({ isNewest: false, publicationCount: 2 });
		expect(older.publication).toMatchObject({ number: 1, link: '/essays/peacemaking/history/1' });
		expect(older.newest).toMatchObject({ number: 2, link: '/essays/peacemaking' });
		expect(await refusal(essayPage('essays', 'peacemaking', 3))).toBe(404);
	});

	it('leaves out a publication held back from readers', async () => {
		await publish('peacemaking', text('Peacemaking', 'First words.'));
		await publish('peacemaking', text('Peacemaking', 'Words held back.'));
		await setPublicationListed(database, 'peacemaking', 2, false, 'lead', 'A mistake');
		const page = await essayPage('essays', 'peacemaking');
		expect(page.html).toContain('First words.');
		expect(page.publicationCount).toBe(1);
		expect(await refusal(essayPage('essays', 'peacemaking', 2))).toBe(404);
	});

	it('gives the headings for the sidebar outline', async () => {
		await publish('peacemaking', text('Peacemaking', '## Where it comes from\n\nText.\n\n## How it works\n\nMore text.'));
		const page = await essayPage('essays', 'peacemaking');
		expect(page.headings.map((heading) => [heading.label, heading.link])).toEqual([
			['Where it comes from', '#where-it-comes-from'],
			['How it works', '#how-it-works']
		]);
		expect(page.outline.items).toBe(page.headings);
	});
});

describe('essayHistory', () => {
	it('lists the publications readers may see, newest first, each at its own address', async () => {
		await publish('peacemaking', text('Peacemaking', 'One.'));
		await publish('peacemaking', text('Peacemaking again', 'Two.'));
		await publish('peacemaking', text('Peacemaking held', 'Three.'));
		await setPublicationListed(database, 'peacemaking', 3, false, 'lead', null);
		const history = await essayHistory('essays', 'peacemaking');
		expect(history.title).toBe('Peacemaking again');
		expect(history.publications.map((entry) => [entry.number, entry.link])).toEqual([
			[2, '/essays/peacemaking'],
			[1, '/essays/peacemaking/history/1']
		]);
	});

	it('answers 404 for an essay not published yet, or not there', async () => {
		await save('peacemaking', text('Peacemaking', 'A draft.'));
		expect(await refusal(essayHistory('essays', 'peacemaking'))).toBe(404);
		expect(await refusal(essayHistory('essays', 'no-such-essay'))).toBe(404);
	});
});

describe('essayIndex', () => {
	it('lists only the part’s published essays, under their published titles', async () => {
		await publish('peacemaking', text('Peacemaking', 'One.'));
		await save('peacemaking', text('A later working title', 'Two.'));
		await save('arbitration', text('Arbitration', 'A draft.'));
		await publish('i-timeline', text('Timeline', 'Part I.'));
		const index = await essayIndex('essays');
		expect(index.essays).toEqual([{ identifier: 'peacemaking', title: 'Peacemaking', link: '/essays/peacemaking', publishedAtText: expect.any(String) }]);
		expect(index.outline.items).toEqual([{ label: 'Peacemaking', link: '/essays/peacemaking' }]);
		expect((await essayIndex('foundations')).essays.map((essay) => essay.link)).toEqual(['/foundations/timeline']);
	});
});

describe('the index of cases by topic', () => {
	const tagged = (key: string, topic: string) => `:::: case ${key}\n::: topics\n${topic}\n:::\n::::`;
	const index = text('Cases by topic', 'Every case, by topic.', 'generated: cases-by-topic\npart: back-matter\n');

	it('builds the index from published essays’ case boxes, linking each case to the page that holds its box', async () => {
		await publish('sovereignty', text('Sovereignty', tagged('worcester-v-georgia', 'Sovereignty')));
		await save('drafts', text('Drafts', tagged('cherokee-nation-v-georgia', 'Removal')));
		const page = await renderWithGenerated(index, 'published');
		expect(page.html).toContain('Every case, by topic.');
		expect(page.html).toContain('Sovereignty');
		expect(page.html).toContain('Worcester v. Georgia');
		// A case only in an unpublished draft is left out of the public index.
		expect(page.html).not.toContain('Cherokee Nation v. Georgia');
	});

	it('builds the workspace’s copy from the newest saved text of every essay', async () => {
		await save('drafts', text('Drafts', tagged('cherokee-nation-v-georgia', 'Removal')));
		const page = await renderWithGenerated(index, 'saved');
		expect(page.html).toContain('Cherokee Nation v. Georgia');
		expect(page.html).toContain('Removal');
	});

	it('renders a page that is not generated as it is', async () => {
		const page = await renderWithGenerated(text('Plain', tagged('worcester-v-georgia', 'Sovereignty')), 'published');
		expect(page.title).toBe('Plain');
		expect(page.html).not.toContain('Every case, by topic.');
	});
});

describe('renderedVersion', () => {
	function memoryCache() {
		const stored = new Map<string, string>();
		return {
			stored,
			async match(key: string) {
				return stored.has(key) ? new Response(stored.get(key)) : undefined;
			},
			async put(key: string, response: Response) {
				stored.set(key, await response.text());
			}
		};
	}

	it('keeps a rendering in the cache by the site build and the file’s hash, and reuses it', async () => {
		const cache = memoryCache();
		vi.stubGlobal('caches', { default: cache });
		await publish('peacemaking', text('Peacemaking', 'Cached words.'));
		const row = (await database.prepare('SELECT object_key, sha256 FROM essay_versions WHERE number = 1').first<{ object_key: string; sha256: string }>())!;
		const first = await renderedVersion(bucket, row);
		const key = `https://essay-cache.invalid/test-build/${row.sha256}`;
		expect(JSON.parse(cache.stored.get(key)!)).toEqual(first);
		// The next reader gets the stored rendering without rendering again.
		cache.stored.set(key, JSON.stringify({ ...first, title: 'From the cache' }));
		expect((await renderedVersion(bucket, row)).title).toBe('From the cache');
	});

	it('renders a generated page afresh each time, since the essays it lists change without it', async () => {
		const cache = memoryCache();
		vi.stubGlobal('caches', { default: cache });
		await publish('cases-by-topic', text('Cases by topic', 'Index.', 'generated: cases-by-topic\npart: back-matter\n'));
		const row = (await database.prepare('SELECT object_key, sha256 FROM essay_versions WHERE number = 1').first<{ object_key: string; sha256: string }>())!;
		expect((await renderedVersion(bucket, row)).title).toBe('Cases by topic');
		expect(cache.stored.size).toBe(0);
	});

	it('renders without a cache where there is none', async () => {
		await publish('peacemaking', text('Peacemaking', 'Words.'));
		const row = (await database.prepare('SELECT object_key, sha256 FROM essay_versions WHERE number = 1').first<{ object_key: string; sha256: string }>())!;
		expect((await renderedVersion(bucket, row)).html).toContain('Words.');
	});
});
