import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { beforeEach, describe, expect, it } from 'vitest';
import {
	dateTile,
	eventClock,
	eventWhen,
	isEventSlug,
	isWebLink,
	paragraphsOf,
	readAccessNeeds,
	seatStatus,
	sessionTimes,
	slugFromTitle,
	wallClock,
	zonedToUtc
} from '#lib/event-calendar.ts';
import { verifiedAccount } from '#lib/server/accounts.ts';
import {
	acceptOffer,
	addMaterial,
	cancelRegistration,
	changeEventStatus,
	claimMessage,
	clearOldAccessNeeds,
	createEvent,
	dueMessages,
	eventByIdentifier,
	eventsForAccount,
	expireOffers,
	listedEvents,
	materialObjectKey,
	materialsOf,
	register,
	registrationFor,
	registrationsOf,
	releaseMessage,
	removeMaterial,
	removeSession,
	removeTicketType,
	saveSession,
	saveTicketType,
	seatCountsByEvent,
	sessionsOf,
	ticketTypesOf,
	updateEvent,
	type CalendarEvent,
	type EventInput
} from '#lib/server/event-calendar.ts';
import { calendarFile, escapeText, foldLine } from '#lib/server/event-calendar-file.ts';
import { eventCalendarRun, eventMessage, sendDueEventMessages, type EventEmail } from '#lib/server/event-calendar-email.ts';
import { testDatabase } from './database.ts';

const hour = 3_600_000;
const today = new Date('2027-03-01T12:00:00.000Z');
const later = (hours: number) => new Date(today.getTime() + hours * hour);

function input(overrides: Partial<EventInput> = {}): EventInput {
	return {
		slug: 'peacemaking-in-practice',
		title: 'Peacemaking in practice',
		summary: 'A talk about peacemaking courts.',
		description: 'First paragraph.\n\nSecond paragraph.',
		kind: 'talk',
		startsAt: later(24 * 10).toISOString(),
		endsAt: later(24 * 10 + 2).toISOString(),
		timeZone: 'America/Los_Angeles',
		venueName: 'Thomas & Mack Moot Court',
		venueAddress: '4505 S. Maryland Pkwy., Las Vegas, NV',
		onlineLink: 'https://example.org/join/123',
		recordingLink: null,
		recording: 'undecided',
		accessNotes: 'Live captions online.',
		registrationClosesAt: null,
		...overrides
	};
}

let database: D1Database;
let accounts: string[];

async function publishedEvent(overrides: Partial<EventInput> = {}, capacity: number | null = 2) {
	const created = await createEvent(database, input(overrides), null, today);
	if (!created.saved) throw new Error(created.problem);
	const event = (await eventByIdentifier(database, created.identifier)) as CalendarEvent;
	const ticket = await saveTicketType(database, event.identifier, null, { name: 'In person', attendance: 'in-person', capacity, sortOrder: 0 }, today);
	await changeEventStatus(database, event, 'publish', null, today);
	return { event: (await eventByIdentifier(database, event.identifier)) as CalendarEvent, ticket };
}

function registration(event: CalendarEvent, ticket: string, account: string, name = 'Reader') {
	return { eventIdentifier: event.identifier, ticketIdentifier: ticket, accountIdentifier: account, name, accessNeeds: null, wantsReminders: true };
}

beforeEach(async () => {
	database = testDatabase();
	accounts = [];
	for (const name of ['a', 'b', 'c', 'd']) accounts.push((await verifiedAccount(database, `${name}@example.org`)).identifier);
});

