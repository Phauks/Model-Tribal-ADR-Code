/**
 * Events, their seats and the people registered for them
 * (migrations/20261123T0450_add_event_calendar.sql; site/COLLABORATION.md, "Events").
 *
 * Seats are counted inside the database statement that takes one, so two
 * people pressing Register for the last seat at the same moment cannot both
 * get it: D1 runs each statement on its own, one at a time (Cloudflare, "D1
 * overview", developers.cloudflare.com/d1/).
 */
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types/index.ts';
import {
	offerHoldHours,
	type Attendance,
	type EventKind,
	type EventStatus,
	type RecordingChoice,
	type RegistrationStatus,
	type SeatCount
} from '#lib/event-calendar.ts';
import { newIdentifier } from './identifiers.ts';

export interface CalendarEvent {
	identifier: string;
	slug: string;
	title: string;
	summary: string;
	description: string;
	kind: EventKind;
	startsAt: string;
	endsAt: string;
	timeZone: string;
	venueName: string | null;
	venueAddress: string | null;
	onlineLink: string | null;
	recordingLink: string | null;
	recording: RecordingChoice;
	accessNotes: string;
	status: EventStatus;
	cancelNote: string | null;
	registrationClosesAt: string | null;
	sequence: number;
	createdAt: string;
	updatedAt: string;
}

const eventColumns = `identifier, slug, title, summary, description, kind,
	starts_at AS startsAt, ends_at AS endsAt, time_zone AS timeZone,
	venue_name AS venueName, venue_address AS venueAddress,
	online_link AS onlineLink, recording_link AS recordingLink, recording,
	access_notes AS accessNotes, status, cancel_note AS cancelNote,
	registration_closes_at AS registrationClosesAt, sequence,
	created_at AS createdAt, updated_at AS updatedAt`;

export interface TicketType {
	identifier: string;
	eventIdentifier: string;
	name: string;
	attendance: Attendance;
	/** Empty means no limit. */
	capacity: number | null;
	sortOrder: number;
	/** Seats held: registered, or offered and not yet taken. */
	taken: number;
	/** People on the waitlist. */
	waiting: number;
	/** Every registration ever made for it, cancelled ones included. */
	everRegistered: number;
}

export interface Speaker {
	identifier: string;
	name: string;
	about: string;
	contributorSlug: string | null;
	sortOrder: number;
}

export interface Registration {
	identifier: string;
	eventIdentifier: string;
	ticketIdentifier: string;
	accountIdentifier: string;
	name: string;
	accessNeeds: string | null;
	wantsReminders: boolean;
	status: RegistrationStatus;
	registeredAt: string;
	offeredAt: string | null;
	offerExpiresAt: string | null;
	cancelledAt: string | null;
}

const registrationColumns = `identifier, event_identifier AS eventIdentifier, ticket_identifier AS ticketIdentifier,
	account_identifier AS accountIdentifier, name, access_needs AS accessNeeds,
	wants_reminders AS wantsReminders, status, registered_at AS registeredAt,
	offered_at AS offeredAt, offer_expires_at AS offerExpiresAt, cancelled_at AS cancelledAt`;

/** The registration columns read through a table alias, as in "r.identifier". */
function registrationColumnsOf(alias: string): string {
	return registrationColumns
		.split(',')
		.map((column) => `${alias}.${column.trim()}`)
		.join(', ');
}

type RegistrationRow = Omit<Registration, 'wantsReminders'> & { wantsReminders: number };

function registrationFromRow(row: RegistrationRow): Registration {
	return { ...row, wantsReminders: row.wantsReminders === 1 };
}

/** The statuses that hold a seat or a place in line. */
const live = `('registered', 'waitlisted', 'offered')`;

// ---------------------------------------------------------------------------
// Reading events
// ---------------------------------------------------------------------------

export async function eventBySlug(database: D1Database, slug: string): Promise<CalendarEvent | undefined> {
	const row = await database.prepare(`SELECT ${eventColumns} FROM calendar_events WHERE slug = ?`).bind(slug).first<CalendarEvent>();
	return row ?? undefined;
}

export async function eventByIdentifier(database: D1Database, identifier: string): Promise<CalendarEvent | undefined> {
	const row = await database
		.prepare(`SELECT ${eventColumns} FROM calendar_events WHERE identifier = ?`)
		.bind(identifier)
		.first<CalendarEvent>();
	return row ?? undefined;
}

/**
 * The events readers see: published and cancelled ones, never drafts.
 * Upcoming events are those not yet over, soonest first; past ones are
 * newest first.
 */
export async function listedEvents(
	database: D1Database,
	when: 'upcoming' | 'past',
	time: Date = new Date()
): Promise<CalendarEvent[]> {
	const result = await database
		.prepare(
			when === 'upcoming'
				? `SELECT ${eventColumns} FROM calendar_events
				   WHERE status IN ('published', 'cancelled') AND ends_at > ? ORDER BY starts_at, title`
				: `SELECT ${eventColumns} FROM calendar_events
				   WHERE status IN ('published', 'cancelled') AND ends_at <= ? ORDER BY starts_at DESC, title LIMIT 200`
		)
		.bind(time.toISOString())
		.all<CalendarEvent>();
	return result.results;
}

/** The events in a calendar feed: everything readers see from 90 days ago on. */
export async function feedEvents(database: D1Database, time: Date = new Date()): Promise<CalendarEvent[]> {
	const since = new Date(time.getTime() - 90 * 86_400_000).toISOString();
	const result = await database
		.prepare(
			`SELECT ${eventColumns} FROM calendar_events
			 WHERE status IN ('published', 'cancelled') AND ends_at > ? ORDER BY starts_at LIMIT 500`
		)
		.bind(since)
		.all<CalendarEvent>();
	return result.results;
}

