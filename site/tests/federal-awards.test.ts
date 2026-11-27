import { describe, expect, it } from 'vitest';
import { agencyName, agencyRows, dollars, nationAwards } from '../src/lib/server/federal-awards.ts';

// Federal awards in Key facts (Trevor chose mockup A on Nov. 27, 2026; src/lib/server/federal-awards.ts).
describe('Federal awards to a nation’s government', () => {
	it('says amounts as the approved mockup does', () => {
		expect(dollars(13768286)).toBe('$13.8 million');
		expect(dollars(907328799)).toBe('$907.3 million');
		expect(dollars(455099)).toBe('$455,099');
		expect(dollars(-216899)).toBe('−$216,899');
		expect(dollars(1.25e9)).toBe('$1.3 billion');
	});

	it('names an agency without "Department of"', () => {
		expect(agencyName('Department of the Interior')).toBe('Interior');
		expect(agencyName('Department of Health and Human Services')).toBe('Health and Human Services');
		expect(agencyName('Environmental Protection Agency')).toBe('Environmental Protection Agency');
	});

	it('shows five agencies, then the rest in one row that keeps the sum', () => {
		const agencies = [600, 150, 60, 55, 18, 10, 7, 5, 0, -4].map((amount, index) => ({ agency: `Agency ${index}`, amount: amount * 1e6 }));
		const rows = agencyRows(agencies);
		expect(rows).toHaveLength(6);
		// The agency that nets to nothing is not counted among the others.
		expect(rows[5]).toEqual({ label: '4 other agencies', text: '$18.0 million' });
	});

	it('shows a sixth agency by name rather than "1 other agencies"', () => {
		const agencies = [6, 5, 4, 3, 2, 1].map((amount, index) => ({ agency: `Agency ${index}`, amount: amount * 1e6 }));
		expect(agencyRows(agencies).map((row) => row.label)).toEqual(['Agency 0', 'Agency 1', 'Agency 2', 'Agency 3', 'Agency 4', 'Agency 5']);
	});

	it('adds every agency into the nation’s total', () => {
		for (const awards of nationAwards().values()) {
			const sum = awards.agencies.reduce((total, item) => total + item.amount, 0);
			expect(Math.abs(sum - awards.total)).toBeLessThan(1);
		}
	});
});
