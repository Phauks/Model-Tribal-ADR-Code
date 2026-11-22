import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import { beforeEach, describe, expect, it } from 'vitest';
import {
	SaveConflict,
	boxPages,
	currentPublication,
	essayPath,
	essayRow,
	identifierFromPath,
	listEssays,
	partOf,
	publishVersion,
	saveVersion,
	setPublicationListed,
	versions
} from '#lib/server/essays.ts';
import { testDatabase } from './database.ts';

function memoryBucket(): R2Bucket & { files: Map<string, string> } {
	const files = new Map<string, string>();
	return {
		files,
		async put(key: string, value: string, options?: { onlyIf?: Headers }) {
			if (options?.onlyIf?.get('If-None-Match') === '*' && files.has(key)) return null;
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
	} as unknown as R2Bucket & { files: Map<string, string> };
}

let database: D1Database;
let bucket: ReturnType<typeof memoryBucket>;

beforeEach(async () => {
	database = testDatabase();
	bucket = memoryBucket();
	await database
		.prepare(`INSERT INTO people (identifier, email, display_name, role, status, added_at) VALUES ('lead', 'l@example.org', 'Lead', 'lead-author', 'active', '2026-11-22T00:00:00Z')`)
		.run();
});

const essay = (title: string, words: string) => `---\ntitle: "${title}"\npart: i\n---\n\n# ${title}\n\n${words}\n`;

describe('essays in the bucket', () => {
	it('saves numbered versions that are never replaced', async () => {
		const first = await saveVersion(database, bucket, { identifier: 'i-timeline', text: essay('Timeline', 'One.'), basedOn: null, personIdentifier: 'lead', origin: 'git' });
		expect(first.version.number).toBe(1);
		expect(first.version.object_key).toMatch(/^essays\/i-timeline\/versions\/1-[0-9a-f]{12}\.md$/);
		const second = await saveVersion(database, bucket, { identifier: 'i-timeline', text: essay('Timeline', 'Two.'), basedOn: 1, personIdentifier: 'lead', origin: 'editor', note: 'Sent to advisors' });
		expect(second.version.number).toBe(2);
		expect(bucket.files.size).toBe(2);
		expect((await versions(database, 'i-timeline')).map((row) => [row.number, row.note, row.person_name])).toEqual([
			[2, 'Sent to advisors', 'Lead'],
			[1, null, 'Lead']
		]);
		await expect(database.prepare("UPDATE essay_versions SET note = 'x'").run()).rejects.toThrow(/cannot be changed/);
		await expect(database.prepare('DELETE FROM essay_versions').run()).rejects.toThrow(/cannot be deleted/);
		const [summary] = await listEssays(database);
		expect(summary).toMatchObject({ identifier: 'i-timeline', part: 'foundations', title: 'Timeline', latestVersion: 2, published: null });
	});

	it('refuses a save based on an old version, and keeps an unchanged text as it is', async () => {
		await saveVersion(database, bucket, { identifier: 'i-timeline', text: essay('Timeline', 'One.'), basedOn: null, personIdentifier: 'lead', origin: 'git' });
		await saveVersion(database, bucket, { identifier: 'i-timeline', text: essay('Timeline', 'Two.'), basedOn: 1, personIdentifier: 'lead', origin: 'editor' });
		await expect(
			saveVersion(database, bucket, { identifier: 'i-timeline', text: essay('Timeline', 'Three.'), basedOn: 1, personIdentifier: 'lead', origin: 'editor' })
		).rejects.toBeInstanceOf(SaveConflict);
		const same = await saveVersion(database, bucket, { identifier: 'i-timeline', text: essay('Timeline', 'Two.'), basedOn: 2, personIdentifier: 'lead', origin: 'editor' });
		expect(same).toMatchObject({ unchanged: true, version: { number: 2 } });
		// Naming the text as it stands saves it again, since a saved version never changes.
		const named = await saveVersion(database, bucket, {
			identifier: 'i-timeline',
			text: essay('Timeline', 'Two.'),
			basedOn: 2,
			personIdentifier: 'lead',
			origin: 'editor',
			note: 'Sent to advisors',
			evenIfUnchanged: true
		});
		expect(named).toMatchObject({ unchanged: false, version: { number: 3, note: 'Sent to advisors', sha256: same.version.sha256 } });
	});

	it('publishes a version, and can hold a publication back', async () => {
		await saveVersion(database, bucket, { identifier: 'i-timeline', text: essay('Timeline', 'One.'), basedOn: null, personIdentifier: 'lead', origin: 'git' });
		await saveVersion(database, bucket, { identifier: 'i-timeline', text: essay('Timeline', 'Two.'), basedOn: 1, personIdentifier: 'lead', origin: 'editor' });
		expect(await currentPublication(database, bucket, 'i-timeline')).toBeNull();
		expect(await publishVersion(database, 'i-timeline', 1, 'lead')).toBe(1);
		expect(await publishVersion(database, 'i-timeline', 2, 'lead')).toBe(2);
		expect((await currentPublication(database, bucket, 'i-timeline'))?.text).toContain('Two.');
		await setPublicationListed(database, 'i-timeline', 2, false, 'lead', 'A nation asked');
		expect((await currentPublication(database, bucket, 'i-timeline'))?.text).toContain('One.');
		await expect(database.prepare('UPDATE essay_publications SET version_number = 1').run()).rejects.toThrow(/listed or held back/);
		const events = await database.prepare("SELECT action FROM events WHERE target_identifier = 'essay:i-timeline' ORDER BY sequence").all<{ action: string }>();
		expect(events.results.map((row) => row.action)).toEqual([
			'Brought in the git text as version 1',
			'Saved version 2',
			'Published version 1 as publication 1',
			'Published version 2 as publication 2',
			'Held back publication 2'
		]);
	});

	it('puts Part I chapters under Foundations', () => {
		expect(partOf('i-legal-history-timeline')).toBe('foundations');
		expect(partOf('why-consent-matters', 'part: iv')).toBe('essays');
		expect(essayPath('i-legal-history-timeline', 'foundations')).toBe('/foundations/legal-history-timeline');
		expect(identifierFromPath('foundations', 'legal-history-timeline')).toBe('i-legal-history-timeline');
		expect(essayPath('why-consent-matters', 'essays')).toBe('/essays/why-consent-matters');
	});

	it('puts back matter under its own part', () => {
		expect(partOf('cases-by-topic', 'title: "Cases by Topic"\npart: back-matter')).toBe('back-matter');
		expect(essayPath('cases-by-topic', 'back-matter')).toBe('/back-matter/cases-by-topic');
		expect(identifierFromPath('back-matter', 'cases-by-topic')).toBe('cases-by-topic');
	});

	it('finds the page that holds each case and law box', () => {
		const pages = boxPages({
			'i-legal-history-timeline': '---\npart: i\n---\n\n:::: case worcester-v-georgia\n::::\n\n:::: law indian-reorganization-act\n::::\n',
			'cases-by-topic': '---\npart: back-matter\n---\n\n[*Worcester*](#case-worcester-v-georgia)\n'
		});
		expect(pages).toEqual({
			'case-worcester-v-georgia': '/foundations/legal-history-timeline',
			'law-indian-reorganization-act': '/foundations/legal-history-timeline'
		});
	});

	it('saves a back matter page under its part', async () => {
		const saved = await saveVersion(database, bucket, {
			identifier: 'cases-by-topic',
			text: '---\ntitle: "Cases by Topic"\npart: back-matter\n---\n\n# Cases by Topic\n',
			basedOn: null,
			personIdentifier: 'lead',
			origin: 'git'
		});
		expect(saved.version.number).toBe(1);
		expect((await essayRow(database, 'cases-by-topic'))?.part).toBe('back-matter');
	});
});
