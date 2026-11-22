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