describe('times in an event’s own zone', () => {
	it('reads a clock time in a zone as UTC, with daylight saving time', () => {
		expect(zonedToUtc('2027-03-11T09:00', 'America/Los_Angeles')?.toISOString()).toBe('2027-03-11T17:00:00.000Z');
		expect(zonedToUtc('2027-01-11T09:00', 'America/Los_Angeles')?.toISOString()).toBe('2027-01-11T17:00:00.000Z');
		expect(zonedToUtc('2027-07-01T12:00', 'America/Phoenix')?.toISOString()).toBe('2027-07-01T19:00:00.000Z');
		expect(zonedToUtc('2027-07-01T12:00', 'America/Denver')?.toISOString()).toBe('2027-07-01T18:00:00.000Z');
		expect(zonedToUtc('2027-07-01T12:00', 'Pacific/Guam')?.toISOString()).toBe('2027-07-01T02:00:00.000Z');
	});

	it('moves a skipped time an hour on and takes the first of a repeated one', () => {
		expect(zonedToUtc('2027-03-14T02:30', 'America/New_York')?.toISOString()).toBe('2027-03-14T07:30:00.000Z');
		expect(zonedToUtc('2027-11-07T01:30', 'America/New_York')?.toISOString()).toBe('2027-11-07T05:30:00.000Z');
	});

	it('refuses text that is not a time', () => {
		for (const text of ['', '2027-02-30T12:00', '2027-13-01T12:00', '2027-01-01 12:00', '2027-01-01T24:00']) {
			expect(zonedToUtc(text, 'America/Chicago')).toBeUndefined();
		}
	});

	it('round-trips through the wall clock', () => {
		const instant = zonedToUtc('2027-06-15T18:45', 'America/Anchorage') as Date;
		expect(wallClock(instant, 'America/Anchorage')).toBe('2027-06-15T18:45');
	});

	it('says when an event happens in words', () => {
		expect(eventWhen('2027-03-11T17:00:00.000Z', '2027-03-11T20:15:00.000Z', 'America/Los_Angeles')).toBe(
			'Thursday, March 11, 2027, 9:00 AM to 12:15 PM Pacific time'
		);
		expect(eventWhen('2027-03-11T17:00:00.000Z', '2027-03-12T20:15:00.000Z', 'America/Puerto_Rico')).toBe(
			'Thursday, March 11, 2027, 1:00 PM to Friday, March 12, 2027, 4:15 PM Atlantic time'
		);
	});
});

describe('addresses, links and text', () => {
	it('makes and checks event addresses', () => {
		expect(slugFromTitle('Peacemaking in Practice: Diné Courts!')).toBe('peacemaking-in-practice-dine-courts');
		expect(isEventSlug('peacemaking-2027')).toBe(true);
		for (const slug of ['', '-a', 'a-', 'A', 'a--b', 'a b', 'a/b']) expect(isEventSlug(slug)).toBe(false);
	});

	it('takes only https links', () => {
		expect(isWebLink('https://us02web.zoom.us/j/123')).toBe(true);
		expect(isWebLink('http://example.org')).toBe(false);
		expect(isWebLink('javascript:alert(1)')).toBe(false);
	});

	it('splits a description into paragraphs on blank lines', () => {
		expect(paragraphsOf('One\nline.\n\n  \nTwo.')).toEqual(['One\nline.', 'Two.']);
	});
});

describe('registering for a seat', () => {
	it('registers until the seats are taken, then waitlists', async () => {
		const { event, ticket } = await publishedEvent();
		expect((await register(database, registration(event, ticket, accounts[0]), today)).kind).toBe('registered');
		expect((await register(database, registration(event, ticket, accounts[1]), today)).kind).toBe('registered');
		expect((await register(database, registration(event, ticket, accounts[2]), today)).kind).toBe('waitlisted');
		expect((await register(database, registration(event, ticket, accounts[3]), later(1))).kind).toBe('waitlisted');
		expect((await registrationFor(database, event.identifier, accounts[3]))?.waitlistPlace).toBe(2);
		const [counts] = await ticketTypesOf(database, event.identifier);
		expect([counts.taken, counts.waiting]).toEqual([2, 2]);
	});

	it('takes one live registration per person', async () => {
		const { event, ticket } = await publishedEvent();
		await register(database, registration(event, ticket, accounts[0]), today);
		expect((await register(database, registration(event, ticket, accounts[0]), today)).kind).toBe('already');
	});

	it('has no limit when the capacity is empty', async () => {
		const { event, ticket } = await publishedEvent({}, null);
		for (const account of accounts) expect((await register(database, registration(event, ticket, account), today)).kind).toBe('registered');
	});

	it('is closed for drafts, after registration closes and after the start', async () => {
		const created = await createEvent(database, input(), null, today);
		if (!created.saved) throw new Error('not saved');
		const ticket = await saveTicketType(database, created.identifier, null, { name: 'Online', attendance: 'online', capacity: null, sortOrder: 0 });
		const draft = (await eventByIdentifier(database, created.identifier)) as CalendarEvent;
		expect((await register(database, registration(draft, ticket, accounts[0]), today)).kind).toBe('closed');
		const { event, ticket: open } = await publishedEvent({ slug: 'closes-early', registrationClosesAt: later(1).toISOString() });
		expect((await register(database, registration(event, open, accounts[0]), later(2))).kind).toBe('closed');
		expect((await register(database, registration(event, open, accounts[1]), later(24 * 11))).kind).toBe('closed');
	});

	it('lists a person’s upcoming events', async () => {
		const { event, ticket } = await publishedEvent();
		await register(database, registration(event, ticket, accounts[0]), today);
		expect((await eventsForAccount(database, accounts[0], today)).map((item) => item.slug)).toEqual(['peacemaking-in-practice']);
		expect(await eventsForAccount(database, accounts[0], later(24 * 11))).toEqual([]);
	});
});

