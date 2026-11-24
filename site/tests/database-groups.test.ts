import { describe, expect, it } from 'vitest';
import { inGroupsOf, placeholdersFor } from '#lib/server/database-groups.ts';

describe('inGroupsOf', () => {
	it('splits a list into groups of the size, in order, with the rest last', () => {
		const items = Array.from({ length: 205 }, (_, index) => index);
		const groups = inGroupsOf(items, 90);
		expect(groups.map((group) => group.length)).toEqual([90, 90, 25]);
		expect(groups.flat()).toEqual(items);
	});

	it('gives one group for a short list and none for an empty one', () => {
		expect(inGroupsOf(['a', 'b'], 50)).toEqual([['a', 'b']]);
		expect(inGroupsOf([], 50)).toEqual([]);
	});

	it('gives exact groups when the size divides the list', () => {
		expect(inGroupsOf([1, 2, 3, 4], 2)).toEqual([
			[1, 2],
			[3, 4]
		]);
	});
});

describe('placeholdersFor', () => {
	it('writes one placeholder for each value', () => {
		expect(placeholdersFor(['a', 'b', 'c'])).toBe('?, ?, ?');
		expect(placeholdersFor(['a'])).toBe('?');
		expect(placeholdersFor([])).toBe('');
	});
});
