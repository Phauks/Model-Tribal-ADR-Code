-- Adds the site's own video room for events, its recordings and the log of who was told about recording.
--
-- The room runs on Cloudflare RealtimeKit (docs/decisions/0048-events-and-registration.md,
-- "The video room"). An event uses it when it has a row in calendar_rooms. The
-- RealtimeKit meeting is made the first time someone opens the room, and each
-- person is added to it once, as a participant whose id is their account
-- identifier, never their email address.

CREATE TABLE calendar_rooms (
	event_identifier TEXT PRIMARY KEY REFERENCES calendar_events (identifier) ON DELETE CASCADE,
	-- "webinar": speakers on a stage, everyone else watches and may ask to join it.
	-- "discussion": everyone may speak and show video.
	style TEXT NOT NULL DEFAULT 'webinar' CHECK (style IN ('webinar', 'discussion')),
	-- Who may watch the recordings: the people running events only, people who
	-- registered for the event, or anyone signed in.
	watchers TEXT NOT NULL DEFAULT 'hosts' CHECK (watchers IN ('hosts', 'registered', 'signed-in')),
	-- RealtimeKit's meeting id; empty until the room is first opened.
	meeting TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

-- Everyone who was let into a room, and what they were told before joining.
-- A person is added to the RealtimeKit meeting once; later visits get a fresh
-- token for the same participant.
CREATE TABLE calendar_room_people (
	event_identifier TEXT NOT NULL REFERENCES calendar_rooms (event_identifier) ON DELETE CASCADE,
	account_identifier TEXT NOT NULL REFERENCES accounts (identifier) ON DELETE CASCADE,
	role TEXT NOT NULL CHECK (role IN ('host', 'guest')),
	participant TEXT,
	-- The event's recording choice as it stood when they agreed to the notice:
	-- recorded, not-recorded or undecided.
	told_recording TEXT NOT NULL CHECK (told_recording IN ('recorded', 'not-recorded', 'undecided')),
	told_at TEXT NOT NULL,
	last_joined_at TEXT NOT NULL,
	PRIMARY KEY (event_identifier, account_identifier)
);

CREATE INDEX calendar_room_people_by_account ON calendar_room_people (account_identifier);

-- Recordings RealtimeKit made of a room, and our own copy of each in the
-- private bucket. RealtimeKit keeps its copy for seven days; the events run
-- every 15 minutes copies it, then asks for a virus check (site/SCANNING.md).
CREATE TABLE calendar_recordings (
	identifier TEXT PRIMARY KEY,
	event_identifier TEXT NOT NULL REFERENCES calendar_rooms (event_identifier) ON DELETE CASCADE,
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

CREATE INDEX calendar_recordings_by_event ON calendar_recordings (event_identifier, started_at);
