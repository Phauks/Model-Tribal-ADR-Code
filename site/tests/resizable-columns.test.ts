import { describe, expect, it } from 'vitest';
import { shareWidth } from '../src/lib/tables/resizable-columns.ts';

const total = (widths: number[]) => widths.reduce((sum, width) => sum + width, 0);

// Trevor, Nov. 24, 2026: "if you expand the table, it should always keep the end of the table locked, so you cannot go over the side".
describe('shareWidth keeps the end of the table where it is', () => {
	it('takes a widened column’s width from the next column first', () => {
		expect(shareWidth([10, 10, 10], 0, 14)).toEqual([14, 6, 10]);
	});

	it('takes from the columns after it, then before it, down to each floor', () => {
		const next = shareWidth([10, 10, 10, 10], 2, 30, 80, [8, 8, 8, 8]);
		expect(next).toEqual([8, 8, 16, 8]);
		expect(total(next)).toBe(40);
	});

	it('stops growing once the others are down to their floors', () => {
		const next = shareWidth([10, 10], 0, 50, 80, [0, 7]);
		expect(next).toEqual([13, 7]);
	});

	it('never takes a column below the narrowest a column can be', () => {
		expect(shareWidth([10, 10], 0, 50)).toEqual([17, 3]);
	});

	it('gives a narrowed column’s width to the next one, or the one before for the last', () => {
		expect(shareWidth([10, 10, 10], 1, 6)).toEqual([10, 6, 14]);
		expect(shareWidth([10, 10, 10], 2, 6)).toEqual([10, 14, 6]);
	});

	it('changes nothing when no other column can give', () => {
		const widths = [12, 9];
		expect(shareWidth(widths, 0, 20, 80, [0, 9])).toEqual(widths);
	});
});
