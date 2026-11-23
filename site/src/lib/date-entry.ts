/**
 * Reading dates and times that people type into the shared date field (`src/lib/components/DateField.svelte`, DESIGN.md section 6, "Date fields"), and writing them back in words.
 *
 * A date is kept as an ISO day, "2026-12-01", the value a browser's own date box sends, so forms and server code are unchanged. A time is "HH:MM" on a 24-hour clock, as a browser's own time box sends. Nothing here knows about time zones: a day is a day on the calendar, and the code that stores a time decides its zone.
 *
 * What a reader can type for a date: "2026-12-01", "12/1/2026", "12/1/26", "12/1", "12-1-2026", "12.1.2026", "Dec 1", "Dec. 1, 2026", "December 1 2026", "1 Dec 2026", "Tue., Dec. 1, 2026" (the field's own form, so it reads back), "today", "tomorrow", "yesterday" and a weekday such as "Friday", which means the next one after today. Numbers are month first, as in the United States; the line under the field says the date in words, so a reader who meant day first sees the mistake. A date without a year takes the year of today.
 *
 * What a reader can type for a time: "8", "8am", "8 a.m.", "8:30 pm", "20:30", "0830", "noon" and "midnight".
 */
import { readableDate } from './readable-date.ts';

export interface CalendarDay {
	year: number;
	/** 1 to 12. */
	month: number;
	day: number;
}

export const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const monthWords: Record<string, number> = {};
monthNames.forEach((name, index) => {
	const word = name.toLowerCase();
	monthWords[word] = index + 1;
	monthWords[word.slice(0, 3)] = index + 1;
});
monthWords.sept = 9;

const weekdayWords: Record<string, number> = {};
weekdayNames.forEach((name, index) => {
	const word = name.toLowerCase();
	weekdayWords[word] = index;
	weekdayWords[word.slice(0, 3)] = index;
});
Object.assign(weekdayWords, { tues: 2, weds: 3, thur: 4, thurs: 4 });

export function daysInMonth(year: number, month: number): number {
	return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isoDay({ year, month, day }: CalendarDay): string {
	return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** The calendar day of an ISO day, or null when it is not a real day. */
export function calendarDay(iso: string): CalendarDay | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
	if (!match) return null;
	return realDay(Number(match[1]), Number(match[2]), Number(match[3]));
}

function realDay(year: number, month: number, day: number): CalendarDay | null {
	if (!Number.isInteger(year) || year < 1 || year > 9999) return null;
	if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
	return { year, month, day };
}

/** The day a number of days after (or before, when negative) another. */
export function addDays(iso: string, days: number): string {
	const day = calendarDay(iso);
	if (!day) return iso;
	const moved = new Date(Date.UTC(day.year, day.month - 1, day.day + days));
	return moved.toISOString().slice(0, 10);
}

/** The same day of the month a number of months away, or the last day of that month when it is shorter. */
export function addMonths(iso: string, months: number): string {
	const day = calendarDay(iso);
	if (!day) return iso;
	const index = day.year * 12 + (day.month - 1) + months;
	const year = Math.floor(index / 12);
	const month = (index % 12) + 1;
	return isoDay({ year, month, day: Math.min(day.day, daysInMonth(year, month)) });
}

/** 0 for Sunday to 6 for Saturday. */
export function weekday(iso: string): number {
	const day = calendarDay(iso);
	return day ? new Date(Date.UTC(day.year, day.month - 1, day.day)).getUTCDay() : 0;
}

/** Today on the reader's own clock, as an ISO day. */
export function localToday(now: Date = new Date()): string {
	return isoDay({ year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() });
}

function twoDigitYear(year: number, today: CalendarDay): number {
	// "26" is 2026; a two-digit year more than 20 years ahead is taken as last century, so "98" is 1998.
	const century = Math.floor(today.year / 100) * 100;
	const guess = century + year;
	return guess > today.year + 20 ? guess - 100 : guess;
}

/**
 * Reads a typed date. Returns the ISO day, or null when the text is not a date this can read. Empty text returns null too; the field treats that as "no date".
 */
export function readTypedDate(text: string, today: string): string | null {
	const now = calendarDay(today);
	if (!now) return null;
	const words = text
		.trim()
		.toLowerCase()
		.replace(/(\d)(st|nd|rd|th)\b/g, '$1')
		.replace(/[.,]/g, (mark, offset, whole) => (mark === '.' && /\d\.\d/.test(whole.slice(offset - 1, offset + 2)) ? '/' : ' '))
		.replace(/\s+/g, ' ')
		.trim();
	if (!words) return null;

	if (words === 'today' || words === 'now') return today;
	if (words === 'tomorrow') return addDays(today, 1);
	if (words === 'yesterday') return addDays(today, -1);

	// A weekday alone: the next one after today. A weekday before a full date is dropped.
	const leadingWeekday = /^([a-z]+) (.+)$/.exec(words);
	if (words in weekdayWords) {
		const ahead = (weekdayWords[words] - weekday(today) + 7) % 7 || 7;
		return addDays(today, ahead);
	}
	if (leadingWeekday && leadingWeekday[1] in weekdayWords) return readTypedDate(leadingWeekday[2], today);

	let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(words);
	if (match) return dayOrNull(Number(match[1]), Number(match[2]), Number(match[3]));

	match = /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2}|\d{4}))?$/.exec(words);
	if (match) return dayOrNull(yearOf(match[3], now), Number(match[1]), Number(match[2]));

	// "Dec 1", "December 1 2026"
	match = /^([a-z]+) (\d{1,2})(?: (\d{2}|\d{4}))?$/.exec(words);
	if (match && match[1] in monthWords) return dayOrNull(yearOf(match[3], now), monthWords[match[1]], Number(match[2]));

	// "1 Dec 2026"
	match = /^(\d{1,2}) ([a-z]+)(?: (\d{2}|\d{4}))?$/.exec(words);
	if (match && match[2] in monthWords) return dayOrNull(yearOf(match[3], now), monthWords[match[2]], Number(match[1]));

	return null;
}

