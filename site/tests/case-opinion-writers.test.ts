import { describe, expect, it } from 'vitest';
import { sources } from '#lib/server/content.ts';
import { decidedDay, justiceLinkFor } from '#lib/server/supreme-court-people.ts';

interface Bench {
	opinions?: { list: { kind: string; justice: string }[] };
	supreme_court?: { justices?: { name: string; opinion?: string }[] };
}

// Every Justice a Supreme Court case record names, as the case page shows them:
// the writers in its Opinions list and the whole bench in Key facts.
const named: { key: string; name: string; decided?: string; writer: boolean }[] = [];
for (const record of sources().values()) {
	const { opinions, supreme_court: bench } = record as typeof record & Bench;
	if (!bench) continue;
	const decided = decidedDay(record.citation.issued);
	for (const opinion of opinions?.list ?? []) if (opinion.kind !== 'per curiam') named.push({ key: record.key, name: opinion.justice, decided, writer: true });
	for (const justice of bench.justices ?? []) named.push({ key: record.key, name: justice.name, decided, writer: Boolean(justice.opinion) && !opinions?.list?.length });
}

describe('the Justices named on Supreme Court case pages', () => {
	it('links every opinion writer to the Justice page', () => {
		const writers = named.filter((entry) => entry.writer);
		const unlinked = writers.filter((entry) => !justiceLinkFor(entry.name, entry.decided, entry.key)).map((entry) => `${entry.key}: ${entry.name}`);
		expect(writers.length).toBeGreaterThan(500);
		expect(unlinked).toEqual([]);
	});

	it('links every Justice on the bench, writers and those who joined', () => {
		const unlinked = named.filter((entry) => !justiceLinkFor(entry.name, entry.decided, entry.key)).map((entry) => `${entry.key}: ${entry.name}`);
		expect(unlinked).toEqual([]);
	});

	it('links John Marshall in Johnson v. M\'Intosh', () => {
		expect(justiceLinkFor('John Marshall', '1823-03-10', 'johnson-v-mintosh')).toBe('/supreme-court/justices/john-marshall');
	});
});