export interface WorkspaceEventRow extends CalendarEvent {
	registered: number;
	waiting: number;
}

/** Every event, drafts included, newest start first, with how many have signed up. */
export async function allEvents(database: D1Database): Promise<WorkspaceEventRow[]> {
	const result = await database
		.prepare(
			`SELECT ${eventColumns},
			        (SELECT count(*) FROM calendar_registrations r WHERE r.event_identifier = calendar_events.identifier AND r.status IN ('registered', 'offered')) AS registered,
			        (SELECT count(*) FROM calendar_registrations r WHERE r.event_identifier = calendar_events.identifier AND r.status = 'waitlisted') AS waiting
			 FROM calendar_events ORDER BY starts_at DESC`
		)
		.all<WorkspaceEventRow>();
	return result.results;
}

export async function ticketTypesOf(database: D1Database, eventIdentifier: string): Promise<TicketType[]> {
	const result = await database
		.prepare(
			`SELECT t.identifier, t.event_identifier AS eventIdentifier, t.name, t.attendance, t.capacity, t.sort_order AS sortOrder,
			        (SELECT count(*) FROM calendar_registrations r WHERE r.ticket_identifier = t.identifier AND r.status IN ('registered', 'offered')) AS taken,
			        (SELECT count(*) FROM calendar_registrations r WHERE r.ticket_identifier = t.identifier AND r.status = 'waitlisted') AS waiting,
			        (SELECT count(*) FROM calendar_registrations r WHERE r.ticket_identifier = t.identifier) AS everRegistered
			 FROM calendar_ticket_types t WHERE t.event_identifier = ? ORDER BY t.sort_order, t.name`
		)
		.bind(eventIdentifier)
		.all<TicketType>();
	return result.results;
}

/** Each event's kinds of seat with their counts, for the seat status on the list of events. */
export async function seatCountsByEvent(database: D1Database, eventIdentifiers: readonly string[]): Promise<Map<string, SeatCount[]>> {
	const found = new Map<string, SeatCount[]>();
	if (eventIdentifiers.length === 0) return found;
	const result = await database
		.prepare(
			`SELECT t.event_identifier AS event, t.attendance, t.capacity,
			        (SELECT count(*) FROM calendar_registrations r WHERE r.ticket_identifier = t.identifier AND r.status IN ('registered', 'offered')) AS taken,
			        (SELECT count(*) FROM calendar_registrations r WHERE r.ticket_identifier = t.identifier AND r.status = 'waitlisted') AS waiting
			 FROM calendar_ticket_types t WHERE t.event_identifier IN (SELECT value FROM json_each(?)) ORDER BY t.sort_order, t.name`
		)
		.bind(JSON.stringify(eventIdentifiers))
		.all<SeatCount & { event: string }>();
	for (const { event, ...seat } of result.results) found.set(event, [...(found.get(event) ?? []), seat]);
	return found;
}

export async function speakersOf(database: D1Database, eventIdentifier: string): Promise<Speaker[]> {
	const result = await database
		.prepare(
			`SELECT identifier, name, about, contributor_slug AS contributorSlug, sort_order AS sortOrder
			 FROM calendar_speakers WHERE event_identifier = ? ORDER BY sort_order, name`
		)
		.bind(eventIdentifier)
		.all<Speaker>();
	return result.results;
}

/** Whether registration is open now: published, with seats to offer, before it closes. */
export function registrationOpen(event: CalendarEvent, tickets: readonly unknown[], time: Date = new Date()): boolean {
	return (
		event.status === 'published' &&
		tickets.length > 0 &&
		new Date(event.registrationClosesAt ?? event.startsAt).getTime() > time.getTime()
	);
}

// ---------------------------------------------------------------------------
// Changing events (the workspace)
// ---------------------------------------------------------------------------

export interface EventInput {
	slug: string;
	title: string;
	summary: string;
	description: string;
	kind: EventKind;
	startsAt: string;
	endsAt: string;
	timeZone: string;
	venueName: string | null;
	venueAddress: string | null;
	onlineLink: string | null;
	recordingLink: string | null;
	recording: RecordingChoice;
	accessNotes: string;
	registrationClosesAt: string | null;
}

export type SaveResult = { saved: true; identifier: string } | { saved: false; problem: string };

function isUniqueProblem(problem: unknown): boolean {
	return problem instanceof Error && /UNIQUE/i.test(problem.message);
}

/** Adds an event as a draft. */
export async function createEvent(
	database: D1Database,
	input: EventInput,
	personIdentifier: string | null,
	time: Date = new Date()
): Promise<SaveResult> {
	const identifier = newIdentifier();
	const stamp = time.toISOString();
	try {
		await database
			.prepare(
				`INSERT INTO calendar_events (identifier, slug, title, summary, description, kind, starts_at, ends_at, time_zone,
				   venue_name, venue_address, online_link, recording_link, recording, access_notes, registration_closes_at,
				   status, created_by, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`
			)
			.bind(
				identifier,
				input.slug,
				input.title,
				input.summary,
				input.description,
				input.kind,
				input.startsAt,
				input.endsAt,
				input.timeZone,
				input.venueName,
				input.venueAddress,
				input.onlineLink,
				input.recordingLink,
				input.recording,
				input.accessNotes,
				input.registrationClosesAt,
				personIdentifier,
				stamp,
				stamp
			)
			.run();
	} catch (problem) {
		if (isUniqueProblem(problem)) return { saved: false, problem: 'Another event already uses that address. Choose another.' };
		throw problem;
	}
	return { saved: true, identifier };
}

