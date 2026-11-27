import { describe, expect, it } from 'vitest';
import { branchLines } from '#lib/governance-branches.ts';

describe('branchLines', () => {
	it('puts each branch of a plain list on its own line', () => {
		expect(branchLines('Legislative, executive and judicial')).toEqual([{ text: 'Legislative' }, { text: 'Executive' }, { text: 'Judicial' }]);
		expect(branchLines('Legislative/Executive and Judicial').map((line) => line.text)).toEqual(['Legislative', 'Executive', 'Judicial']);
		expect(branchLines('Executive and judicial branches').map((line) => line.text)).toEqual(['Executive', 'Judicial']);
	});

	it('names each body with the powers it holds under it', () => {
		expect(branchLines('Tribal Council (executive and legislative), Tribal Judiciary (judicial)')).toEqual([
			{ text: 'Tribal Council', powers: 'Executive and legislative' },
			{ text: 'Tribal Judiciary', powers: 'Judicial' }
		]);
		expect(branchLines('Legislative (Council), judicial (Pueblo Court), executive (Governor)')).toEqual([
			{ text: 'Council', powers: 'Legislative' },
			{ text: 'Pueblo Court', powers: 'Judicial' },
			{ text: 'Governor', powers: 'Executive' }
		]);
	});

	it('keeps words that are not a plain list as one line', () => {
		for (const value of ['Judicial branch, separate from the Council and Chairman', 'Council legislative and judicial; Governor executive', '3 branches', 'Judicial branch']) {
			expect(branchLines(value)).toEqual([{ text: value }]);
		}
	});
});
