import { describe, expect, it } from 'vitest';
import { coverageRows, coverageSections, hasConstitution, hasPublishedLaws, sectionsFound } from '#lib/server/coverage.ts';
import { nations, type NationRecord } from '#lib/server/content.ts';

const bare = { id: 'sample', governing_documents: [] } as unknown as NationRecord;

describe('Coverage', () => {
	it('lists every nation page once, without the sample nation or withdrawn pages', () => {
		const rows = coverageRows();
		const shown = nations().filter((record) => record.example !== true && record.review?.status !== 'withdrawn-at-request');
		expect(rows).toHaveLength(shown.length);
		expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
		// The first call reads every record (about 49,000 by Nov. 27, 2026), which took more than 60 seconds on a CI runner.
	}, 180_000);

	it('counts a row’s gaps as the sections with nothing on record', () => {
		for (const row of coverageRows().slice(0, 50)) {
			expect(row.gaps).toBe(coverageSections.filter((section) => !row.found[section.key]).length);
		}
	});

	it('finds a constitution listed among the documents or with a history of its own', () => {
		expect(hasConstitution(bare, [])).toBe(false);
		expect(hasConstitution({ ...bare, governing_documents: [{ kind: 'articles-of-association' }] } as unknown as NationRecord, [])).toBe(true);
		expect(hasConstitution(bare, ['Constitution'])).toBe(true);
		expect(hasConstitution({ ...bare, governing_documents: [{ kind: 'corporate-charter' }] } as unknown as NationRecord, [])).toBe(false);
	});

	it('finds published laws in a law code, court rules or dispute resolution law', () => {
		expect(hasPublishedLaws(bare)).toBe(false);
		expect(hasPublishedLaws({ ...bare, governing_documents: [{ kind: 'law-code' }] } as unknown as NationRecord)).toBe(true);
		expect(hasPublishedLaws({ ...bare, dispute_resolution_law: ['some-source'] } as unknown as NationRecord)).toBe(true);
	});

	it('finds the Navajo Nation’s government, courts and laws', () => {
		const navajo = nations().find((record) => record.id === 'navajo-nation')!;
		const found = sectionsFound(navajo);
		expect(found.government && found.courts && found.laws && found.jurisdiction).toBe(true);
	});
});
