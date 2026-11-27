import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { publishVersion, saveVersion } from '#lib/server/essays.ts';
import { newsPosts } from '#lib/server/news-posts.ts';
import { frontMatterField, setFrontMatterField } from '#lib/essays/syntax.ts';
import { atomFeed } from '#lib/news-feed.ts';
import { testDatabase } from './database.ts';

function memoryBucket(): R2Bucket {
	const files = new Map<string, string>();
	return {
		async put(key: string, value: string) {
			files.set(key, value);
			return { key };
		},
		async head(key: string) {
			return files.has(key) ? { key } : null;
		},
		async get(key: string) {
			const value = files.get(key);
			return value === undefined ? null : { text: async () => value };
		}
	} as unknown as R2Bucket;
}

let database: D1Database;
let bucket: R2Bucket;

beforeEach(async () => {
	database = testDatabase();
	bucket = memoryBucket();
	await database
		.prepare(`INSERT INTO people (identifier, email, display_name, role, status, added_at) VALUES ('lead', 'l@example.org', 'Lead', 'lead-author', 'active', '2026-11-22T00:00:00Z')`)
		.run();
});

const post = (title: string, summary: string, words = 'Text.') => `---\ntitle: ${JSON.stringify(title)}\npart: news\ndescription: ${JSON.stringify(summary)}\n---\n\n# ${title}\n\n${words}\n`;

afterEach(() => {
	vi.useRealTimers();
});

/** Publications never change, so each is made at the time the test names. */
async function publish(identifier: string, text: string, at: string, basedOn: number | null = null): Promise<void> {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date(at));
	const saved = await saveVersion(database, bucket, { identifier, text, basedOn, personIdentifier: 'lead', origin: 'editor', part: 'news' });
	await publishVersion(database, identifier, saved.version.number, 'lead');
	vi.useRealTimers();
}

describe('News posts', () => {
	it('lists published posts newest first by the day each was first published, with its summary', async () => {
		await publish('welcome', post('Welcome', 'What this site is for.'), '2026-11-22T18:00:00Z');
		await publish('statutes', post('Statutes from Five States', 'Five states.'), '2026-11-24T18:00:00Z');
		// A correction to the first post keeps its place and takes its new title.
		await publish('welcome', post('Welcome to the Site', 'What this site is for.'), '2026-11-25T18:00:00Z', 1);
		await saveVersion(database, bucket, { identifier: 'draft-post', text: post('Draft', 'Not yet.'), basedOn: null, personIdentifier: 'lead', origin: 'editor', part: 'news' });

		const posts = await newsPosts(database, bucket);
		expect(posts.map((item) => [item.identifier, item.title, item.summary, item.postedText, item.link])).toEqual([
			['statutes', 'Statutes from Five States', 'Five states.', 'Nov. 24, 2026', '/news/statutes'],
			['welcome', 'Welcome to the Site', 'What this site is for.', 'Nov. 22, 2026', '/news/welcome']
		]);
		expect(posts[1].updatedAt).toBe('2026-11-25T18:00:00.000Z');
		// Nobody chose to be credited on the website here, so no author is named.
		expect(posts[0].author).toBeNull();
	});
});

describe('the summary box', () => {
	it('writes the description into the front matter as one quoted line', () => {
		const start = 'title: "Welcome"\npart: news\nstatus: draft';
		const set = setFrontMatterField(start, 'description', 'Line one\nline "two" ');
		expect(set).toBe('title: "Welcome"\npart: news\nstatus: draft\ndescription: "Line one line \\"two\\" "');
		expect(frontMatterField(set, 'description')).toBe('Line one line "two" ');
		expect(setFrontMatterField(set, 'description', 'Shorter')).toBe('title: "Welcome"\npart: news\nstatus: draft\ndescription: "Shorter"');
		expect(setFrontMatterField(set, 'description', '  ')).toBe(start);
	});
});

describe('the Atom feed', () => {
	it('names each post with its address, dates, summary and escaped text', () => {
		const xml = atomFeed({
			site: 'https://triballawproject.org/',
			builtAt: '2026-11-27T00:00:00Z',
			posts: [
				{
					identifier: 'welcome',
					title: 'Welcome & hello',
					link: '/news/welcome',
					summary: 'What <this> is.',
					postedAt: '2026-11-22T18:00:00Z',
					updatedAt: '2026-11-25T18:00:00Z',
					html: '<p>Text <a href="#source-1">1</a></p>',
					author: { name: 'Trevor Goldsmith' }
				}
			]
		});
		expect(xml).toContain('<id>https://triballawproject.org/news</id>');
		expect(xml).toContain('<link rel="self" type="application/atom+xml" href="https://triballawproject.org/news/feed.xml"/>');
		expect(xml).toContain('<updated>2026-11-25T18:00:00.000Z</updated>');
		expect(xml).toContain('<title>Welcome &amp; hello</title>');
		expect(xml).toContain('<published>2026-11-22T18:00:00.000Z</published>');
		expect(xml).toContain('<summary>What &lt;this&gt; is.</summary>');
		expect(xml).toContain('<author><name>Trevor Goldsmith</name></author>');
		expect(xml).toContain('<content type="html" xml:base="https://triballawproject.org/news/welcome">&lt;p&gt;Text &lt;a href=&quot;#source-1&quot;&gt;1&lt;/a&gt;&lt;/p&gt;</content>');
	});
});