/** Whether a change moves the event or changes how to get there. */
export function changesTimeOrPlace(before: CalendarEvent, after: EventInput): boolean {
	return (
		before.startsAt !== after.startsAt ||
		before.endsAt !== after.endsAt ||
		before.timeZone !== after.timeZone ||
		(before.venueName ?? '') !== (after.venueName ?? '') ||
		(before.venueAddress ?? '') !== (after.venueAddress ?? '') ||
		(before.onlineLink ?? '') !== (after.onlineLink ?? '')
	);
}

/**
 * Saves an event's details. When a published event's time or place changes,
 * its sequence goes up: calendar programs replace their copy, and everyone
 * signed up is emailed about the change once.
 */
export async function updateEvent(
	database: D1Database,
	before: CalendarEvent,
	input: EventInput,
	time: Date = new Date()
): Promise<SaveResult> {
	const bump = before.status !== 'draft' && changesTimeOrPlace(before, input) ? 1 : 0;
	try {
		await database
			.prepare(
				`UPDATE calendar_events SET slug = ?, title = ?, summary = ?, description = ?, kind = ?, starts_at = ?, ends_at = ?,
				   time_zone = ?, venue_name = ?, venue_address = ?, online_link = ?, recording_link = ?, recording = ?,
				   access_notes = ?, registration_closes_at = ?, sequence = sequence + ?, updated_at = ?
				 WHERE identifier = ?`
			)
			.bind(
				input.slug,
				input.title,
				input.summary,
				input.description,
				input.kind,
				input.startsAt,
				input.endsAt,
				input.timeZone,
				input.venueName,
				input.venueAddress,
				input.onlineLink,
				input.recordingLink,
				input.recording,
				input.accessNotes,
				input.registrationClosesAt,
				bump,
				time.toISOString(),
				before.identifier
			)
			.run();
	} catch (problem) {
		if (isUniqueProblem(problem)) return { saved: false, problem: 'Another event already uses that address. Choose another.' };
		throw problem;
	}
	if (input.startsAt !== before.startsAt) await offerFreeSeatsForEvent(database, before.identifier, time);
	return { saved: true, identifier: before.identifier };
}

async function registrationCount(database: D1Database, eventIdentifier: string): Promise<number> {
	const row = await database
		.prepare(`SELECT count(*) AS count FROM calendar_registrations WHERE event_identifier = ?`)
		.bind(eventIdentifier)
		.first<{ count: number }>();
	return row?.count ?? 0;
}

export type StatusChange = 'publish' | 'unpublish' | 'cancel' | 'delete';

/**
 * Publishes, unpublishes, cancels or deletes an event. An event anyone has
 * registered for cannot go back to a draft or be deleted, only cancelled,
 * so the people registered are told.
 */
export async function changeEventStatus(
	database: D1Database,
	event: CalendarEvent,
	change: StatusChange,
	cancelNote: string | null = null,
	time: Date = new Date()
): Promise<{ done: true } | { done: false; problem: string }> {
	const stamp = time.toISOString();
	if (change === 'publish') {
		if (event.status === 'cancelled') return { done: false, problem: 'A cancelled event cannot be published again. Add a new event.' };
		await database
			.prepare(`UPDATE calendar_events SET status = 'published', updated_at = ? WHERE identifier = ?`)
			.bind(stamp, event.identifier)
			.run();
		return { done: true };
	}
	if (change === 'cancel') {
		if (event.status !== 'published') return { done: false, problem: 'Only a published event can be cancelled.' };
		await database
			.prepare(
				`UPDATE calendar_events SET status = 'cancelled', cancel_note = ?, sequence = sequence + 1, updated_at = ? WHERE identifier = ?`
			)
			.bind(cancelNote, stamp, event.identifier)
			.run();
		return { done: true };
	}
	if ((await registrationCount(database, event.identifier)) > 0) {
		return { done: false, problem: 'People have registered for this event, so it can only be cancelled, which tells them.' };
	}
	if (change === 'unpublish') {
		await database
			.prepare(`UPDATE calendar_events SET status = 'draft', updated_at = ? WHERE identifier = ? AND status = 'published'`)
			.bind(stamp, event.identifier)
			.run();
		return { done: true };
	}
	if (event.status !== 'draft') return { done: false, problem: 'Only a draft can be deleted.' };
	await database.prepare(`DELETE FROM calendar_events WHERE identifier = ?`).bind(event.identifier).run();
	return { done: true };
}

export interface TicketInput {
	name: string;
	attendance: Attendance;
	capacity: number | null;
	sortOrder: number;
}

/** Adds a kind of seat, or changes one. Raising a limit offers the new seats to the waitlist. */
export async function saveTicketType(
	database: D1Database,
	eventIdentifier: string,
	ticketIdentifier: string | null,
	input: TicketInput,
	time: Date = new Date()
): Promise<string> {
	const identifier = ticketIdentifier ?? newIdentifier();
	if (ticketIdentifier) {
		await database
			.prepare(
				`UPDATE calendar_ticket_types SET name = ?, attendance = ?, capacity = ?, sort_order = ?
				 WHERE identifier = ? AND event_identifier = ?`
			)
			.bind(input.name, input.attendance, input.capacity, input.sortOrder, identifier, eventIdentifier)
			.run();
		await offerFreeSeats(database, identifier, time);
	} else {
		await database
			.prepare(
				`INSERT INTO calendar_ticket_types (identifier, event_identifier, name, attendance, capacity, sort_order)
				 VALUES (?, ?, ?, ?, ?, ?)`
			)
			.bind(identifier, eventIdentifier, input.name, input.attendance, input.capacity, input.sortOrder)
			.run();
	}
	return identifier;
}

