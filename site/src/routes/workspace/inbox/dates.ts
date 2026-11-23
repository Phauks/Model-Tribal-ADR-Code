// Dates as the inbox shows them, in the reader's own time zone.

/** Today's time, or the date: "3:05 PM", "Nov 21", or "Nov 21, 2025" in another year. */
export function listDate(value: string, now: Date = new Date()): string {
	const date = new Date(value);
	if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
	return date.toLocaleDateString('en-US', date.getFullYear() === now.getFullYear() ? { month: 'short', day: 'numeric' } : { dateStyle: 'medium' });
}

/** A full date and time: "Nov 21, 2026, 3:05 PM". */
export function fullDate(value: string | null): string {
	return value ? new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '';
}

/** A datetime-local value for a moment some hours from now, in the browser's time zone. */
export function localInputValue(hoursFromNow: number, now: Date = new Date()): string {
	const date = new Date(now.getTime() + hoursFromNow * 3_600_000);
	const pad = (value: number) => String(value).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