describe('the waitlist', () => {
	it('offers a freed seat to the person waiting longest, held for 48 hours', async () => {
		const { event, ticket } = await publishedEvent();
		const first = await register(database, registration(event, ticket, accounts[0]), today);
		await register(database, registration(event, ticket, accounts[1]), today);
		await register(database, registration(event, ticket, accounts[2]), later(1));
		await register(database, registration(event, ticket, accounts[3]), later(2));
		if (first.kind !== 'registered') throw new Error('not registered');
		expect(await cancelRegistration(database, first.identifier, accounts[0], later(3))).toBe(true);
		const offered = await registrationFor(database, event.identifier, accounts[2]);
		expect(offered?.status).toBe('offered');
		expect(offered?.offerExpiresAt).toBe(later(51).toISOString());
		expect((await registrationFor(database, event.identifier, accounts[3]))?.status).toBe('waitlisted');
		// A newcomer cannot jump the line while the offer stands.
		const newcomer = (await verifiedAccount(database, 'e@example.org')).identifier;
		expect((await register(database, registration(event, ticket, newcomer), later(4))).kind).toBe('waitlisted');
		expect(await acceptOffer(database, offered?.identifier as string, accounts[2], later(5))).toBe(true);
		expect((await registrationFor(database, event.identifier, accounts[2]))?.status).toBe('registered');
	});

	it('lets an offer lapse and passes the seat on', async () => {
		const { event, ticket } = await publishedEvent({}, 1);
		const first = await register(database, registration(event, ticket, accounts[0]), today);
		await register(database, registration(event, ticket, accounts[1]), today);
		await register(database, registration(event, ticket, accounts[2]), later(1));
		if (first.kind !== 'registered') throw new Error('not registered');
		await cancelRegistration(database, first.identifier, accounts[0], later(2));
		const offer = await registrationFor(database, event.identifier, accounts[1]);
		expect(await acceptOffer(database, offer?.identifier as string, accounts[1], later(60))).toBe(false);
		expect(await expireOffers(database, later(60))).toBe(1);
		expect(await registrationFor(database, event.identifier, accounts[1])).toBeUndefined();
		expect((await registrationFor(database, event.identifier, accounts[2]))?.status).toBe('offered');
	});

	it('ends an offer when the event starts, if that is sooner', async () => {
		const { event, ticket } = await publishedEvent({ startsAt: later(10).toISOString(), endsAt: later(12).toISOString() }, 1);
		const first = await register(database, registration(event, ticket, accounts[0]), today);
		await register(database, registration(event, ticket, accounts[1]), today);
		if (first.kind !== 'registered') throw new Error('not registered');
		await cancelRegistration(database, first.identifier, accounts[0], later(1));
		expect((await registrationFor(database, event.identifier, accounts[1]))?.offerExpiresAt).toBe(later(10).toISOString());
	});

	it('offers new seats when a limit is raised', async () => {
		const { event, ticket } = await publishedEvent({}, 1);
		await register(database, registration(event, ticket, accounts[0]), today);
		await register(database, registration(event, ticket, accounts[1]), today);
		await register(database, registration(event, ticket, accounts[2]), later(1));
		await saveTicketType(database, event.identifier, ticket, { name: 'In person', attendance: 'in-person', capacity: 3, sortOrder: 0 }, later(2));
		expect((await registrationFor(database, event.identifier, accounts[1]))?.status).toBe('offered');
		expect((await registrationFor(database, event.identifier, accounts[2]))?.status).toBe('offered');
	});
});

