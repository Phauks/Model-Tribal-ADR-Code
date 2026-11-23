import { describe, expect, it } from 'vitest';
import { publicCopies } from '#lib/server/content.ts';
import { nationsWithOpinions, opinionsOf, tribalCourtOpinions } from '#lib/server/tribal-court-opinions.ts';

describe('tribal court opinions (decision record 0046)', () => {
	const opinions = tribalCourtOpinions();
	const served = new Set(publicCopies().map((copy) => `/copies/${copy.key}`));

	it('lists only opinions whose page the site serves, each with a removal link', () => {
		for (const opinion of opinions) {
			expect(served.has(opinion.path)).toBe(true);
			expect(opinion.removal).toContain('kind=remove');
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
});
