-- An event's sessions and its materials, as in the approved events mockup
-- (design/events-and-cle, "2-event-page"; site/COLLABORATION.md, "Events").

-- The event's schedule: each session's times, title and a line about it.
CREATE TABLE calendar_sessions (
	identifier TEXT PRIMARY KEY,
	event_identifier TEXT NOT NULL REFERENCES calendar_events (identifier) ON DELETE CASCADE,
	starts_at TEXT NOT NULL,
	ends_at TEXT,
	title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
	about TEXT NOT NULL DEFAULT '' CHECK (length(about) <= 500),
	CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX calendar_sessions_by_event ON calendar_sessions (event_identifier, starts_at);

-- Files for the people coming, such as written materials or slides. Each is
-- kept in the private bucket under event-materials/ and served only once the
-- scanner has passed it (file_scans, purpose 'event-material'). Its SHA-256
-- is shown beside it, so a reader can check the copy they downloaded.
CREATE TABLE calendar_materials (
	identifier TEXT PRIMARY KEY,
	event_identifier TEXT NOT NULL REFERENCES calendar_events (identifier) ON DELETE CASCADE,
	title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
	file_name TEXT NOT NULL CHECK (length(file_name) BETWEEN 1 AND 200),
	object_key TEXT NOT NULL UNIQUE,
	content_type TEXT NOT NULL,
	size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
	sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
	created_by TEXT,
	created_at TEXT NOT NULL
);

CREATE INDEX calendar_materials_by_event ON calendar_materials (event_identifier, created_at);
