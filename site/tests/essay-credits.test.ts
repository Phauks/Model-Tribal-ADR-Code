import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import { beforeEach, describe, expect, it } from 'vitest';
import { emptyAnswers, emptyPlacements, type ProfileAnswers } from '#lib/contributors.ts';
import { creditLine, finishedReviewers, joinNames, standingHandCredits, withReaderCredits } from '#lib/essays/credits.ts';
import { essayDateRange, essayShortDate } from '#lib/essays/dates.ts';
import { changeHandCredit, handCredits, readerNames, sectionCredits } from '#lib/server/essay-credits.ts';
import { confirmProfile, profileBySubject, saveAnswers } from '#lib/server/contributor-profiles.ts';
import { saveVersion } from '#lib/server/essays.ts';
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
			return value === undefined ? null : { text: async () => value, json: async () => JSON.parse(value) };
		},
		async list({ prefix }: { prefix: string }) {
			return { objects: [...files.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key })), truncated: false };
		}
	} as unknown as R2Bucket & { files: Map<string, string> };
}

const today = new Date('2026-11-24T12:00:00Z');

describe('credit lines', () => {
	it('lists each role once per person, and leaves a writer out of the editors', () => {
		const line = creditLine(
			{
				history: [
					{ person: 'trevor', name: 'Trevor Goldsmith', role: 'wrote', words: 52, paragraphs: 3, wordsFrom: null, wordsTo: null, changedFrom: null, changedTo: null },
					{ person: 'ann', name: 'Ann Example', role: 'edited', words: 4, paragraphs: 2, wordsFrom: null, wordsTo: null, changedFrom: null, changedTo: null }
				]
			},
			[
				{ person: 'ben', name: 'Ben Example', role: 'researched' },
				{ person: 'trevor', name: 'Trevor Goldsmith', role: 'edited' }
			],
			[{ person: 'ann', name: 'Ann Example' }]
		);
		expect(line.map((credit) => [credit.role, credit.people.map((person) => person.name)])).toEqual([
			['wrote', ['Trevor Goldsmith']],
			['edited', ['Ann Example']],
			['researched', ['Ben Example']],
			['reviewed', ['Ann Example']]
		]);
	});

	it('takes who finished reviewing a section from its requests only', () => {
		const reviewers = (done: string | null) => [{ personIdentifier: 'ann', personName: 'Ann', doneAt: done }];
		expect(
			finishedReviewers(
				[
					{ sectionSlug: 'allotment', reviewers: reviewers('2026-11-23T00:00:00Z') },
					{ sectionSlug: 'treaties', reviewers: reviewers('2026-11-23T00:00:00Z') },
					{ sectionSlug: 'allotment', reviewers: [{ personIdentifier: 'ben', personName: 'Ben', doneAt: null }] }
				],
				'allotment'
			)
		).toEqual([{ person: 'ann', name: 'Ann' }]);
	});

	it('keeps the newest row per section, person and role', () => {
		const row = (person: string, action: 'add' | 'remove', addedAt: string) => ({ sectionSlug: 'allotment', person, role: 'researched' as const, action, addedAt });
		expect(standingHandCredits([row('ben', 'add', '1'), row('ben', 'remove', '2'), row('cal', 'add', '1'), row('ann', 'remove', '1'), row('ann', 'add', '3')]).map((credit) => credit.person)).toEqual([
			'cal',
			'ann'
		]);
	});

	it('puts readers’ credit lines under the headings, escaped and linked', () => {
		const html = '<h2 id="allotment">Allotment</h2>\n<p>Land.</p>\n<h3 id="other">Other</h3>';
		expect(
			withReaderCredits(html, {
				allotment: [
					{ role: 'wrote', people: [{ name: 'Ada <Lovelace>', link: '/contributors/ada-lovelace' }] },
					{ role: 'researched', people: [{ name: 'Ben', link: null }, { name: 'Cal', link: null }, { name: 'Dee', link: null }] }
				]
			})
		).toBe(
			'<h2 id="allotment">Allotment</h2>\n<p class="essay-section-credit">Written by <a href="/contributors/ada-lovelace">Ada &lt;Lovelace&gt;</a>. Researched by Ben, Cal, and Dee.</p>\n<p>Land.</p>\n<h3 id="other">Other</h3>'
		);
		expect(joinNames(['Ann', 'Ben'])).toBe('Ann and Ben');
	});

	it('writes dates and ranges in the style guide’s short form, in Pacific time', () => {
		expect(essayShortDate('2026-11-23T20:00:00Z', today)).toBe('Nov. 23');
		expect(essayShortDate('2025-11-23T20:00:00Z', today)).toBe('Nov. 23, 2025');
		expect(essayDateRange('2026-11-18T20:00:00Z', '2026-11-24T20:00:00Z', today)).toBe('Nov. 18 to 24');
		expect(essayDateRange('2026-11-30T20:00:00Z', '2026-12-02T20:00:00Z', today)).toBe('Nov. 30 to Dec. 2');
		expect(essayDateRange('2026-11-23T20:00:00Z', '2026-11-23T22:00:00Z', today)).toBe('Nov. 23');
		expect(essayDateRange('2025-12-30T20:00:00Z', '2026-01-02T20:00:00Z', today)).toBe('Dec. 30, 2025 to Jan. 2, 2026');
	});
});

