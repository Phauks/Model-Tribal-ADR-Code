import { describe, expect, it } from 'vitest';
import { opinionTextsOf } from '#lib/server/case-opinion-texts.ts';
import { publicCopies, sources } from '#lib/server/content.ts';
import { decidedDay, justiceLinkFor } from '#lib/server/supreme-court-people.ts';

// The opinions a case page shows in full (research/case-opinions/opinions.csv,
// scripts/caselaw/case_opinion_texts.py), read from copies the site serves.
const served = new Set(publicCopies().map((copy) => copy.key));
const cases = [...sources().values()].filter((record) => (record.citation as { type?: string }).type === 'legal_case');

describe('the opinions shown in full on case pages', () => {
	it('come from copies the site serves, one copy for each case', () => {
		const withText = cases.map((record) => opinionTextsOf(record.key)).filter((list) => list.length > 0);
		expect(withText.length).toBeGreaterThan(3000);
		for (const list of withText) {
			expect(new Set(list.map((entry) => entry.copy)).size).toBe(1);
			expect(served.has(list[0].copy)).toBe(true);
			expect(list.map((entry) => entry.position)).toEqual(list.map((_, index) => index));
		}
	});

	it('names Worcester v. Georgia’s three opinions with their pages', () => {
		expect(opinionTextsOf('worcester-v-georgia').map((entry) => [entry.kind, entry.author, entry.firstPage, entry.lastPage])).toEqual([
			['majority', 'Marshall', 536, 563],
			['concurrence', 'McLean', 563, 596],
			['dissent', 'Baldwin', 596, 597]
		]);
	});

	it('links every Supreme Court writer it names to the Justice’s page', () => {
		const unlinked: string[] = [];
		for (const record of cases) {
			if (!(record as { supreme_court?: unknown }).supreme_court) continue;
			const decided = decidedDay(record.citation.issued);
			for (const entry of opinionTextsOf(record.key)) {
				if (entry.author && !justiceLinkFor(entry.author, decided, record.key)) unlinked.push(`${record.key}: ${entry.author}`);
			}
		}
		expect(unlinked).toEqual([]);
	});
});