/** Removes a kind of seat nobody has ever registered for. */
export async function removeTicketType(database: D1Database, eventIdentifier: string, ticketIdentifier: string): Promise<boolean> {
	const result = await database
		.prepare(
			`DELETE FROM calendar_ticket_types WHERE identifier = ? AND event_identifier = ?
			 AND NOT EXISTS (SELECT 1 FROM calendar_registrations WHERE ticket_identifier = ?)`
		)
		.bind(ticketIdentifier, eventIdentifier, ticketIdentifier)
		.run();
	return result.meta.changes > 0;
}

export interface SpeakerInput {
	name: string;
	about: string;
	contributorSlug: string | null;
	sortOrder: number;
}

export async function saveSpeaker(
	database: D1Database,
	eventIdentifier: string,
	speakerIdentifier: string | null,
	input: SpeakerInput
): Promise<void> {
	if (speakerIdentifier) {
		await database
			.prepare(
				`UPDATE calendar_speakers SET name = ?, about = ?, contributor_slug = ?, sort_order = ? WHERE identifier = ? AND event_identifier = ?`
			)
			.bind(input.name, input.about, input.contributorSlug, input.sortOrder, speakerIdentifier, eventIdentifier)
			.run();
		return;
	}
	await database
		.prepare(
			`INSERT INTO calendar_speakers (identifier, event_identifier, name, about, contributor_slug, sort_order) VALUES (?, ?, ?, ?, ?, ?)`
		)
		.bind(newIdentifier(), eventIdentifier, input.name, input.about, input.contributorSlug, input.sortOrder)
		.run();
}

export async function removeSpeaker(database: D1Database, eventIdentifier: string, speakerIdentifier: string): Promise<void> {
	await database
		.prepare(`DELETE FROM calendar_speakers WHERE identifier = ? AND event_identifier = ?`)
		.bind(speakerIdentifier, eventIdentifier)
		.run();
}

// ---------------------------------------------------------------------------
// Sessions and materials
// ---------------------------------------------------------------------------

export interface EventSession {
	identifier: string;
	startsAt: string;
	endsAt: string | null;
	title: string;
	about: string;
}

export interface SessionInput {
	startsAt: Date;
	endsAt: Date | null;
	title: string;
	about: string;
}

/** An event's schedule, earliest first. */
export async function sessionsOf(database: D1Database, eventIdentifier: string): Promise<EventSession[]> {
	const result = await database
		.prepare(
			`SELECT identifier, starts_at AS startsAt, ends_at AS endsAt, title, about
			 FROM calendar_sessions WHERE event_identifier = ? ORDER BY starts_at, title`
		)
		.bind(eventIdentifier)
		.all<EventSession>();
	return result.results;
}

/** Adds a session, or changes one already on the event. */
export async function saveSession(database: D1Database, eventIdentifier: string, sessionIdentifier: string | null, input: SessionInput): Promise<string> {
	const values = [input.startsAt.toISOString(), input.endsAt?.toISOString() ?? null, input.title.slice(0, 200), input.about.slice(0, 500)];
	if (sessionIdentifier) {
		await database
			.prepare(`UPDATE calendar_sessions SET starts_at = ?, ends_at = ?, title = ?, about = ? WHERE identifier = ? AND event_identifier = ?`)
			.bind(...values, sessionIdentifier, eventIdentifier)
			.run();
		return sessionIdentifier;
	}
	const identifier = newIdentifier();
	await database
		.prepare(`INSERT INTO calendar_sessions (identifier, event_identifier, starts_at, ends_at, title, about) VALUES (?, ?, ?, ?, ?, ?)`)
		.bind(identifier, eventIdentifier, ...values)
		.run();
	return identifier;
}

export async function removeSession(database: D1Database, eventIdentifier: string, sessionIdentifier: string): Promise<void> {
	await database.prepare(`DELETE FROM calendar_sessions WHERE identifier = ? AND event_identifier = ?`).bind(sessionIdentifier, eventIdentifier).run();
}

export interface EventMaterial {
	identifier: string;
	title: string;
	fileName: string;
	objectKey: string;
	contentType: string;
	sizeBytes: number;
	sha256: string;
	createdAt: string;
}

const materialColumns = `identifier, title, file_name AS fileName, object_key AS objectKey, content_type AS contentType,
	size_bytes AS sizeBytes, sha256, created_at AS createdAt`;

/** Where a material's file is kept in the private bucket. */
export function materialObjectKey(eventIdentifier: string, materialIdentifier: string): string {
	return `event-materials/${eventIdentifier}/${materialIdentifier}`;
}

/** The largest file the workspace takes as a material. */
export const largestMaterialBytes = 25 * 1024 * 1024;

export async function materialsOf(database: D1Database, eventIdentifier: string): Promise<EventMaterial[]> {
	const result = await database
		.prepare(`SELECT ${materialColumns} FROM calendar_materials WHERE event_identifier = ? ORDER BY created_at, title`)
		.bind(eventIdentifier)
		.all<EventMaterial>();
	return result.results;
}

