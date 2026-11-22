import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mergeThreeWay } from '#lib/essays/merge.ts';
import { latestVersion, readVersionText, saveVersion, versions } from '#lib/server/essays.ts';
import { syncEssaysFromGit } from '#lib/server/essay-git-sync.ts';
import { testDatabase } from './database.ts';

vi.mock('virtual:essay-library', () => ({ essaysInGit: {} }));

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

const essay = (...paragraphs: string[]) => `---\ntitle: "Timeline"\npart: i\n---\n\n# Timeline\n\n${paragraphs.join('\n\n')}\n`;

describe('three-way merge by paragraph', () => {
	const base = 'One.\n\nTwo.\n\nThree.\n';
	it('keeps changes made on each side to different paragraphs', () => {
		expect(mergeThreeWay(base, 'One, edited here.\n\nTwo.\n\nThree.\n', 'One.\n\nTwo.\n\nThree, edited in git.\n')).toEqual({
			merged: true,
			text: 'One, edited here.\n\nTwo.\n\nThree, edited in git.\n'
		});
	});
	it('keeps added and removed paragraphs from both sides', () => {
		expect(mergeThreeWay(base, 'One.\n\nThree.\n', 'One.\n\nTwo.\n\nThree.\n\nFour.\n')).toEqual({ merged: true, text: 'One.\n\nThree.\n\nFour.\n' });
	});
	it('accepts the same change made on both sides', () => {
		expect(mergeThreeWay(base, 'One.\n\nTwo!\n\nThree.\n', 'One.\n\nTwo!\n\nThree.\n')).toEqual({ merged: true, text: 'One.\n\nTwo!\n\nThree.\n' });
	});
	it('gives up when both sides changed the same paragraph differently', () => {
		expect(mergeThreeWay(base, 'One.\n\nTwo here.\n\nThree.\n', 'One.\n\nTwo in git.\n\nThree.\n')).toEqual({ merged: false, conflicts: 1 });
	});
});

let database: D1Database;
let bucket: ReturnType<typeof memoryBucket>;

beforeEach(async () => {
	database = testDatabase();
	bucket = memoryBucket();
	await database
		.prepare(`INSERT INTO people (identifier, email, display_name, role, status, added_at) VALUES ('lead', 'l@example.org', 'Lead', 'lead-author', 'active', '2026-11-22T00:00:00Z')`)
		.run();
});

const latestText = async () => readVersionText(bucket, (await latestVersion(database, 'i-timeline'))!);

describe('bringing in essays from git by itself', () => {
	it('saves an essay new to the site as its first version, with nobody named', async () => {
		const outcomes = await syncEssaysFromGit(database, bucket, { 'i-timeline': essay('One.') });
		expect(outcomes).toEqual([{ identifier: 'i-timeline', state: 'saved', version: 1 }]);
		const [first] = await versions(database, 'i-timeline');
		expect([first.origin, first.person_identifier, first.note]).toEqual(['git', null, 'From git']);
	});

	it('does nothing when git has not changed', async () => {
		await syncEssaysFromGit(database, bucket, { 'i-timeline': essay('One.') });
		expect(await syncEssaysFromGit(database, bucket, { 'i-timeline': essay('One.') })).toEqual([{ identifier: 'i-timeline', state: 'current' }]);
	});

	it('saves the new git text when nothing was edited here', async () => {
		await syncEssaysFromGit(database, bucket, { 'i-timeline': essay('One.') });
		expect(await syncEssaysFromGit(database, bucket, { 'i-timeline': essay('One.', 'Two.') })).toEqual([
			{ identifier: 'i-timeline', state: 'saved', version: 2 }
		]);
		expect(await latestText()).toBe(essay('One.', 'Two.'));
	});

	it('merges git changes with edits made here, and keeps both on the next build', async () => {
		await syncEssaysFromGit(database, bucket, { 'i-timeline': essay('One.', 'Two.', 'Three.') });
		await saveVersion(database, bucket, { identifier: 'i-timeline', text: essay('One, edited here.', 'Two.', 'Three.'), basedOn: 1, personIdentifier: 'lead', origin: 'editor' });
		const changed = essay('One.', 'Two.', 'Three, edited in git.');
		expect(await syncEssaysFromGit(database, bucket, { 'i-timeline': changed })).toEqual([{ identifier: 'i-timeline', state: 'merged', version: 3 }]);
		expect(await latestText()).toBe(essay('One, edited here.', 'Two.', 'Three, edited in git.'));
		// The same git text on the next build is already in; the edit made here survives.
		expect(await syncEssaysFromGit(database, bucket, { 'i-timeline': changed })).toEqual([{ identifier: 'i-timeline', state: 'current' }]);
		// A later git change merges from the git text, not from the merged version.
		const later = essay('One.', 'Two, edited in git.', 'Three, edited in git.');
		expect(await syncEssaysFromGit(database, bucket, { 'i-timeline': later })).toEqual([{ identifier: 'i-timeline', state: 'merged', version: 4 }]);
		expect(await latestText()).toBe(essay('One, edited here.', 'Two, edited in git.', 'Three, edited in git.'));
	});

	it('saves nothing when the same paragraph changed on both sides', async () => {
		await syncEssaysFromGit(database, bucket, { 'i-timeline': essay('One.') });
		await saveVersion(database, bucket, { identifier: 'i-timeline', text: essay('One, here.'), basedOn: 1, personIdentifier: 'lead', origin: 'editor' });
		expect(await syncEssaysFromGit(database, bucket, { 'i-timeline': essay('One, in git.') })).toEqual([
			{ identifier: 'i-timeline', state: 'conflict', conflicts: 1, latestVersion: 2 }
		]);
		expect(await latestText()).toBe(essay('One, here.'));
	});
});
