import { describe, expect, it } from 'vitest';
import { proportion, sumMargin, surveyFigures, surveyRows } from '../src/lib/server/census-areas.ts';

// Census figures in Key facts (Trevor, Nov. 27, 2026; src/lib/server/census-areas.ts).
describe('Census figures for a land area', () => {
	it('gives a derived proportion the margin of the Bureau’s formula', () => {
		// Acoma: 3,464 ± 651 of 3,605 ± 649 are American Indian or Alaska Native.
		const share = proportion({ value: 3464, margin: 651 }, { value: 3605, margin: 649 })!;
		expect(share.value).toBeCloseTo(96.09, 1);
		expect(share.margin).toBeCloseTo(5.17, 1);
	});

	it('uses the ratio formula when the value under the root would be negative', () => {
		const share = proportion({ value: 90, margin: 10 }, { value: 100, margin: 40 })!;
		expect(share.margin).toBeCloseTo((100 * Math.sqrt(10 ** 2 + 0.9 ** 2 * 40 ** 2)) / 100, 5);
	});

	it('has no proportion of an area where nobody lives', () => {
		expect(proportion({ value: 0, margin: 13 }, { value: 0, margin: 13 })).toBeUndefined();
	});

	it('adds margins as the square root of the sum of their squares', () => {
		expect(sumMargin([3, 4])).toBe(5);
	});

	it('shows Acoma’s eight figures as the approved mockup does', () => {
		const figures = surveyFigures(surveyRows().get('0010')!);
		expect(figures.map((figure) => [figure.label, figure.text, figure.margin])).toEqual([
			['American Indian or Alaska Native', '96%', '5'],
			['Median age', '38.0', '4.9'],
			['Median household income', '$49,286', '$17,384'],
			['Below the poverty level', '17.7%', '9.7'],
			['Unemployed', '3.2%', '3.0'],
			['Bachelor’s degree or more', '9.1%', '5.3'],
			['Households with broadband', '66.1%', '16.4']
		]);
	});
});