describe('credits from the edit history and by hand', () => {
	let database: D1Database;
	let bucket: ReturnType<typeof memoryBucket>;
	const text = (cases: string, allotment: string) => `---\ntitle: Legal history\n---\n\n# Legal history\n\n## Treaties\n\nTreaties came first.\n\n### The Cherokee Cases\n\n${cases}\n\n## Allotment\n\n${allotment}\n`;

	beforeEach(async () => {
		database = testDatabase();
		bucket = memoryBucket();
		for (const [identifier, name, role] of [
			['trevor', 'Trevor Goldsmith', 'lead-author'],
			['ann', 'Ann Example', 'co-author'],
			['ben', 'Ben Example', 'contributor'],
			['cal', 'Cal Example', 'advisor']
		]) {
			await database
				.prepare("INSERT INTO people (identifier, email, display_name, role, status, added_at) VALUES (?, ?, ?, ?, 'active', '2026-11-22T00:00:00Z')")
				.bind(identifier, `${identifier}@example.org`, name, role)
				.run();
		}
		await saveVersion(database, bucket, { identifier: 'i-timeline', text: text('The Court decided two cases about the Cherokee Nation and the State of Georgia.', 'Land was divided.'), basedOn: null, personIdentifier: null, origin: 'git' });
		await saveVersion(database, bucket, {
			identifier: 'i-timeline',
			text: text('The Supreme Court decided two cases about the Cherokee Nation and the State of Georgia in 1831 and 1832.', 'Land was divided.'),
			basedOn: 1,
			personIdentifier: 'ann',
			origin: 'editor'
		});
	});

	it('credits text with no person to the lead author, and new words to who saved them', async () => {
		const sections = await sectionCredits(database, bucket, 'i-timeline', 2);
		expect(sections.map((section) => section.slug)).toEqual(['treaties', 'the-cherokee-cases', 'allotment']);
		const cases = sections[1];
		expect(cases.total).toBe(22);
		expect(cases.history.map((credit) => [credit.person, credit.name, credit.role, credit.words, credit.paragraphs])).toEqual([
			['trevor', 'Trevor Goldsmith', 'wrote', 17, 2],
			['ann', 'Ann Example', 'edited', 5, 1]
		]);
		expect([...bucket.files.keys()].filter((key) => key.includes('/blame/'))).toEqual(['essays/i-timeline/blame/2/2.json']);
		// Worked out again from what was kept, the same.
		expect(await sectionCredits(database, bucket, 'i-timeline', 2)).toEqual(sections);
	});

	it('adds a credit by hand and takes it away with a new row', async () => {
		await changeHandCredit(database, { essay: 'i-timeline', slug: 'allotment', title: 'Allotment', person: 'ben', role: 'researched', action: 'add', by: 'trevor' });
		expect((await handCredits(database, 'i-timeline')).map((credit) => [credit.sectionSlug, credit.name, credit.role, credit.addedByName])).toEqual([
			['allotment', 'Ben Example', 'researched', 'Trevor Goldsmith']
		]);
		await changeHandCredit(database, { essay: 'i-timeline', slug: 'allotment', title: 'Allotment', person: 'ben', role: 'researched', action: 'remove', by: 'trevor' });
		expect(await handCredits(database, 'i-timeline')).toEqual([]);
		await expect(database.prepare('DELETE FROM essay_section_credits').run()).rejects.toThrow(/cannot be deleted/);
	});

	it('names for readers only people who chose to be credited on the website, never advisors', async () => {
		const answers: ProfileAnswers = {
			...emptyAnswers,
			givenName: 'Ann',
			familyName: 'Example',
			birthYear: 1985,
			ageGroup: '18-or-older',
			interests: ['review'],
			placements: { ...emptyPlacements(), 'full-name': { book: true, website: true } }
		};
		for (const [subject, person] of [
			['account-ann', 'ann'],
			['account-cal', 'cal']
		]) {
			const account = { subject, email: `${person}@example.org`, name: person };
			await saveAnswers(database, account, answers);
			await confirmProfile(database, (await profileBySubject(database, subject))!);
			await database.prepare('UPDATE contributor_profiles SET person_identifier = ? WHERE sign_in_subject = ?').bind(person, subject).run();
		}
		const names = await readerNames(database, ['trevor', 'ann', 'cal']);
		expect([...names]).toEqual([['ann', { name: 'Ann Example', link: '/contributors/ann-example' }]]);
	});
});
