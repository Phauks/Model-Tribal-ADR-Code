/**
 * Dates as pages print them, in the style guide's form: "2026-11-21" becomes
 * "Nov. 21, 2026" and "2026-11" becomes "Nov. 2026". A year alone, or text
 * that is not a date, is returned as it is.
 */
const monthNames = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];

export function readableDate(date: string): string {
	const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(date);
	if (!match) return date;
	const month = monthNames[Number(match[2]) - 1];
	if (!month) return date;
	return match[3] ? `${month} ${Number(match[3])}, ${match[1]}` : `${month} ${match[1]}`;
}

/**
 * A stored time as the workspace lists show it: "Nov. 24, 2026" in the reader's
 * own time zone, or "" when there is none. Workspace pages used to write this
 * function each on their own.
 */
export function mediumDate(value: string | null | undefined): string {
	return value ? new Date(value).toLocaleDateString('en-US', { dateStyle: 'medium' }) : '';
}

/** A stored time with its time of day: "Nov. 24, 2026, 1:05 AM", or "" when there is none. */
export function mediumDateAndTime(value: string | null | undefined): string {
	return value ? new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '';
}
