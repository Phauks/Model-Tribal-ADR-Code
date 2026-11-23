/**
 * Events (site/COLLABORATION.md, "Events"): the words, time zones and times
 * shared by the public pages, the workspace and the emails. Nothing here
 * reads the database, so pages in the browser can use it too.
 */

export const eventKinds = ['talk', 'panel', 'workshop', 'gathering'] as const;
export type EventKind = (typeof eventKinds)[number];

export const eventKindLabels: Record<EventKind, string> = {
	talk: 'Talk',
	panel: 'Panel',
	workshop: 'Workshop',
	gathering: 'Gathering'
};

export const eventStatuses = ['draft', 'published', 'cancelled'] as const;
export type EventStatus = (typeof eventStatuses)[number];

export const eventStatusLabels: Record<EventStatus, string> = {
	draft: 'Draft',
	published: 'Published',
	cancelled: 'Cancelled'
};

export const attendanceKinds = ['in-person', 'online'] as const;
export type Attendance = (typeof attendanceKinds)[number];

export const attendanceLabels: Record<Attendance, string> = {
	'in-person': 'In person',
	online: 'Online'
};

export const recordingChoices = ['recorded', 'not-recorded', 'undecided'] as const;
export type RecordingChoice = (typeof recordingChoices)[number];

/** The choices as the workspace form names them. */
export const recordingChoiceLabels: Record<RecordingChoice, string> = {
	recorded: 'Will be recorded',
	'not-recorded': 'Will not be recorded',
	undecided: 'Not decided yet'
};

/** What readers are told before they register. */
export const recordingLabels: Record<RecordingChoice, string> = {
	recorded: 'This event will be recorded and posted afterward.',
	'not-recorded': 'This event will not be recorded.',
	undecided: 'Whether this event is recorded is not decided yet.'
};

export const registrationStatuses = ['registered', 'waitlisted', 'offered', 'lapsed', 'cancelled'] as const;
export type RegistrationStatus = (typeof registrationStatuses)[number];

export const registrationStatusLabels: Record<RegistrationStatus, string> = {
	registered: 'Registered',
	waitlisted: 'On the waitlist',
	offered: 'Offered a seat',
	lapsed: 'Offer ran out',
	cancelled: 'Cancelled'
};

/** How long someone on a waitlist has to take a freed seat, unless the event starts sooner. */
export const offerHoldHours = 48;

/**
 * The time zones an event can be held in: every zone in the United States,
 * each named for the places that keep it. The Navajo Nation keeps daylight
 * saving time, unlike the rest of Arizona, so events there use Mountain.
 */
export const eventTimeZones = [
	{ zone: 'America/New_York', label: 'Eastern' },
	{ zone: 'America/Chicago', label: 'Central' },
	{ zone: 'America/Denver', label: 'Mountain' },
	{ zone: 'America/Phoenix', label: 'Arizona' },
	{ zone: 'America/Los_Angeles', label: 'Pacific' },
	{ zone: 'America/Anchorage', label: 'Alaska' },
	{ zone: 'Pacific/Honolulu', label: 'Hawaii' },
	{ zone: 'America/Puerto_Rico', label: 'Atlantic (Puerto Rico and the U.S. Virgin Islands)' },
	{ zone: 'Pacific/Guam', label: 'Chamorro (Guam and the Northern Mariana Islands)' },
	{ zone: 'Pacific/Pago_Pago', label: 'Samoa (American Samoa)' }
] as const;

export type EventTimeZone = (typeof eventTimeZones)[number]['zone'];

export function isEventTimeZone(value: unknown): value is EventTimeZone {
	return eventTimeZones.some((entry) => entry.zone === value);
}

/** The short name of a zone for a sentence, such as "Pacific time". */
export function zoneName(zone: string): string {
	const entry = eventTimeZones.find((item) => item.zone === zone);
	if (!entry) return zone;
	return `${entry.label.replace(/ \(.*\)$/, '')} time`;
}

const wallClockParts = new Map<string, Intl.DateTimeFormat>();