function yearOf(text: string | undefined, today: CalendarDay): number {
	if (!text) return today.year;
	const year = Number(text);
	return text.length === 2 ? twoDigitYear(year, today) : year;
}

function dayOrNull(year: number, month: number, day: number): string | null {
	const found = realDay(year, month, day);
	return found ? isoDay(found) : null;
}

/** Reads a typed time. Returns "HH:MM" on a 24-hour clock, or null. */
export function readTypedTime(text: string): string | null {
	const words = text.trim().toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ');
	if (!words) return null;
	if (words === 'noon' || words === 'midday') return '12:00';
	if (words === 'midnight') return '00:00';
	const match = /^(\d{1,2})(?::?(\d{2}))? ?(am|pm|a|p)?$/.exec(words);
	if (!match) return null;
	let hour = Number(match[1]);
	const minute = match[2] ? Number(match[2]) : 0;
	const half = match[3]?.[0];
	if (minute > 59) return null;
	if (half) {
		if (hour < 1 || hour > 12) return null;
		hour = (hour % 12) + (half === 'p' ? 12 : 0);
	} else if (hour > 23) {
		return null;
	}
	return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** "Dec. 1, 2026": what the field shows in its box once a date is read. */
export function boxDate(iso: string): string {
	return readableDate(iso);
}

/** "Tuesday, Dec. 1, 2026": the line under the field. */
export function spokenDate(iso: string): string {
	return calendarDay(iso) ? `${weekdayNames[weekday(iso)]}, ${readableDate(iso)}` : iso;
}

/** "8:00 AM", "12:30 PM". */
export function spokenTime(time: string): string {
	const match = /^(\d{2}):(\d{2})$/.exec(time);
	if (!match) return time;
	const hour = Number(match[1]);
	if (hour === 12 && match[2] === '00') return 'noon';
	if (hour === 0 && match[2] === '00') return 'midnight';
	return `${hour % 12 || 12}:${match[2]} ${hour < 12 ? 'AM' : 'PM'}`;
}

/** The weeks of a month for a calendar grid, Sunday first, each day an ISO day. Days of the months around it fill the first and last weeks. */
export function monthWeeks(year: number, month: number): string[][] {
	const first = isoDay({ year, month, day: 1 });
	let day = addDays(first, -weekday(first));
	const weeks: string[][] = [];
	do {
		const week: string[] = [];
		for (let index = 0; index < 7; index += 1) {
			week.push(day);
			day = addDays(day, 1);
		}
		weeks.push(week);
	} while (calendarDay(day)!.month === month);
	return weeks;
}
