import { describe, expect, it } from 'vitest';
import { readableDate } from '../src/lib/readable-date.ts';

describe('readableDate', () => {
	it('writes a full date as the style guide does', () => {
		expect(readableDate('2026-11-21')).toBe('Nov. 21, 2026');
		expect(readableDate('2003-05-05')).toBe('May 5, 2003');
	});

	it('writes a month and year without a day', () => {
		expect(readableDate('2026-11')).toBe('Nov. 2026');
	});

	it('leaves other text as it is', () => {
		expect(readableDate('2020')).toBe('2020');
		expect(readableDate('about 1990')).toBe('about 1990');
	});
});
