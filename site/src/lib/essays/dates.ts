/**
 * Dates for essay versions, in the style guide's form and in Pacific time,
 * where the lead author works: "Nov. 22, 2026, 10:30 p.m. PT" (docs/editing.md,
 * "Essays are dated").
 */
const monthNames = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];

function pacificParts(moment: string): Record<string, string> {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: 'America/Los_Angeles',
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		hour12: true
	}).formatToParts(new Date(moment));
	return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

/** "Nov. 22, 2026" */
export function essayDate(moment: string): string {
	const parts = pacificParts(moment);
	return `${monthNames[Number(parts.month) - 1]} ${parts.day}, ${parts.year}`;
}

/** "Nov. 22, 2026, 10:30 p.m. PT" */
export function essayDateTime(moment: string): string {
	const parts = pacificParts(moment);
	const period = parts.dayPeriod?.toLowerCase().startsWith('p') ? 'p.m.' : 'a.m.';
	return `${essayDate(moment)}, ${parts.hour}:${parts.minute} ${period} PT`;
}

/** "Nov. 23", with the year when it is not this one: "Nov. 23, 2025". */
export function essayShortDate(moment: string, today = new Date()): string {
	const parts = pacificParts(moment);
	const text = `${monthNames[Number(parts.month) - 1]} ${parts.day}`;
	return Number(parts.year) === Number(pacificParts(today.toISOString()).year) ? text : `${text}, ${parts.year}`;
}

/** "Nov. 18 to 24", "Nov. 30 to Dec. 2", or one day, "Nov. 23"; with the year when it is not this one. */
export function essayDateRange(from: string, to: string, today = new Date()): string {
	const first = pacificParts(from);
	const last = pacificParts(to);
	const thisYear = pacificParts(today.toISOString()).year;
	const year = last.year === thisYear && first.year === thisYear ? '' : `, ${last.year}`;
	const start = `${monthNames[Number(first.month) - 1]} ${first.day}${first.year !== last.year ? `, ${first.year}` : ''}`;
	if (first.year === last.year && first.month === last.month && first.day === last.day) return `${start}${year}`;
	const end = first.year === last.year && first.month === last.month ? last.day : `${monthNames[Number(last.month) - 1]} ${last.day}`;
	return `${start} to ${end}${year}`;
}