describe('changing an event', () => {
	it('raises the sequence when a published event’s time or place changes', async () => {
		const { event } = await publishedEvent();
		await updateEvent(database, event, { ...input(), summary: 'New summary.' }, later(1));
		expect((await eventByIdentifier(database, event.identifier))?.sequence).toBe(0);
		await updateEvent(database, event, { ...input(), venueName: 'Another room' }, later(2));
		expect((await eventByIdentifier(database, event.identifier))?.sequence).toBe(1);
	});

	it('refuses a second event at the same address', async () => {
		await createEvent(database, input(), null, today);
		const again = await createEvent(database, input(), null, today);
		expect(again).toEqual({ saved: false, problem: expect.stringContaining('address') });
	});

	it('only cancels an event people registered for', async () => {
		const { event, ticket } = await publishedEvent();
		await register(database, registration(event, ticket, accounts[0]), today);
		expect((await changeEventStatus(database, event, 'unpublish', null, today)).done).toBe(false);
		expect((await changeEventStatus(database, event, 'delete', null, today)).done).toBe(false);
		expect(await removeTicketType(database, event.identifier, ticket)).toBe(false);
		expect((await changeEventStatus(database, event, 'cancel', 'The speaker is ill.', today)).done).toBe(true);
		const cancelled = await eventByIdentifier(database, event.identifier);
		expect([cancelled?.status, cancelled?.sequence, cancelled?.cancelNote]).toEqual(['cancelled', 1, 'The speaker is ill.']);
	});

	it('shows readers published and cancelled events, never drafts', async () => {
		await createEvent(database, input({ slug: 'a-draft' }), null, today);
		await publishedEvent();
		expect((await listedEvents(database, 'upcoming', today)).map((event) => event.slug)).toEqual(['peacemaking-in-practice']);
		expect((await listedEvents(database, 'past', later(24 * 11))).map((event) => event.slug)).toEqual(['peacemaking-in-practice']);
	});
});

