/**
 * Dates on Recent changes and page histories, in the style guide's form and
 * in Pacific time, where the project is, as essay versions are dated
 * (src/lib/essays/dates.ts).
 */
import { essayDate, essayDateTime } from './essays/dates.ts';

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function pacific(moment: string): Record<string, string> {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: 'America/Los_Angeles',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: 'numeric',
		minute: '2-digit',
		hour12: true
	}).formatToParts(new Date(moment));
	return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

/** The day a moment falls on in Pacific time, as YYYY-MM-DD, for grouping changes by day. */
export function pacificDay(moment: string): string {
	const parts = pacific(moment);
	return `${parts.year}-${parts.month}-${parts.day}`;
}

/** "Sunday, Nov. 23, 2026", for a day from pacificDay. */
export function dayHeading(day: string): string {
	const [year, month, date] = day.split('-').map(Number);
	const weekday = weekdays[new Date(Date.UTC(year, month - 1, date)).getUTCDay()];
	return `${weekday}, ${essayDate(`${day}T20:00:00Z`)}`;
}

/** "6:41 p.m." */
export function timeOfDay(moment: string): string {
	const parts = pacific(moment);
	const period = parts.dayPeriod?.toLowerCase().startsWith('p') ? 'p.m.' : 'a.m.';
	return `${parts.hour}:${parts.minute} ${period}`;
}

/** "Nov. 23, 2026, 6:41 p.m. PT" */
export const dateTime = essayDateTime;
