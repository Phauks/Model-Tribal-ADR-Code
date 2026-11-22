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
