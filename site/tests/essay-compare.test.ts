import { describe, expect, it } from 'vitest';
import { compareTexts } from '#lib/essays/compare.ts';

describe('comparing essay versions', () => {
	it('shows paragraphs added, removed and changed word by word', () => {
		const before = 'First paragraph.\n\nSecond one here.\n\nThird.\n';
		const after = 'First paragraph.\n\nSecond one there.\n\nNew one.\n';
		expect(compareTexts(before, after)).toEqual([
			{ kind: 'same', text: 'First paragraph.' },
			{
				kind: 'changed',
				pieces: [
					{ kind: 'same', text: 'Second one ' },
					{ kind: 'removed', text: 'here.' },
					{ kind: 'added', text: 'there.' }
				]
			},
			{ kind: 'changed', pieces: [{ kind: 'removed', text: 'Third.' }, { kind: 'added', text: 'New one.' }] }
		]);
	});

	it('finds nothing between equal texts', () => {
		expect(compareTexts('A.\n\nB.', 'A.\n\nB.\n').every((change) => change.kind === 'same')).toBe(true);
	});
});