describe('emails', () => {
	it('confirms, reminds a day before and shortly before, once each', async () => {
		const { event, ticket } = await publishedEvent({}, 1);
		await register(database, registration(event, ticket, accounts[0], 'Ada'), today);
		await register(database, registration(event, ticket, accounts[1], 'Ben'), today);
		const kinds = async (time: Date) => (await dueMessages(database, time)).map((message) => `${message.kind}:${message.registration.name}`).sort();
		expect(await kinds(today)).toEqual(['registered:Ada', 'waitlisted:Ben']);
		const sent: EventEmail[] = [];
		const delivery = { kind: 'email' as const, site: 'https://example.org', send: async (email: EventEmail) => void sent.push(email) };
		expect((await sendDueEventMessages(database, delivery, today)).sent).toBe(2);
		expect(await kinds(today)).toEqual([]);
		expect(sent.map((email) => email.subject).sort()).toEqual(["You're on the waitlist: Peacemaking in practice", "You're registered: Peacemaking in practice"]);
		expect(await kinds(later(24 * 9 + 1))).toEqual(['day-before:Ada']);
		await sendDueEventMessages(database, delivery, later(24 * 9 + 1));
		expect(await kinds(later(24 * 10 - 1))).toEqual(['starting-soon:Ada']);
	});

	it('tells everyone signed up about a change once, and not people who signed up after it', async () => {
		const { event, ticket } = await publishedEvent({}, 5);
		const first = await register(database, registration(event, ticket, accounts[0], 'Ada'), today);
		for (const message of await dueMessages(database, today)) await claimMessage(database, message, today);
		await updateEvent(database, event, { ...input(), startsAt: later(24 * 12).toISOString(), endsAt: later(24 * 12 + 2).toISOString() }, later(1));
		await register(database, registration(event, ticket, accounts[1], 'Ben'), later(2));
		const due = await dueMessages(database, later(2));
		expect(due.map((message) => `${message.kind}:${message.registration.name}`).sort()).toEqual(['changed:Ada', 'registered:Ben']);
		const change = due.find((message) => message.kind === 'changed');
		expect(change?.registration.identifier).toBe(first.kind === 'registered' ? first.identifier : '');
		expect(await claimMessage(database, change!, later(2))).toBe(true);
		expect(await claimMessage(database, change!, later(2))).toBe(false);
		expect((await dueMessages(database, later(3))).map((message) => message.kind)).toEqual(['registered']);
	});

	it('sends again after a failed send', async () => {
		const { event, ticket } = await publishedEvent();
		await register(database, registration(event, ticket, accounts[0]), today);
		const failing = { kind: 'email' as const, site: 'https://example.org', send: async () => Promise.reject(new Error('down')) };
		expect(await sendDueEventMessages(database, failing, today)).toEqual({ sent: 0, failed: 1, delivery: 'email' });
		const [message] = await dueMessages(database, today);
		expect(message.kind).toBe('registered');
		await releaseMessage(database, message);
	});

	it('tells registered people about a cancellation', async () => {
		const { event, ticket } = await publishedEvent();
		await register(database, registration(event, ticket, accounts[0], 'Ada'), today);
		for (const message of await dueMessages(database, today)) await claimMessage(database, message, today);
		await changeEventStatus(database, event, 'cancel', 'The speaker is ill.', later(1));
		const [message] = await dueMessages(database, later(1));
		expect(message.kind).toBe('cancelled');
		const email = eventMessage(message, 'https://example.org');
		expect(email.subject).toBe('Cancelled: Peacemaking in practice');
		expect(email.text).toContain('The speaker is ill.');
	});

	it('gives the online link only to people with an online seat', async () => {
		const { event, ticket } = await publishedEvent();
		const online = await saveTicketType(database, event.identifier, null, { name: 'Online', attendance: 'online', capacity: null, sortOrder: 1 });
		await register(database, registration(event, ticket, accounts[0], 'Ada'), today);
		await register(database, registration(event, online, accounts[1], 'Ben'), today);
		const emails = (await dueMessages(database, today)).map((message) => eventMessage(message, 'https://example.org'));
		expect(emails.find((email) => email.text.includes('Ada'))?.text).not.toContain('example.org/join');
		expect(emails.find((email) => email.text.includes('Ben'))?.text).toContain('Join online: https://example.org/join/123');
	});

	it('sends nothing while email is off, and the hourly run still moves the waitlist', async () => {
		const { event, ticket } = await publishedEvent({}, 1);
		const first = await register(database, registration(event, ticket, accounts[0]), today);
		await register(database, registration(event, ticket, accounts[1]), today);
		if (first.kind !== 'registered') throw new Error('not registered');
		await cancelRegistration(database, first.identifier, accounts[0], today);
		const result = await eventCalendarRun({ database } as unknown as WorkerEnvironment, later(49));
		expect(result).toMatchObject({ lapsed: 1, sent: 0 });
		expect(await registrationFor(database, event.identifier, accounts[1])).toBeUndefined();
	});

	it('empties access needs 30 days after the event', async () => {
		const { event, ticket } = await publishedEvent();
		await register(database, { ...registration(event, ticket, accounts[0]), accessNeeds: 'Step-free entry' }, today);
		expect(await clearOldAccessNeeds(database, later(24 * 30))).toBe(0);
		expect(await clearOldAccessNeeds(database, later(24 * 41))).toBe(1);
		expect((await registrationsOf(database, event.identifier))[0].accessNeeds).toBeNull();
	});
});

