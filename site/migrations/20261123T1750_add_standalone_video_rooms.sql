-- Turns the events video room into rooms of their own, which can be public, private or an event's, and adds invite links.
--
-- Each room has its own RealtimeKit meeting, so any number of rooms can run at
-- the same time (docs/decisions/0048-events-and-registration.md, "Rooms of
-- their own"). A room belongs to an event, or stands alone: a public room is
-- listed at /rooms for anyone signed in, and a private room, such as an
-- interview, lets in only its hosts and the people holding one of its invite
-- links. The three event room tables from 20261123T0452 are copied into the
-- new ones and dropped.

CREATE TABLE video_rooms (
	identifier TEXT PRIMARY KEY,
	-- Set for an event's room, which follows the event's times and recording choice.
	event_identifier TEXT UNIQUE REFERENCES calendar_events (identifier) ON DELETE CASCADE,
	title TEXT NOT NULL,
	-- "event": the room of the event above. "public": listed at /rooms and open
	-- to anyone signed in. "private": hosts and invite links only.
	visibility TEXT NOT NULL CHECK (visibility IN ('event', 'public', 'private')),
	-- "webinar": speakers on a stage, everyone else watches and may ask to join it.
	-- "discussion": everyone may speak and show video.
	style TEXT NOT NULL DEFAULT 'discussion' CHECK (style IN ('webinar', 'discussion')),
	-- A room of its own says here whether it is recorded; an event's room uses the event's choice.
	recording TEXT CHECK (recording IN ('recorded', 'not-recorded', 'undecided')),
	-- Who may watch the recordings: the hosts only, the people registered for
	-- the event, the people who joined the room with an account, or anyone signed in.
	watchers TEXT NOT NULL DEFAULT 'hosts' CHECK (watchers IN ('hosts', 'registered', 'joined', 'signed-in')),
	-- A room of its own lets guests in from 30 minutes before starts_at until
	-- closes_at; an event's room uses the event's times instead.
	starts_at TEXT,
	closes_at TEXT,
	time_zone TEXT NOT NULL DEFAULT 'America/Los_Angeles',
	-- RealtimeKit's meeting id; empty until the room is first opened.
	meeting TEXT,
	-- The account that made a room of its own; it hosts that room.
	created_by TEXT REFERENCES accounts (identifier) ON DELETE SET NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	CHECK ((visibility = 'event') = (event_identifier IS NOT NULL)),
	CHECK (visibility = 'event' OR (recording IS NOT NULL AND starts_at IS NOT NULL AND closes_at IS NOT NULL))
);

CREATE INDEX video_rooms_by_closing ON video_rooms (visibility, closes_at);

-- Links that let someone into a room without an account, such as a person
-- being interviewed. Only a hash of the link's secret is kept; the link is
-- shown once, when it is made. A link works until the room closes or a host
-- turns it off.
CREATE TABLE video_room_invites (
	identifier TEXT PRIMARY KEY,
	room_identifier TEXT NOT NULL REFERENCES video_rooms (identifier) ON DELETE CASCADE,
	-- Who it is for, as the hosts know them; also the name shown in the room
	-- unless the person types another.
	name TEXT NOT NULL,
	role TEXT NOT NULL CHECK (role IN ('host', 'guest')),
	token_hash TEXT NOT NULL UNIQUE,
	created_by TEXT REFERENCES accounts (identifier) ON DELETE SET NULL,
	created_at TEXT NOT NULL,
	revoked_at TEXT,
	last_used_at TEXT
);

CREATE INDEX video_room_invites_by_room ON video_room_invites (room_identifier, created_at);

-- Everyone who was let into a room, and what they were told before joining.
-- A visitor is "account:<identifier>" or "invite:<identifier>". Each is added
-- to the RealtimeKit meeting once; later visits get a fresh token for the
-- same participant.
CREATE TABLE video_room_people (
	room_identifier TEXT NOT NULL REFERENCES video_rooms (identifier) ON DELETE CASCADE,
	visitor TEXT NOT NULL,
	account_identifier TEXT REFERENCES accounts (identifier) ON DELETE CASCADE,
	invite_identifier TEXT REFERENCES video_room_invites (identifier) ON DELETE CASCADE,
	-- The name shown in the room.
	name TEXT NOT NULL,
	role TEXT NOT NULL CHECK (role IN ('host', 'guest')),
	participant TEXT,
	-- The room's recording choice as it stood when they agreed to the notice.
	told_recording TEXT NOT NULL CHECK (told_recording IN ('recorded', 'not-recorded', 'undecided')),
	told_at TEXT NOT NULL,
	last_joined_at TEXT NOT NULL,
	PRIMARY KEY (room_identifier, visitor),
	CHECK ((account_identifier IS NOT NULL) <> (invite_identifier IS NOT NULL))
);

CREATE INDEX video_room_people_by_account ON video_room_people (account_identifier);

-- Recordings RealtimeKit made of a room, and our own copy of each in the
-- private bucket. RealtimeKit keeps its copy for seven days; the events run
-- every 15 minutes copies it, then asks for a virus check (site/SCANNING.md).
CREATE TABLE video_room_recordings (
	identifier TEXT PRIMARY KEY,
	room_identifier TEXT NOT NULL REFERENCES video_rooms (identifier) ON DELETE CASCADE,
	-- RealtimeKit's own status: INVOKED, RECORDING, PAUSED, UPLOADING, UPLOADED or ERRORED.
	status TEXT NOT NULL,
	started_at TEXT,
	stopped_at TEXT,
	duration_seconds INTEGER,
	size_bytes INTEGER,
	-- Our copy in the private bucket, once made.
	object_key TEXT,
	copied_at TEXT,
	copy_attempts INTEGER NOT NULL DEFAULT 0,
	copy_problem TEXT,
	-- Hidden by a host: kept, but shown to nobody but the hosts.
	hidden INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE INDEX video_room_recordings_by_room ON video_room_recordings (room_identifier, started_at);

-- Copy the event rooms. An event's room takes the event's identifier as its own.
INSERT INTO video_rooms (identifier, event_identifier, title, visibility, style, recording, watchers, time_zone, meeting, created_at, updated_at)
SELECT r.event_identifier, r.event_identifier, e.title, 'event', r.style, NULL, r.watchers, e.time_zone, r.meeting, r.created_at, r.updated_at
FROM calendar_rooms r JOIN calendar_events e ON e.identifier = r.event_identifier;

INSERT INTO video_room_people (room_identifier, visitor, account_identifier, name, role, participant, told_recording, told_at, last_joined_at)
SELECT p.event_identifier, 'account:' || p.account_identifier, p.account_identifier,
	COALESCE((SELECT people.display_name FROM people WHERE people.sign_in_subject = p.account_identifier), 'Someone signed in'),
	p.role, p.participant, p.told_recording, p.told_at, p.last_joined_at
FROM calendar_room_people p;

INSERT INTO video_room_recordings (identifier, room_identifier, status, started_at, stopped_at, duration_seconds, size_bytes, object_key, copied_at, copy_attempts, copy_problem, hidden, created_at, updated_at)
SELECT identifier, event_identifier, status, started_at, stopped_at, duration_seconds, size_bytes, object_key, copied_at, copy_attempts, copy_problem, hidden, created_at, updated_at
FROM calendar_recordings;

DROP TABLE calendar_recordings;
DROP TABLE calendar_room_people;
DROP TABLE calendar_rooms;
