import { describe, expect, it } from 'vitest';
import {
	defaultMonthlyCents,
	freeBenefits,
	includes,
	levelAmountsProblem,
	levelFor,
	sponsorBenefits,
	yearlyCents,
	type Column
} from '#lib/sponsorship-levels.ts';

describe('sponsorship levels', () => {
	it('prices a year at ten months', () => {
		expect(yearlyCents(500)).toBe(5000);
		expect(yearlyCents(50000)).toBe(500000);
	});

	it('finds the highest level a gift reaches', () => {
		expect(levelFor(defaultMonthlyCents, 400, 'monthly')).toBeNull();
		expect(levelFor(defaultMonthlyCents, 500, 'monthly')).toBe('friend');
		expect(levelFor(defaultMonthlyCents, 9999, 'monthly')).toBe('supporter');
		expect(levelFor(defaultMonthlyCents, 50000, 'monthly')).toBe('benefactor');
		// A yearly gift counts by its amount over ten months.
		expect(levelFor(defaultMonthlyCents, 25000, 'yearly')).toBe('supporter');
		expect(levelFor(defaultMonthlyCents, 4999, 'yearly')).toBeNull();
	});

	it('asks each level to cost more than the one before it', () => {
		expect(levelAmountsProblem(defaultMonthlyCents)).toBeNull();
		expect(levelAmountsProblem({ ...defaultMonthlyCents, patron: 2500 })).toBe('Patron must cost more a month than Supporter.');
	});

	it('gives every level what the levels before it give', () => {
		for (const benefit of freeBenefits) expect(includes(benefit, 'free')).toBe(true);
		const books = sponsorBenefits.find((benefit) => benefit.text === 'A paperback of each new edition');
		expect(books && (['free', 'friend', 'supporter', 'patron', 'benefactor'] as Column[]).map((column) => includes(books, column))).toEqual([
			false,
			false,
			false,
			true,
			true
		]);
	});
});
