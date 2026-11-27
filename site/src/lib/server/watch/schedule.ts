/**
 * Watchers' schedules: five-field cron expressions in UTC (minute, hour, day
 * of month, month, day of week), the same form as Cloudflare's cron triggers.
 * The watch Worker's own trigger runs every minute and starts each watcher
 * whose schedule matches that minute.
 *
 * Each field is "*", a number, a range "a-b", a list "a,b", or a step "*\/n"
 * or "a-b/n". Day of week runs 0 (Sunday) to 6; 7 is also Sunday. As in cron,
 * when both day fields are restricted, either may match.
 */

const ranges: [number, number][] = [
	[0, 59],
	[0, 23],
	[1, 31],
	[1, 12],
	[0, 7]
];

function field(text: string, [low, high]: [number, number]): Set<number> | null {
	const values = new Set<number>();
	for (const part of text.split(',')) {
		const match = /^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/.exec(part);
		if (!match) return null;
		const [, span, stepText] = match;
		const step = stepText ? Number(stepText) : 1;
		if (step < 1) return null;
		let from = low;
		let to = high;
		if (span !== '*') {
			const [first, last] = span.split('-').map(Number);
			from = first;
			to = last ?? (stepText ? high : first);
		}
		if (from < low || to > high || from > to) return null;
		for (let value = from; value <= to; value += step) values.add(value);
	}
	return values;
}

export interface Schedule {
	matches(date: Date): boolean;
}

/** Reads a schedule, or answers why it cannot. */
export function readSchedule(expression: string): Schedule | { problem: string } {
	const parts = expression.trim().split(/\s+/);
	if (parts.length !== 5) return { problem: `"${expression}" needs five fields (minute hour day month weekday)` };
	const sets = parts.map((part, index) => field(part, ranges[index]));
	if (sets.some((set) => set === null)) return { problem: `"${expression}" has a field that cannot be read` };
	const [minutes, hours, days, months, weekdays] = sets as Set<number>[];
	if (weekdays.has(7)) weekdays.add(0);
	const dayRestricted = parts[2] !== '*';
	const weekdayRestricted = parts[4] !== '*';
	return {
		matches(date: Date) {
			if (!minutes.has(date.getUTCMinutes()) || !hours.has(date.getUTCHours()) || !months.has(date.getUTCMonth() + 1)) return false;
			const dayMatches = days.has(date.getUTCDate());
			const weekdayMatches = weekdays.has(date.getUTCDay());
			if (dayRestricted && weekdayRestricted) return dayMatches || weekdayMatches;
			return dayMatches && weekdayMatches;
		}
	};
}

/** Whether a schedule is due in the minute of `date`. A schedule that cannot be read is never due. */
export function isDue(expression: string, date: Date): boolean {
	const schedule = readSchedule(expression);
	return 'matches' in schedule && schedule.matches(date);
}

/** The next minute at or after `from` when a schedule is due, looking up to `withinDays` ahead, or null. */
export function nextDue(expression: string, from: Date, withinDays = 8): Date | null {
	const schedule = readSchedule(expression);
	if (!('matches' in schedule)) return null;
	const start = new Date(from);
	start.setUTCSeconds(0, 0);
	for (let minute = 0; minute < withinDays * 24 * 60; minute += 1) {
		const candidate = new Date(start.getTime() + minute * 60_000);
		if (schedule.matches(candidate)) return candidate;
	}
	return null;
}
