-- Adds the tables for events, their seats, speakers and registrations.
-- Design: site/COLLABORATION.md, "Events", and decision record 0048. The
-- project lists talks, panels, workshops and gatherings at /events. Readers who are
-- signed in register for a seat, join a waitlist when seats run out, and get
-- a confirmation and reminders by email once the site can send it.
--
-- The tables are named calendar_* because "events" is already the activity
-- log (migrations/0001_sign_in_and_collaboration.sql).
--
-- Times are stored in UTC, as ISO 8601 text. Each event also keeps the time
-- zone it is held in, so pages and emails show its time the way people at the
-- event read it.

CREATE TABLE calendar_events (
	identifier TEXT PRIMARY KEY,
	-- The event's address: /events/<slug>. Lowercase letters, digits and hyphens.
	slug TEXT NOT NULL UNIQUE CHECK (
		length(slug) BETWEEN 1 AND 80 AND slug NOT GLOB '*[^a-z0-9-]*' AND slug NOT GLOB '-*' AND slug NOT GLOB '*-'
	),
	title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
	-- One or two sentences for the list of events.
	summary TEXT NOT NULL DEFAULT '' CHECK (length(summary) <= 400),
	-- Plain text; a blank line starts a new paragraph.
	description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 20000),
	kind TEXT NOT NULL CHECK (kind IN ('talk', 'panel', 'workshop', 'gathering')),
	starts_at TEXT NOT NULL,
	ends_at TEXT NOT NULL CHECK (ends_at > starts_at),
	-- An IANA time zone from src/lib/event-calendar.ts, such as America/Los_Angeles.
	time_zone TEXT NOT NULL,
	-- Where to go in person, if anywhere.
	venue_name TEXT CHECK (length(venue_name) <= 200),
	venue_address TEXT CHECK (length(venue_address) <= 400),
	-- The meeting or stream link (Zoom, YouTube or another). Shown only to
	-- people registered for an online seat, unless the event takes no
	-- registration, when it is shown to everyone.
	online_link TEXT CHECK (online_link IS NULL OR (online_link GLOB 'https://*' AND length(online_link) <= 500)),
	-- The recording, once there is one, shown on the event's page after it ends.
	recording_link TEXT CHECK (recording_link IS NULL OR (recording_link GLOB 'https://*' AND length(recording_link) <= 500)),
	-- Whether the event will be recorded, told to people before they register.
	recording TEXT NOT NULL DEFAULT 'undecided' CHECK (recording IN ('recorded', 'not-recorded', 'undecided')),
	-- Captions, interpreters, step-free entry, and whom to ask for more.
	access_notes TEXT NOT NULL DEFAULT '' CHECK (length(access_notes) <= 2000),
	-- 'draft' events are seen only in the workspace.
	status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled')),
	-- Why it was cancelled, shown on its page and in the email.
	cancel_note TEXT CHECK (length(cancel_note) <= 1000),
	-- When registration closes; empty means when the event starts.
	registration_closes_at TEXT,
	-- Raised each time the time or place of a published event changes, so
	-- calendar programs replace their copy (RFC 5545, "SEQUENCE") and
	-- registered people are told once about each change.
	sequence INTEGER NOT NULL DEFAULT 0,
	-- Who made it: an identifier in people. Not a foreign key, so that
	-- rebuilding people in a later migration leaves events alone.
	created_by TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE INDEX calendar_events_by_start ON calendar_events (status, starts_at);

-- The kinds of seat an event offers, such as "In person" and "Online", each
-- with its own limit. An event with none takes no registration.
CREATE TABLE calendar_ticket_types (
	identifier TEXT PRIMARY KEY,
	event_identifier TEXT NOT NULL REFERENCES calendar_events (identifier) ON DELETE CASCADE,
	name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
	attendance TEXT NOT NULL CHECK (attendance IN ('in-person', 'online')),
	-- How many seats; empty means no limit.
	capacity INTEGER CHECK (capacity IS NULL OR capacity >= 0),
	sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX calendar_ticket_types_by_event ON calendar_ticket_types (event_identifier, sort_order);

-- The people speaking. A speaker credited on the website can link to their
-- contributor page; anyone else is a name and a line about them.
CREATE TABLE calendar_speakers (
	identifier TEXT PRIMARY KEY,
	event_identifier TEXT NOT NULL REFERENCES calendar_events (identifier) ON DELETE CASCADE,
	name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
	-- Such as "Chief Judge, Navajo Nation Supreme Court".
	about TEXT NOT NULL DEFAULT '' CHECK (length(about) <= 300),
	-- The contributor page's slug, /contributors/<slug>, linked only while
	-- that page is public.
	contributor_slug TEXT,
	sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX calendar_speakers_by_event ON calendar_speakers (event_identifier, sort_order);

-- One row each time someone registers or joins a waitlist. Cancelling keeps
-- the row (status 'cancelled'), and registering again adds a new one.
CREATE TABLE calendar_registrations (
	identifier TEXT PRIMARY KEY,
	event_identifier TEXT NOT NULL REFERENCES calendar_events (identifier) ON DELETE CASCADE,
	ticket_identifier TEXT NOT NULL REFERENCES calendar_ticket_types (identifier) ON DELETE CASCADE,
	account_identifier TEXT NOT NULL REFERENCES accounts (identifier) ON DELETE CASCADE,
	-- The name to put on the list at the door.
	name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
	-- What the person asked for to take part, seen only by the people who run
	-- events. Emptied 30 days after the event ends.
	access_needs TEXT CHECK (length(access_needs) <= 2000),
	-- Whether to send the reminders a day before and shortly before.
	wants_reminders INTEGER NOT NULL DEFAULT 1 CHECK (wants_reminders IN (0, 1)),
	-- 'registered' holds a seat; 'waitlisted' waits for one; 'offered' holds a
	-- freed seat until offer_expires_at; 'lapsed' let an offer run out;
	-- 'cancelled' gave up a seat or a place on the waitlist.
	status TEXT NOT NULL CHECK (status IN ('registered', 'waitlisted', 'offered', 'lapsed', 'cancelled')),
	registered_at TEXT NOT NULL,
	offered_at TEXT,
	offer_expires_at TEXT,
	cancelled_at TEXT,
	-- The event's sequence when the person was last told about it, so a
	-- change of time or place is emailed once to each person who signed up
	-- before it.
	told_sequence INTEGER NOT NULL DEFAULT 0,
	updated_at TEXT NOT NULL
);

-- One live registration per person per event.
CREATE UNIQUE INDEX calendar_registrations_one_each
	ON calendar_registrations (event_identifier, account_identifier)
	WHERE status IN ('registered', 'waitlisted', 'offered');

CREATE INDEX calendar_registrations_by_ticket ON calendar_registrations (ticket_identifier, status, registered_at);
CREATE INDEX calendar_registrations_by_account ON calendar_registrations (account_identifier, status);

-- Each email sent about a registration. A row is written before the email is
-- sent and removed if sending fails, so two runs at once cannot send the
-- same email twice.
CREATE TABLE calendar_messages (
	registration_identifier TEXT NOT NULL REFERENCES calendar_registrations (identifier) ON DELETE CASCADE,
	-- 'registered', 'waitlisted', 'offered', 'day-before', 'starting-soon',
	-- 'changed' or 'cancelled' (src/lib/server/event-calendar-email.ts).
	kind TEXT NOT NULL,
	-- The event's sequence, for 'changed'; 0 otherwise.
	sequence INTEGER NOT NULL DEFAULT 0,
	sent_at TEXT NOT NULL,
	PRIMARY KEY (registration_identifier, kind, sequence)
);
