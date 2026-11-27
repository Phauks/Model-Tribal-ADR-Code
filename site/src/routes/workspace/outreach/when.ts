// When a batch next sends or starts, in words, in the reader's own time zone: "today 1:40 PM", "tomorrow 8 AM", or "Mon, Dec 1, 8 AM".

function timeOf(date: Date): string {
	const minutes = date.getMinutes();
	return date.toLocaleTimeString('en-US', minutes ? { hour: 'numeric', minute: '2-digit' } : { hour: 'numeric' });
}

export function whenWords(value: string, now: Date = new Date()): string {
	const date = new Date(value);
	const tomorrow = new Date(now);
	tomorrow.setDate(now.getDate() + 1);
	if (date.toDateString() === now.toDateString()) return `today ${timeOf(date)}`;
	if (date.toDateString() === tomorrow.toDateString()) return `tomorrow ${timeOf(date)}`;
	const day = date.toLocaleDateString('en-US', date.getFullYear() === now.getFullYear() ? { weekday: 'short', month: 'short', day: 'numeric' } : { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
	return `${day}, ${timeOf(date)}`;
}
