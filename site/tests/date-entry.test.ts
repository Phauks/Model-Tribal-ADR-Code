import { describe, expect, it } from 'vitest';
import {
	addMonths,
	boxDate,
	localToday,
	monthWeeks,
	readTypedDate,
	readTypedTime,
	spokenDate,
	spokenTime
} from '../src/lib/date-entry.ts';

// Monday, Nov. 23, 2026.
const today = '2026-11-23';

describe('readTypedDate', () => {
	it('reads ISO days and United States numbers, month first', () => {
		expect(readTypedDate('2026-12-01', today)).toBe('2026-12-01');
		expect(readTypedDate('12/1/2026', today)).toBe('2026-12-01');
		expect(readTypedDate('12-1-2026', today)).toBe('2026-12-01');
		expect(readTypedDate('12.1.2026', today)).toBe('2026-12-01');
		expect(readTypedDate('3/4', today)).toBe('2026-03-04');
	});

	it('reads two-digit years as this century unless that is more than 20 years ahead', () => {
		expect(readTypedDate('12/1/26', today)).toBe('2026-12-01');
		expect(readTypedDate('5/5/03', today)).toBe('2003-05-05');
		expect(readTypedDate('5/5/98', today)).toBe('1998-05-05');
	});

	it('reads month names, short or long, either side of the day', () => {
		expect(readTypedDate('dec 1', today)).toBe('2026-12-01');
		expect(readTypedDate('Dec. 1, 2026', today)).toBe('2026-12-01');
		expect(readTypedDate('December 1st 2027', today)).toBe('2027-12-01');
		expect(readTypedDate('Sept. 9, 2026', today)).toBe('2026-09-09');
		expect(readTypedDate('1 Dec 2026', today)).toBe('2026-12-01');
	});

	it("reads back the field's own forms", () => {
		expect(readTypedDate(boxDate('2026-06-15'), today)).toBe('2026-06-15');
		expect(readTypedDate(spokenDate('2026-06-15'), today)).toBe('2026-06-15');
		expect(readTypedDate('Mon., Nov. 30', today)).toBe('2026-11-30');
	});

	it('reads words for nearby days', () => {
		expect(readTypedDate('today', today)).toBe('2026-11-23');
		expect(readTypedDate('Tomorrow', today)).toBe('2026-11-24');
		expect(readTypedDate('yesterday', today)).toBe('2026-11-22');
		expect(readTypedDate('friday', today)).toBe('2026-11-27');
		// A weekday is the next one after today, so Monday on a Monday is a week away.
		expect(readTypedDate('Monday', today)).toBe('2026-11-30');
	});

	it('refuses days that do not exist and text that is not a date', () => {
		expect(readTypedDate('2/30/2026', today)).toBeNull();
		expect(readTypedDate('13/45', today)).toBeNull();
		expect(readTypedDate('2026-13-01', today)).toBeNull();
		expect(readTypedDate('soon', today)).toBeNull();
		expect(readTypedDate('', today)).toBeNull();
		expect(readTypedDate('2/29/2028', today)).toBe('2028-02-29');
	});
});

describe('readTypedTime', () => {
	it('reads clock times in common forms', () => {
		expect(readTypedTime('8')).toBe('08:00');
		expect(readTypedTime('8am')).toBe('08:00');
		expect(readTypedTime('8 a.m.')).toBe('08:00');
		expect(readTypedTime('8:30 pm')).toBe('20:30');
		expect(readTypedTime('12 AM')).toBe('00:00');
		expect(readTypedTime('12:15 PM')).toBe('12:15');
		expect(readTypedTime('20:30')).toBe('20:30');
		expect(readTypedTime('0830')).toBe('08:30');
		expect(readTypedTime('noon')).toBe('12:00');
		expect(readTypedTime('midnight')).toBe('00:00');
	});

	it('refuses times that do not exist', () => {
		expect(readTypedTime('25:00')).toBeNull();
		expect(readTypedTime('13 pm')).toBeNull();
		expect(readTypedTime('8:75')).toBeNull();
		expect(readTypedTime('later')).toBeNull();
	});
});

describe('writing dates and times', () => {
	it('writes the box and the line under it in the style guide form', () => {
		expect(boxDate('2026-12-01')).toBe('Dec. 1, 2026');
		expect(spokenDate('2026-12-01')).toBe('Tuesday, Dec. 1, 2026');
		expect(spokenTime('08:00')).toBe('8:00 AM');
		expect(spokenTime('20:30')).toBe('8:30 PM');
		expect(spokenTime('12:00')).toBe('noon');
	});

	it("takes today from the reader's own clock", () => {
		expect(localToday(new Date(2026, 10, 23, 23, 59))).toBe('2026-11-23');
	});
});

describe('calendar helpers', () => {
	it('keeps the day of the month, or the last day of a shorter month', () => {
		expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
		expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
		expect(addMonths('2026-01-15', -1)).toBe('2025-12-15');
	});

	it('lays a month out in weeks starting on Sunday', () => {
		const weeks = monthWeeks(2026, 12);
		expect(weeks[0]).toEqual(['2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05']);
		expect(weeks.at(-1)!.at(-1)).toBe('2027-01-02');
		expect(weeks).toHaveLength(5);
		expect(monthWeeks(2026, 11)).toHaveLength(5);
	});
});