function wallClockFormat(zone: string): Intl.DateTimeFormat {
	let format = wallClockParts.get(zone);
	if (!format) {
		format = new Intl.DateTimeFormat('en-US', {
			timeZone: zone,
			hourCycle: 'h23',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
		wallClockParts.set(zone, format);
	}
	return format;
}

/** The date and time on a clock in this zone at this instant, as "YYYY-MM-DDTHH:MM". */
export function wallClock(instant: Date, zone: string): string {
	const parts = Object.fromEntries(wallClockFormat(zone).formatToParts(instant).map((part) => [part.type, part.value]));
	return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** How far a zone's clocks are ahead of UTC at an instant, in milliseconds. */
function offsetAt(instant: number, zone: string): number {
	const parts = Object.fromEntries(
		wallClockFormat(zone)
			.formatToParts(new Date(instant))
			.map((part) => [part.type, Number(part.value)])
	);
	const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
	return asUtc - Math.floor(instant / 1000) * 1000;
}

const localPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/**
 * The instant a clock in this zone shows this date and time
 * ("YYYY-MM-DDTHH:MM"), or undefined when the text is not a time. A time
 * skipped when clocks go forward is read as the hour after; a time that
 * happens twice when clocks go back is read as the first.
 */
export function zonedToUtc(local: string, zone: string): Date | undefined {
	const match = localPattern.exec(local);
	if (!match) return undefined;
	const [year, month, day, hour, minute] = match.slice(1).map(Number);
	if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return undefined;
	const asUtc = Date.UTC(year, month - 1, day, hour, minute);
	const check = new Date(asUtc);
	if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return undefined;
	// Try the offsets in force a day either side, and keep the earliest
	// instant whose clock reads the time asked for.
	const offsets = [...new Set([offsetAt(asUtc - 86_400_000, zone), offsetAt(asUtc, zone), offsetAt(asUtc + 86_400_000, zone)])];
	const matches = offsets
		.map((offset) => asUtc - offset)
		.filter((instant) => wallClock(new Date(instant), zone) === local)
		.sort((a, b) => a - b);
	if (matches.length > 0) return new Date(matches[0]);
	// The time was skipped: use the larger offset gap, which lands an hour later.
	return new Date(asUtc - Math.min(...offsets));
}

const dayFormats = new Map<string, Intl.DateTimeFormat>();
const timeFormats = new Map<string, Intl.DateTimeFormat>();

function dayText(instant: Date, zone: string): string {
	let format = dayFormats.get(zone);
	if (!format) {
		format = new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
		dayFormats.set(zone, format);
	}
	return format.format(instant);
}

function timeText(instant: Date, zone: string): string {
	let format = timeFormats.get(zone);
	if (!format) {
		format = new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', minute: '2-digit' });
		timeFormats.set(zone, format);
	}
	return format.format(instant).replace(/ /g, ' ');
}

/**
 * When an event happens, in its own time zone, such as "Thursday, March 11,
 * 2027, 9:00 AM to 12:15 PM Pacific time".
 */
export function eventWhen(startsAt: string, endsAt: string, zone: string): string {
	const start = new Date(startsAt);
	const end = new Date(endsAt);
	const startDay = dayText(start, zone);
	const endDay = dayText(end, zone);
	const ending = startDay === endDay ? timeText(end, zone) : `${endDay}, ${timeText(end, zone)}`;
	return `${startDay}, ${timeText(start, zone)} to ${ending} ${zoneName(zone)}`;
}

/** An event's times without its day, such as "9:00 AM to 12:15 PM Pacific time"; with both days when it runs past midnight. */
export function eventClock(startsAt: string, endsAt: string, zone: string): string {
	const start = new Date(startsAt);
	const end = new Date(endsAt);
	if (dayText(start, zone) !== dayText(end, zone)) return eventWhen(startsAt, endsAt, zone);
	return `${timeText(start, zone)} to ${timeText(end, zone)} ${zoneName(zone)}`;
}

/** The day an event starts, in its own time zone, such as "Thursday, March 11, 2027". */
export function eventDay(startsAt: string, zone: string): string {
	return dayText(new Date(startsAt), zone);
}

/** A time in an event's zone with its day, for deadlines such as when an offer runs out. */
export function eventMoment(instant: string, zone: string): string {
	const time = new Date(instant);
	return `${dayText(time, zone)}, ${timeText(time, zone)} ${zoneName(zone)}`;
}

/** What a person may ask for when registering (design/events-and-cle, "3-registration"); "Something else" has its own box. */
export const accessNeedChoices = ['Live captions', 'ASL interpreting', 'Large-print or screen-reader copy of the materials', 'Step-free entry'] as const;

/**
 * The registration form's access needs, as the one line the people running
 * the event read, such as "Live captions; ASL interpreting; Also: a quiet
 * room". Null when nothing was asked for.
 */
export function readAccessNeeds(form: FormData): { chosen: string[]; other: string; text: string | null } {
	const chosen = form
		.getAll('need')
		.map(String)
		.filter((need) => (accessNeedChoices as readonly string[]).includes(need));
	const other = String(form.get('need-other') ?? '')
		.trim()
		.slice(0, 1500);
	const parts = [...chosen, ...(other ? [`Also: ${other}`] : [])];
	return { chosen, other, text: parts.length > 0 ? parts.join('; ') : null };
}

/** The date tile on the list of events: "MAR", "11", "Thursday", in the event's own zone. */
export function dateTile(startsAt: string, zone: string): { month: string; day: string; weekday: string } {
	const parts = Object.fromEntries(
		new Intl.DateTimeFormat('en-US', { timeZone: zone, month: 'short', day: 'numeric', weekday: 'long' })
			.formatToParts(new Date(startsAt))
			.map((part) => [part.type, part.value])
	);
	return { month: String(parts.month).toUpperCase(), day: String(parts.day), weekday: String(parts.weekday) };
}

/** A session's times in the event's zone, such as "9:00 AM to 10:00 AM", or only its start. */
export function sessionTimes(startsAt: string, endsAt: string | null, zone: string): string {
	const start = timeText(new Date(startsAt), zone);
	return endsAt ? `${start} to ${timeText(new Date(endsAt), zone)}` : start;
}

/** One kind of seat, as counted for the seat status. */
export interface SeatCount {
	attendance: Attendance;
	capacity: number | null;
	taken: number;
	waiting: number;
}

/**
 * The seat status on the list of events and in the Register card, as in the
 * approved mockup: "Open seats", "38 of 120 in-person seats left", or "Full. 6
 * on the waitlist". A kind of seat with people waiting counts as full, since
 * a freed seat goes to them first.
 */
export function seatStatus(seats: readonly SeatCount[]): { words: string; full: boolean } | null {
	if (seats.length === 0) return null;
	const isFull = (seat: SeatCount) => seat.capacity !== null && (seat.taken >= seat.capacity || seat.waiting > 0);
	if (seats.every(isFull)) {
		const waiting = seats.reduce((sum, seat) => sum + seat.waiting, 0);
		return { words: waiting > 0 ? `Full. ${waiting} on the waitlist` : 'Full', full: true };
	}
	const limited = seats.filter((seat) => seat.capacity !== null && !isFull(seat));
	if (limited.length > 0) {
		const total = limited.reduce((sum, seat) => sum + (seat.capacity ?? 0), 0);
		const left = limited.reduce((sum, seat) => sum + Math.max(0, (seat.capacity ?? 0) - seat.taken), 0);
		const kind = seats.some((seat) => seat.capacity === null) && limited.every((seat) => seat.attendance === 'in-person') ? ' in-person' : '';
		return { words: `${left} of ${total}${kind} ${total === 1 ? 'seat' : 'seats'} left`, full: false };
	}
	return { words: 'Open seats', full: false };
}

/** Addresses under /events that are pages of their own, not events. */
const reservedSlugs = new Set(['scheduled', 'calendar']);

/** Whether text can be an event's address, /events/<slug>. */
export function isEventSlug(value: unknown): value is string {
	return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 80 && !reservedSlugs.has(value);
}

/** An address made from a title, such as "peacemaking-in-practice". */
export function slugFromTitle(title: string): string {
	return title
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80)
		.replace(/-+$/, '');
}

/** A description's paragraphs: a blank line starts a new one. */
export function paragraphsOf(text: string): string[] {
	return text
		.split(/\n\s*\n/)
		.map((paragraph) => paragraph.trim())
		.filter((paragraph) => paragraph !== '');
}

/** Whether a link is a web address that can be shown as a link. */
export function isWebLink(value: unknown): value is string {
	if (typeof value !== 'string' || value.length > 500) return false;
	try {
		const url = new URL(value);
		return url.protocol === 'https:' && url.hostname.includes('.');
	} catch {
		return false;
	}
}

/**
 * Where an event happens, in a few words, such as "In person at Moot Court,
 * and online". An event is online when it offers online seats, or takes no
 * registration and has an online link.
 */
/** Whether an event can be attended online, in person, or both, from its seats or, without seats, its link and place. */
export function eventModes(
	event: { venueName: string | null; venueAddress: string | null; onlineLink: string | null },
	attendances: readonly Attendance[]
): { online: boolean; inPerson: boolean } {
	const venue = event.venueName ?? event.venueAddress;
	return {
		online: attendances.includes('online') || (attendances.length === 0 && event.onlineLink !== null),
		inPerson: venue !== null && (attendances.length === 0 || attendances.includes('in-person'))
	};
}

export function whereLine(event: { venueName: string | null; venueAddress: string | null; onlineLink: string | null }, attendances: readonly Attendance[]): string {
	const venue = event.venueName ?? event.venueAddress;
	const { online, inPerson } = eventModes(event, attendances);
	if (inPerson && online) return `In person at ${venue}, and online`;
	if (inPerson) return `In person at ${venue}`;
	if (online) return 'Online';
	return 'Place to be announced';
}