export async function materialOf(database: D1Database, eventIdentifier: string, materialIdentifier: string): Promise<EventMaterial | undefined> {
	const row = await database
		.prepare(`SELECT ${materialColumns} FROM calendar_materials WHERE identifier = ? AND event_identifier = ?`)
		.bind(materialIdentifier, eventIdentifier)
		.first<EventMaterial>();
	return row ?? undefined;
}

/** Notes a material whose file is already stored and in line for the scanner. */
export async function addMaterial(
	database: D1Database,
	input: { identifier: string; eventIdentifier: string; title: string; fileName: string; contentType: string; sizeBytes: number; sha256: string; createdBy: string | null },
	time: Date = new Date()
): Promise<void> {
	await database
		.prepare(
			`INSERT INTO calendar_materials (identifier, event_identifier, title, file_name, object_key, content_type, size_bytes, sha256, created_by, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			input.identifier,
			input.eventIdentifier,
			input.title.slice(0, 200),
			input.fileName.slice(0, 200),
			materialObjectKey(input.eventIdentifier, input.identifier),
			input.contentType,
			input.sizeBytes,
			input.sha256,
			input.createdBy,
			time.toISOString()
		)
		.run();
}

/** Takes a material off the event and returns it, so its file can be deleted too. */
export async function removeMaterial(database: D1Database, eventIdentifier: string, materialIdentifier: string): Promise<EventMaterial | undefined> {
	const found = await materialOf(database, eventIdentifier, materialIdentifier);
	if (!found) return undefined;
	await database.prepare(`DELETE FROM calendar_materials WHERE identifier = ? AND event_identifier = ?`).bind(materialIdentifier, eventIdentifier).run();
	return found;
}

// ---------------------------------------------------------------------------
// Registering
// ---------------------------------------------------------------------------

export interface RegistrationInput {
	eventIdentifier: string;
	ticketIdentifier: string;
	accountIdentifier: string;
	name: string;
	accessNeeds: string | null;
	wantsReminders: boolean;
}

export type RegisterResult =
	| { kind: 'registered' | 'waitlisted'; identifier: string }
	| { kind: 'closed' | 'already' };

/**
 * Registers someone, or puts them on the waitlist when the seats are taken.
 * A seat goes to a newcomer only while nobody is waiting for that kind of
 * seat, so the waitlist is served first. The count and the insert are one
 * statement.
 */
export async function register(database: D1Database, input: RegistrationInput, time: Date = new Date()): Promise<RegisterResult> {
	const identifier = newIdentifier();
	const stamp = time.toISOString();
	let changes: number;
	try {
		const result = await database
			.prepare(
				`INSERT INTO calendar_registrations (identifier, event_identifier, ticket_identifier, account_identifier, name,
				   access_needs, wants_reminders, status, registered_at, told_sequence, updated_at)
				 SELECT ?, e.identifier, t.identifier, ?, ?, ?, ?,
				   CASE WHEN t.capacity IS NULL OR (
				       (SELECT count(*) FROM calendar_registrations r WHERE r.ticket_identifier = t.identifier AND r.status IN ('registered', 'offered')) < t.capacity
				       AND NOT EXISTS (SELECT 1 FROM calendar_registrations r WHERE r.ticket_identifier = t.identifier AND r.status = 'waitlisted')
				     ) THEN 'registered' ELSE 'waitlisted' END,
				   ?, e.sequence, ?
				 FROM calendar_ticket_types t JOIN calendar_events e ON e.identifier = t.event_identifier
				 WHERE t.identifier = ? AND e.identifier = ? AND e.status = 'published'
				   AND coalesce(e.registration_closes_at, e.starts_at) > ?`
			)
			.bind(
				identifier,
				input.accountIdentifier,
				input.name,
				input.accessNeeds,
				input.wantsReminders ? 1 : 0,
				stamp,
				stamp,
				input.ticketIdentifier,
				input.eventIdentifier,
				stamp
			)
			.run();
		changes = result.meta.changes;
	} catch (problem) {
		if (isUniqueProblem(problem)) return { kind: 'already' };
		throw problem;
	}
	if (changes === 0) return { kind: 'closed' };
	const row = await database
		.prepare(`SELECT status FROM calendar_registrations WHERE identifier = ?`)
		.bind(identifier)
		.first<{ status: 'registered' | 'waitlisted' }>();
	return { kind: row?.status ?? 'registered', identifier };
}

export interface OwnRegistration extends Registration {
	ticketName: string;
	attendance: Attendance;
	/** Place in line, counting from 1, while on the waitlist. */
	waitlistPlace: number | null;
}

/** Someone's live registration for an event, if they have one. */
export async function registrationFor(
	database: D1Database,
	eventIdentifier: string,
	accountIdentifier: string
): Promise<OwnRegistration | undefined> {
	const row = await database
		.prepare(
			`SELECT ${registrationColumnsOf('r')},
			        t.name AS ticketName, t.attendance,
			        CASE WHEN r.status = 'waitlisted' THEN (
			          SELECT count(*) FROM calendar_registrations w
			          WHERE w.ticket_identifier = r.ticket_identifier AND w.status = 'waitlisted'
			            AND (w.registered_at < r.registered_at OR (w.registered_at = r.registered_at AND w.rowid <= r.rowid))
			        ) END AS waitlistPlace
			 FROM calendar_registrations r JOIN calendar_ticket_types t ON t.identifier = r.ticket_identifier
			 WHERE r.event_identifier = ? AND r.account_identifier = ? AND r.status IN ${live}`
		)
		.bind(eventIdentifier, accountIdentifier)
		.first<RegistrationRow & { ticketName: string; attendance: Attendance; waitlistPlace: number | null }>();
	if (!row) return undefined;
	return { ...row, wantsReminders: row.wantsReminders === 1 };
}

export interface AccountEvent {
	registrationIdentifier: string;
	status: RegistrationStatus;
	ticketName: string;
	slug: string;
	title: string;
	startsAt: string;
	endsAt: string;
	timeZone: string;
	eventStatus: EventStatus;
}

/** The events someone is registered or waiting for that are not over yet, soonest first. */
export async function eventsForAccount(
	database: D1Database,
	accountIdentifier: string,
	time: Date = new Date()
): Promise<AccountEvent[]> {
	const result = await database
		.prepare(
			`SELECT r.identifier AS registrationIdentifier, r.status, t.name AS ticketName, e.slug, e.title,
			        e.starts_at AS startsAt, e.ends_at AS endsAt, e.time_zone AS timeZone, e.status AS eventStatus
			 FROM calendar_registrations r
			 JOIN calendar_events e ON e.identifier = r.event_identifier
			 JOIN calendar_ticket_types t ON t.identifier = r.ticket_identifier
			 WHERE r.account_identifier = ? AND r.status IN ${live} AND e.ends_at > ? AND e.status <> 'draft'
			 ORDER BY e.starts_at`
		)
		.bind(accountIdentifier, time.toISOString())
		.all<AccountEvent>();
	return result.results;
}

/** Takes a seat offered from the waitlist, while the offer lasts. */
export async function acceptOffer(
	database: D1Database,
	registrationIdentifier: string,
	accountIdentifier: string,
	time: Date = new Date()
): Promise<boolean> {
	const stamp = time.toISOString();
	const result = await database
		.prepare(
			`UPDATE calendar_registrations SET status = 'registered', updated_at = ?
			 WHERE identifier = ? AND account_identifier = ? AND status = 'offered' AND offer_expires_at > ?`
		)
		.bind(stamp, registrationIdentifier, accountIdentifier, stamp)
		.run();
	return result.meta.changes > 0;
}

/**
 * Gives up a seat, a place on the waitlist or an offered seat. A freed seat
 * is offered to the next person waiting.
 */
export async function cancelRegistration(
	database: D1Database,
	registrationIdentifier: string,
	accountIdentifier: string,
	time: Date = new Date()
): Promise<boolean> {
	const stamp = time.toISOString();
	const row = await database
		.prepare(`SELECT ticket_identifier AS ticket FROM calendar_registrations WHERE identifier = ? AND account_identifier = ?`)
		.bind(registrationIdentifier, accountIdentifier)
		.first<{ ticket: string }>();
	if (!row) return false;
	const result = await database
		.prepare(
			`UPDATE calendar_registrations SET status = 'cancelled', cancelled_at = ?, updated_at = ?
			 WHERE identifier = ? AND account_identifier = ? AND status IN ${live}`
		)
		.bind(stamp, stamp, registrationIdentifier, accountIdentifier)
		.run();
	if (result.meta.changes === 0) return false;
	await offerFreeSeats(database, row.ticket, time);
	return true;
}

function offerStatement(database: D1Database, ticketIdentifier: string, time: Date): D1PreparedStatement {
	const stamp = time.toISOString();
	const hold = new Date(time.getTime() + offerHoldHours * 3_600_000).toISOString();
	// The seats free on this ticket go to the people waiting longest. The
	// event must be published and not started yet.
	return database
		.prepare(
			`UPDATE calendar_registrations
			 SET status = 'offered', offered_at = ?, updated_at = ?,
			     offer_expires_at = min(?, (SELECT e.starts_at FROM calendar_events e WHERE e.identifier = calendar_registrations.event_identifier))
			 WHERE identifier IN (
			   SELECT w.identifier FROM calendar_registrations w
			   JOIN calendar_ticket_types t ON t.identifier = w.ticket_identifier
			   JOIN calendar_events e ON e.identifier = t.event_identifier
			   WHERE w.ticket_identifier = ? AND w.status = 'waitlisted' AND e.status = 'published' AND e.starts_at > ?
			   ORDER BY w.registered_at, w.rowid
			   LIMIT max(0, coalesce(
			     (SELECT t2.capacity FROM calendar_ticket_types t2 WHERE t2.identifier = ?)
			       - (SELECT count(*) FROM calendar_registrations r WHERE r.ticket_identifier = ? AND r.status IN ('registered', 'offered')),
			     1000000))
			 )`
		)
		.bind(stamp, stamp, hold, ticketIdentifier, stamp, ticketIdentifier, ticketIdentifier);
}

/** Offers each free seat on a ticket to the next person on its waitlist. Returns how many were offered. */
export async function offerFreeSeats(database: D1Database, ticketIdentifier: string, time: Date = new Date()): Promise<number> {
	const result = await offerStatement(database, ticketIdentifier, time).run();
	return result.meta.changes;
}

async function offerFreeSeatsForEvent(database: D1Database, eventIdentifier: string, time: Date): Promise<void> {
	for (const ticket of await ticketTypesOf(database, eventIdentifier)) await offerFreeSeats(database, ticket.identifier, time);
}

/**
 * Lets offers that ran out lapse, then offers their seats on. Run every hour
 * and before showing an event, so a stale offer never holds a seat for long.
 */
export async function expireOffers(database: D1Database, time: Date = new Date()): Promise<number> {
	const stamp = time.toISOString();
	const lapsed = await database
		.prepare(
			`SELECT DISTINCT ticket_identifier AS ticket FROM calendar_registrations WHERE status = 'offered' AND offer_expires_at <= ?`
		)
		.bind(stamp)
		.all<{ ticket: string }>();
	if (lapsed.results.length === 0) return 0;
	const result = await database
		.prepare(`UPDATE calendar_registrations SET status = 'lapsed', updated_at = ? WHERE status = 'offered' AND offer_expires_at <= ?`)
		.bind(stamp, stamp)
		.run();
	for (const { ticket } of lapsed.results) await offerFreeSeats(database, ticket, time);
	return result.meta.changes;
}

/** Offers free seats on every event that has not started, such as after a limit was raised. */
export async function offerAllFreeSeats(database: D1Database, time: Date = new Date()): Promise<number> {
	const tickets = await database
		.prepare(
			`SELECT DISTINCT r.ticket_identifier AS ticket FROM calendar_registrations r
			 JOIN calendar_events e ON e.identifier = r.event_identifier
			 WHERE r.status = 'waitlisted' AND e.status = 'published' AND e.starts_at > ?`
		)
		.bind(time.toISOString())
		.all<{ ticket: string }>();
	let offered = 0;
	for (const { ticket } of tickets.results) offered += await offerFreeSeats(database, ticket, time);
	return offered;
}

export interface RegistrationListing extends Registration {
	ticketName: string;
	attendance: Attendance;
	email: string;
}

/** Everyone who registered for an event, for the people running it. */
export async function registrationsOf(database: D1Database, eventIdentifier: string): Promise<RegistrationListing[]> {
	const result = await database
		.prepare(
			`SELECT r.identifier, r.event_identifier AS eventIdentifier, r.ticket_identifier AS ticketIdentifier,
			        r.account_identifier AS accountIdentifier, r.name, r.access_needs AS accessNeeds,
			        r.wants_reminders AS wantsReminders, r.status, r.registered_at AS registeredAt,
			        r.offered_at AS offeredAt, r.offer_expires_at AS offerExpiresAt, r.cancelled_at AS cancelledAt,
			        t.name AS ticketName, t.attendance, a.email
			 FROM calendar_registrations r
			 JOIN calendar_ticket_types t ON t.identifier = r.ticket_identifier
			 JOIN accounts a ON a.identifier = r.account_identifier
			 WHERE r.event_identifier = ?
			 ORDER BY CASE r.status WHEN 'registered' THEN 0 WHEN 'offered' THEN 1 WHEN 'waitlisted' THEN 2 ELSE 3 END,
			          t.sort_order, r.registered_at, r.rowid`
		)
		.bind(eventIdentifier)
		.all<RegistrationRow & { ticketName: string; attendance: Attendance; email: string }>();
	return result.results.map((row) => ({ ...registrationFromRow(row), ticketName: row.ticketName, attendance: row.attendance, email: row.email }));
}

/** Days after an event ends that people's access needs are kept. */
export const accessNeedsKeptDays = 30;

/** Empties access needs 30 days after each event ends. */
export async function clearOldAccessNeeds(database: D1Database, time: Date = new Date()): Promise<number> {
	const before = new Date(time.getTime() - accessNeedsKeptDays * 86_400_000).toISOString();
	const result = await database
		.prepare(
			`UPDATE calendar_registrations SET access_needs = NULL
			 WHERE access_needs IS NOT NULL
			   AND event_identifier IN (SELECT identifier FROM calendar_events WHERE ends_at <= ?)`
		)
		.bind(before)
		.run();
	return result.meta.changes;
}

// ---------------------------------------------------------------------------
// Emails due
// ---------------------------------------------------------------------------

export const messageKinds = ['registered', 'waitlisted', 'offered', 'day-before', 'starting-soon', 'changed', 'cancelled'] as const;
export type MessageKind = (typeof messageKinds)[number];

export interface DueMessage {
	kind: MessageKind;
	/** The event's sequence for 'changed'; 0 otherwise. */
	sequence: number;
	registration: Registration;
	email: string;
	ticketName: string;
	attendance: Attendance;
	event: CalendarEvent;
}

/**
 * The emails due now. Confirmations go only for registrations made in the
 * last two days, so turning email on later does not send old ones. Reminders
 * go to people who asked for them: one when the event is a day away (to
 * people who registered at least a day before it), and one when it is two
 * hours away.
 */
export async function dueMessages(database: D1Database, time: Date = new Date()): Promise<DueMessage[]> {
	const stamp = time.toISOString();
	const hour = 3_600_000;
	const recent = new Date(time.getTime() - 48 * hour).toISOString();
	const dayAway = new Date(time.getTime() + 26 * hour).toISOString();
	const twoHours = new Date(time.getTime() + 2 * hour).toISOString();
	const cancelledSince = new Date(time.getTime() - 24 * hour).toISOString();
	const sent = (kind: string, sequence = '0') =>
		`NOT EXISTS (SELECT 1 FROM calendar_messages m WHERE m.registration_identifier = r.identifier AND m.kind = '${kind}' AND m.sequence = ${sequence})`;
	// D1 allows at most five SELECTs joined by UNION in one statement (a
	// compound SELECT with more fails with "too many terms in compound
	// SELECT"), so the seven kinds are asked in two statements.
	type DueRow = { kind: MessageKind; sequence: number; registrationIdentifier: string };
	const [first, second] = await Promise.all([
		database
			.prepare(
				`SELECT kind, sequence, registrationIdentifier FROM (
			   SELECT 'registered' AS kind, 0 AS sequence, r.identifier AS registrationIdentifier
			   FROM calendar_registrations r JOIN calendar_events e ON e.identifier = r.event_identifier
			   WHERE r.status = 'registered' AND e.status = 'published' AND e.starts_at > ?1 AND r.updated_at > ?2 AND ${sent('registered')}
			   UNION ALL
			   SELECT 'waitlisted', 0, r.identifier
			   FROM calendar_registrations r JOIN calendar_events e ON e.identifier = r.event_identifier
			   WHERE r.status = 'waitlisted' AND e.status = 'published' AND e.starts_at > ?1 AND r.registered_at > ?2 AND ${sent('waitlisted')}
			   UNION ALL
			   SELECT 'offered', 0, r.identifier
			   FROM calendar_registrations r JOIN calendar_events e ON e.identifier = r.event_identifier
			   WHERE r.status = 'offered' AND e.status = 'published' AND r.offer_expires_at > ?1 AND ${sent('offered')}
			   UNION ALL
			   SELECT 'day-before', 0, r.identifier
			   FROM calendar_registrations r JOIN calendar_events e ON e.identifier = r.event_identifier
			   WHERE r.status = 'registered' AND r.wants_reminders = 1 AND e.status = 'published'
			     AND e.starts_at > ?4 AND e.starts_at <= ?3
			     AND r.registered_at <= strftime('%Y-%m-%dT%H:%M:%fZ', e.starts_at, '-1 day') AND ${sent('day-before')}
			 ) LIMIT 500`
			)
			.bind(stamp, recent, dayAway, twoHours)
			.all<DueRow>(),
		database
			.prepare(
				`SELECT kind, sequence, registrationIdentifier FROM (
			   SELECT 'starting-soon' AS kind, 0 AS sequence, r.identifier AS registrationIdentifier
			   FROM calendar_registrations r JOIN calendar_events e ON e.identifier = r.event_identifier
			   WHERE r.status = 'registered' AND r.wants_reminders = 1 AND e.status = 'published'
			     AND e.starts_at > ?1 AND e.starts_at <= ?4 AND ${sent('starting-soon')}
			   UNION ALL
			   SELECT 'changed', e.sequence, r.identifier
			   FROM calendar_registrations r JOIN calendar_events e ON e.identifier = r.event_identifier
			   WHERE r.status IN ${live} AND e.status = 'published' AND e.ends_at > ?1
			     AND e.sequence > r.told_sequence AND ${sent('changed', 'e.sequence')}
			   UNION ALL
			   SELECT 'cancelled', 0, r.identifier
			   FROM calendar_registrations r JOIN calendar_events e ON e.identifier = r.event_identifier
			   WHERE r.status IN ${live} AND e.status = 'cancelled' AND e.starts_at > ?5 AND ${sent('cancelled')}
			 ) LIMIT 500`
			)
			.bind(stamp, recent, dayAway, twoHours, cancelledSince)
			.all<DueRow>()
	]);
	const result = { results: [...first.results, ...second.results].slice(0, 500) };
	const due: DueMessage[] = [];
	const events = new Map<string, CalendarEvent>();
	for (const row of result.results) {
		const detail = await database
			.prepare(
				`SELECT ${registrationColumnsOf('r')},
				        a.email, t.name AS ticketName, t.attendance
				 FROM calendar_registrations r
				 JOIN accounts a ON a.identifier = r.account_identifier
				 JOIN calendar_ticket_types t ON t.identifier = r.ticket_identifier
				 WHERE r.identifier = ?`
			)
			.bind(row.registrationIdentifier)
			.first<RegistrationRow & { email: string; ticketName: string; attendance: Attendance }>();
		if (!detail) continue;
		let event = events.get(detail.eventIdentifier);
		if (!event) {
			event = await eventByIdentifier(database, detail.eventIdentifier);
			if (!event) continue;
			events.set(event.identifier, event);
		}
		const { email, ticketName, attendance, ...registration } = detail;
		due.push({ kind: row.kind, sequence: row.sequence, registration: registrationFromRow(registration), email, ticketName, attendance, event });
	}
	// A person told about a change or a cancellation needs no confirmation
	// or reminder from the same run; those come later if still due.
	const told = new Set(due.filter((item) => item.kind === 'changed' || item.kind === 'cancelled').map((item) => item.registration.identifier));
	return due.filter((item) => item.kind === 'changed' || item.kind === 'cancelled' || !told.has(item.registration.identifier));
}

/**
 * Claims an email before sending it, so it goes once even if two runs
 * overlap. Returns false when it was already claimed.
 */
export async function claimMessage(database: D1Database, message: DueMessage, time: Date = new Date()): Promise<boolean> {
	const result = await database
		.prepare(
			`INSERT INTO calendar_messages (registration_identifier, kind, sequence, sent_at) VALUES (?, ?, ?, ?)
			 ON CONFLICT DO NOTHING`
		)
		.bind(message.registration.identifier, message.kind, message.sequence, time.toISOString())
		.run();
	if (result.meta.changes === 0) return false;
	if (message.kind === 'changed') {
		await database
			.prepare(`UPDATE calendar_registrations SET told_sequence = max(told_sequence, ?) WHERE identifier = ?`)
			.bind(message.sequence, message.registration.identifier)
			.run();
	}
	return true;
}

/** Gives a claim back after sending failed, so the next run tries again. */
export async function releaseMessage(database: D1Database, message: DueMessage): Promise<void> {
	await database
		.prepare(`DELETE FROM calendar_messages WHERE registration_identifier = ? AND kind = ? AND sequence = ?`)
		.bind(message.registration.identifier, message.kind, message.sequence)
		.run();
}
