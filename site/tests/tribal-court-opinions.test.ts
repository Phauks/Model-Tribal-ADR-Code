import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { publicCopies, redactedOpinionKeys, repositoryRoot } from '#lib/server/content.ts';
import { nationsWithOpinions, opinionsOf, tribalCourtOpinions } from '#lib/server/tribal-court-opinions.ts';

describe('tribal court opinions (decision record 0047)', () => {
	const opinions = tribalCourtOpinions();
	const served = new Set(publicCopies().map((copy) => copy.key));

	it('lists only opinions whose page the site serves, each with a removal link', () => {
		for (const opinion of opinions) {
			expect(served.has(opinion.key)).toBe(true);
			// Each opens as a page inside the site, with its masthead and sidebar (copyPagePath).
			expect(opinion.path).toBe(`/copies/view/${opinion.key}`);
			expect(opinion.removal).toContain('#request=remove');
			expect(opinion.nations.length).toBeGreaterThan(0);
		}
	});

	it('lists them newest first', () => {
		const dates = opinions.map((opinion) => opinion.decided);
		expect(dates).toEqual([...dates].sort().reverse());
	});

	it('gives each nation only its own opinions', () => {
		for (const nation of nationsWithOpinions()) {
			const own = opinionsOf(nation);
			expect(own.length).toBeGreaterThan(0);
			expect(own.every((opinion) => opinion.nations.includes(nation))).toBe(true);
		}
	});

	it('serves no opinion that a removal or hold in the capture index overrides takes down', () => {
		const overrides: Record<string, { redistribution?: string }> = JSON.parse(
			readFileSync(path.join(repositoryRoot, 'research/capture-index-overrides.json'), 'utf8')
		);
		const held = Object.entries(overrides)
			.filter(([key, override]) => key.startsWith('caselaw-access-project/') && override.redistribution === 'no')
			.map(([key]) => key);
		// Holds come and go (the privacy holds were lifted once each opinion was redacted).
		const listed = new Set(opinions.map((opinion) => opinion.key));
		for (const key of held) {
			expect(served.has(key)).toBe(false);
			expect(listed.has(key)).toBe(false);
		}
	});

	it('never links a redacted opinion to its original, which still has the names in it', () => {
		const redacted = redactedOpinionKeys();
		const copies = publicCopies().filter((copy) => redacted.has(copy.key));
		expect(copies.length).toBe(redacted.size);
		for (const copy of copies) {
			expect(copy.namesReplaced).toBe(true);
			expect(copy.links).toEqual([]);
		}
		for (const opinion of opinions.filter((item) => redacted.has(item.key))) {
			expect(opinion.namesReplaced).toBe(true);
		}
	});
});
