/**
 * Calendar files for events (.ics), which calendar programs such as Google
 * Calendar, Outlook and Apple Calendar can open or subscribe to (RFC 5545,
 * "Internet Calendaring and Scheduling Core Object Specification",
 * www.rfc-editor.org/rfc/rfc5545).
 *
 * A file never holds the online link: the link is only for people
 * registered, and anyone can download these files.
 */
import { attendanceLabels, eventKindLabels, zoneName } from '#lib/event-calendar.ts';
import type { CalendarEvent } from './event-calendar.ts';
import { escapeContentText, foldContentLine } from '#lib/content-lines.ts';

/** Text escaped for a property value (RFC 5545, section 3.3.11). */
export const escapeText = escapeContentText;

/** A content line folded to at most 75 octets (RFC 5545, section 3.1). */
export const foldLine = foldContentLine;

/** A UTC time as RFC 5545 writes it, such as 20270311T170000Z. */
export function calendarTime(iso: string): string {
	return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function where(event: CalendarEvent): string | undefined {
	const place = [event.venueName, event.venueAddress].filter(Boolean).join(', ');
	return place || (event.onlineLink ? attendanceLabels.online : undefined);
}

function eventLines(event: CalendarEvent, site: string, stamp: string): string[] {
	const page = `${site}/events/${event.slug}`;
	const about = [
		event.summary,
		`${eventKindLabels[event.kind]}. Times are shown in ${zoneName(event.timeZone)} on the event's page.`,
		event.status === 'cancelled' ? `Cancelled.${event.cancelNote ? ` ${event.cancelNote}` : ''}` : '',
		`Details and registration: ${page}`
	].filter(Boolean);
	const lines = [
		'BEGIN:VEVENT',
		`UID:${event.identifier}@model-tribal-adr-code`,
		`DTSTAMP:${calendarTime(stamp)}`,
		`LAST-MODIFIED:${calendarTime(event.updatedAt)}`,
		`DTSTART:${calendarTime(event.startsAt)}`,
		`DTEND:${calendarTime(event.endsAt)}`,
		`SEQUENCE:${event.sequence}`,
		`SUMMARY:${escapeText(event.title)}`,
		`DESCRIPTION:${escapeText(about.join('\n\n'))}`,
		`URL:${page}`,
		`STATUS:${event.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`
	];
	const place = where(event);
	if (place) lines.push(`LOCATION:${escapeText(place)}`);
	lines.push('END:VEVENT');
	return lines;
}

/** A calendar file holding these events. */
export function calendarFile(events: readonly CalendarEvent[], site: string, name: string, time: Date = new Date()): string {
	const stamp = time.toISOString();
	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Model Tribal ADR Code//Events//EN',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		`X-WR-CALNAME:${escapeText(name)}`,
		...events.flatMap((event) => eventLines(event, site, stamp)),
		'END:VCALENDAR'
	];
	return `${lines.map(foldLine).join('\r\n')}\r\n`;
}
