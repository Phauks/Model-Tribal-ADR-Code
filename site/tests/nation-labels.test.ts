import { describe, expect, it } from 'vitest';
import { presenceNote } from '#lib/nation-labels.ts';

describe('what sources record in each state', () => {
	const states = ['Arizona', 'New Mexico', 'Utah'];

	it('reads as the approved nation page has it, land first', () => {
		expect(
			presenceNote(
				[
					['government office', ['Arizona']],
					['land', states]
				],
				states
			)
		).toBe('Land in all three; government office in Arizona');
	});

	it('joins kinds recorded in the same states', () => {
		expect(
			presenceNote(
				[
					['land', ['California']],
					['government office', ['California']]
				],
				['California']
			)
		).toBe('Land and government office in California');
		expect(presenceNote([['land', ['Idaho', 'Oregon']]], ['Idaho', 'Oregon'])).toBe('Land in both');
		expect(presenceNote([['census area', ['Alaska', 'Hawaii', 'Utah']]], ['Alaska', 'Hawaii', 'Utah', 'Texas'])).toBe(
			'Census area in Alaska, Hawaii and Utah'
		);
		expect(presenceNote([], states)).toBeUndefined();
	});
});
