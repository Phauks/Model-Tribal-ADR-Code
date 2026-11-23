import { describe, expect, it } from 'vitest';
import { recognitionBadge, recognitionBadges } from '../src/lib/recognition-badges.ts';

describe('recognitionBadges', () => {
	it('gives federal and state badges, federal first, with the state named', () => {
		expect(
			recognitionBadges([
				{ type: 'state', state: 'MA' },
				{ type: 'federal' }
			]).map((badge) => badge.label)
		).toEqual(['Federal', 'State: Massachusetts']);
	});

	it('shows nothing for no federal recognition', () => {
		expect(recognitionBadge('unrecognized')).toBeUndefined();
		expect(recognitionBadges([{ type: 'unrecognized' }])).toEqual([]);
		expect(recognitionBadges([{ type: 'unrecognized' }, { type: 'state', state: 'SC' }])).toEqual([
			{ kind: 'state', label: 'State: South Carolina', fullLabel: 'State recognized (South Carolina)' }
		]);
	});

	it('keeps the full wording for tooltips and screen readers', () => {
		expect(recognitionBadge('federal')?.fullLabel).toBe('Federally recognized');
		expect(recognitionBadge('petitioning')).toEqual({
			kind: 'petitioning',
			label: 'Petitioning',
			fullLabel: 'Petitioning for federal acknowledgment'
		});
	});

	it('shows each status once, and each state in alphabetical order', () => {
		expect(
			recognitionBadges([
				{ type: 'state', state: 'VA' },
				{ type: 'state', state: 'MD' },
				{ type: 'state', state: 'VA' },
				{ type: 'petitioning' }
			]).map((badge) => badge.label)
		).toEqual(['Petitioning', 'State: Maryland', 'State: Virginia']);
	});
});