describe('calendar files', () => {
	it('escapes text and folds long lines at 75 octets', () => {
		expect(escapeText('a, b; c\\d\ne')).toBe('a\\, b\\; c\\\\d\\ne');
		const folded = foldLine(`SUMMARY:${'é'.repeat(60)}`);
		for (const line of folded.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
		expect(folded.split('\r\n').map((line, index) => (index === 0 ? line : line.slice(1))).join('')).toBe(`SUMMARY:${'é'.repeat(60)}`);
	});

	it('writes an event without its online link', async () => {
		const { event } = await publishedEvent();
		const file = calendarFile([event], 'https://example.org', 'Events', today);
		expect(file).toContain('BEGIN:VCALENDAR\r\n');
		expect(file).toContain(`UID:${event.identifier}@model-tribal-adr-code`);
		expect(file).toContain(`DTSTART:${event.startsAt.replace(/[-:]/g, '').replace('.000', '')}`);
		expect(file).toContain('STATUS:CONFIRMED');
		expect(file).not.toContain('example.org/join');
		expect(file.endsWith('END:VCALENDAR\r\n')).toBe(true);
	});
});

describe('the list of events and the event page, as in the approved mockups', () => {
	it('makes a date tile and the times without the day in the event’s own zone', () => {
		expect(dateTile('2027-03-11T17:00:00.000Z', 'America/Los_Angeles')).toEqual({ month: 'MAR', day: '11', weekday: 'Thursday' });
		// Late in the evening in Los Angeles is already the next day in UTC.
		expect(dateTile('2027-03-12T05:30:00.000Z', 'America/Los_Angeles').day).toBe('11');
		expect(eventClock('2027-03-11T17:00:00.000Z', '2027-03-11T20:15:00.000Z', 'America/Los_Angeles')).toBe('9:00 AM to 12:15 PM Pacific time');
		expect(sessionTimes('2027-03-11T17:00:00.000Z', '2027-03-11T18:00:00.000Z', 'America/Los_Angeles')).toBe('9:00 AM to 10:00 AM');
		expect(sessionTimes('2027-03-11T17:00:00.000Z', null, 'America/Los_Angeles')).toBe('9:00 AM');
	});

	it('says how many seats are left, or that it is full and how many wait', () => {
		expect(seatStatus([])).toBeNull();
		expect(seatStatus([{ attendance: 'online', capacity: null, taken: 4, waiting: 0 }])).toEqual({ words: 'Open seats', full: false });
		expect(
			seatStatus([
				{ attendance: 'online', capacity: null, taken: 4, waiting: 0 },
				{ attendance: 'in-person', capacity: 120, taken: 82, waiting: 0 }
			])?.words
		).toBe('38 of 120 in-person seats left');
		expect(seatStatus([{ attendance: 'in-person', capacity: 40, taken: 39, waiting: 0 }])?.words).toBe('1 of 40 seats left');
		expect(seatStatus([{ attendance: 'in-person', capacity: 40, taken: 40, waiting: 6 }])).toEqual({ words: 'Full. 6 on the waitlist', full: true });
		// People waiting means a freed seat is theirs, so it counts as full.
		expect(seatStatus([{ attendance: 'in-person', capacity: 40, taken: 39, waiting: 1 }])?.full).toBe(true);
	});

	it('turns the access-need boxes into one line for the people running the event', () => {
		const form = new FormData();
		form.append('need', 'Live captions');
		form.append('need', 'ASL interpreting');
		form.append('need', 'Not a choice');
		form.set('need-other', '  A quiet room  ');
		expect(readAccessNeeds(form)).toEqual({
			chosen: ['Live captions', 'ASL interpreting'],
			other: 'A quiet room',
			text: 'Live captions; ASL interpreting; Also: A quiet room'
		});
		expect(readAccessNeeds(new FormData()).text).toBeNull();
	});

	it('counts each event’s seats for the list', async () => {
		const { event, ticket } = await publishedEvent({}, 2);
		await register(database, registration(event, ticket, accounts[0]), today);
		const counts = await seatCountsByEvent(database, [event.identifier, 'none']);
		expect(counts.get(event.identifier)).toEqual([{ attendance: 'in-person', capacity: 2, taken: 1, waiting: 0 }]);
		expect(counts.has('none')).toBe(false);
	});

	it('keeps an event’s sessions in time order, and removes one', async () => {
		const { event } = await publishedEvent();
		const second = await saveSession(database, event.identifier, null, { startsAt: later(241), endsAt: later(242), title: 'Inside the model code', about: '' });
		await saveSession(database, event.identifier, null, { startsAt: later(240), endsAt: null, title: 'Where tribal ADR comes from', about: 'History and practice' });
		expect((await sessionsOf(database, event.identifier)).map((session) => session.title)).toEqual(['Where tribal ADR comes from', 'Inside the model code']);
		await removeSession(database, event.identifier, second);
		expect(await sessionsOf(database, event.identifier)).toHaveLength(1);
		// A session must end after it starts.
		await expect(
			saveSession(database, event.identifier, null, { startsAt: later(242), endsAt: later(241), title: 'Backward', about: '' })
		).rejects.toThrow();
	});

	it('notes a material with its fingerprint and takes it off again', async () => {
		const { event } = await publishedEvent();
		await addMaterial(
			database,
			{ identifier: 'm1', eventIdentifier: event.identifier, title: 'Slides', fileName: 'slides.pdf', contentType: 'application/pdf', sizeBytes: 2048, sha256: 'a'.repeat(64), createdBy: accounts[0] },
			today
		);
		const [material] = await materialsOf(database, event.identifier);
		expect(material).toMatchObject({ title: 'Slides', objectKey: materialObjectKey(event.identifier, 'm1'), sha256: 'a'.repeat(64) });
		expect((await removeMaterial(database, event.identifier, 'm1'))?.objectKey).toBe(`event-materials/${event.identifier}/m1`);
		expect(await removeMaterial(database, event.identifier, 'm1')).toBeUndefined();
	});
});
