-- Permission tiers: per-document access levels, a contributor role, and an
-- activity log that cannot be changed and can be checked for tampering.
-- Design: site/COLLABORATION.md ("Access to each document", "Activity log")
-- and decision record 0023.
--
-- Apply with: npx wrangler d1 migrations apply database --remote
--
-- Tables are rebuilt here, so foreign key checks wait until the end of the
-- migration (Cloudflare, "Define foreign keys:
-- Defer foreign key constraints",
-- https://developers.cloudflare.com/d1/sql-api/foreign-keys/).
PRAGMA defer_foreign_keys = on;

-- 1. Keep copies of the two tables that point to people (reviews and the
-- activity log) and drop them, so that rebuilding people leaves nothing
-- pointing at a missing row. Both are recreated below from the copies.
CREATE TABLE reviews_copy AS SELECT * FROM reviews;
CREATE TABLE events_copy AS SELECT rowid AS original_order, * FROM events;
DROP TABLE events;
DROP TABLE reviews;

-- 2. People: add the contributor role, who sees only the documents the lead
-- author grants them. SQLite cannot change a CHECK constraint in place, so
-- the table is copied, dropped and made again (SQLite, "ALTER TABLE: Making Other
-- Kinds Of Table Schema Changes", https://www.sqlite.org/lang_altertable.html).
CREATE TABLE people_copy AS SELECT * FROM people;
DROP TABLE people;

CREATE TABLE people (
	identifier TEXT PRIMARY KEY,
	sign_in_subject TEXT UNIQUE,
	email TEXT NOT NULL UNIQUE COLLATE NOCASE,
	display_name TEXT NOT NULL,
	role TEXT NOT NULL CHECK (
		role IN ('lead-author', 'editor', 'co-author', 'advisor', 'contributor', 'nation-reviewer')
	),
	nation_identifier TEXT,
	status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'removed')),
	added_by TEXT REFERENCES people (identifier),
	added_at TEXT NOT NULL,
	last_signed_in_at TEXT,
	CHECK ((role = 'nation-reviewer') = (nation_identifier IS NOT NULL))
);

INSERT INTO people
	(identifier, sign_in_subject, email, display_name, role, nation_identifier, status, added_by, added_at, last_signed_in_at)
SELECT identifier, sign_in_subject, email, display_name, role, nation_identifier, status, added_by, added_at, last_signed_in_at
FROM people_copy ORDER BY added_at;

DROP TABLE people_copy;

-- Reviews, as in 0001, with contributor added as a capacity.
CREATE TABLE reviews (
	identifier TEXT PRIMARY KEY,
	subject_kind TEXT NOT NULL CHECK (
		subject_kind IN ('nation', 'glossary-term', 'provision', 'essay')
	),
	subject_identifier TEXT NOT NULL,
	content_version TEXT NOT NULL,
	person_identifier TEXT NOT NULL REFERENCES people (identifier),
	capacity TEXT NOT NULL CHECK (
		capacity IN ('lead-author', 'editor', 'co-author', 'advisor', 'contributor', 'nation')
	),
	decision TEXT NOT NULL CHECK (decision IN ('approved', 'changes-requested', 'comment')),
	note TEXT,
	created_at TEXT NOT NULL
);

INSERT INTO reviews SELECT * FROM reviews_copy;
DROP TABLE reviews_copy;

CREATE INDEX reviews_by_subject ON reviews (subject_kind, subject_identifier, created_at);

-- 3. Access to each document. A grant names one document, or every document
-- of a kind ('*'), and a level. "No access" is a grant too: it is how the
-- lead author keeps someone out of a document their role would otherwise
-- open. A changed grant is ended and a new one added, so the history stays.
CREATE TABLE access_grants (
	identifier TEXT PRIMARY KEY,
	person_identifier TEXT NOT NULL REFERENCES people (identifier),
	subject_kind TEXT NOT NULL CHECK (
		subject_kind IN ('nation', 'glossary-term', 'provision', 'essay')
	),
	-- A document's identifier, or '*' for every document of this kind,
	-- including drafts that have no file yet.
	subject_identifier TEXT NOT NULL,
	level TEXT NOT NULL CHECK (level IN ('no-access', 'comment', 'contribute', 'full')),
	note TEXT,
	-- Optional: the grant stops counting after this time.
	expires_at TEXT,
	granted_by TEXT NOT NULL REFERENCES people (identifier),
	granted_at TEXT NOT NULL,
	ended_at TEXT,
	ended_by TEXT REFERENCES people (identifier)
);

-- At most one current grant per person and document (or kind).
CREATE UNIQUE INDEX access_grants_current
	ON access_grants (person_identifier, subject_kind, subject_identifier)
	WHERE ended_at IS NULL;

CREATE INDEX access_grants_by_subject
	ON access_grants (subject_kind, subject_identifier)
	WHERE ended_at IS NULL;

-- 4. The activity log. Recreated to number every entry in order (sequence)
-- and to allow entries about grants, documents and contributor profiles.
CREATE TABLE events (
	-- Order of entries; AUTOINCREMENT never reuses a number
	-- (SQLite, "Autoincrement", https://www.sqlite.org/autoinc.html).
	sequence INTEGER PRIMARY KEY AUTOINCREMENT,
	identifier TEXT NOT NULL UNIQUE,
	person_identifier TEXT REFERENCES people (identifier),
	action TEXT NOT NULL,
	target_kind TEXT NOT NULL CHECK (
		target_kind IN ('person', 'request', 'review', 'grant', 'document', 'profile')
	),
	target_identifier TEXT NOT NULL,
	note TEXT,
	created_at TEXT NOT NULL
);

INSERT INTO events (identifier, person_identifier, action, target_kind, target_identifier, note, created_at)
SELECT identifier, person_identifier, action, target_kind, target_identifier, note, created_at
FROM events_copy ORDER BY original_order;

DROP TABLE events_copy;

CREATE INDEX events_by_target ON events (target_kind, target_identifier, created_at);
CREATE INDEX events_by_person ON events (person_identifier, created_at);

-- Entries are added, never changed or deleted.
CREATE TRIGGER events_cannot_change BEFORE UPDATE ON events
BEGIN
	SELECT RAISE(ABORT, 'The activity log cannot be changed.');
END;

CREATE TRIGGER events_cannot_be_deleted BEFORE DELETE ON events
BEGIN
	SELECT RAISE(ABORT, 'The activity log cannot be deleted from.');
END;

-- 5. Seals: each entry's SHA-256 hash, chained to the one before, so a
-- change to any sealed entry, or a missing one, shows when the chain is
-- checked (src/lib/server/activity-seals.ts).
CREATE TABLE event_seals (
	sequence INTEGER PRIMARY KEY REFERENCES events (sequence),
	hash TEXT NOT NULL,
	sealed_at TEXT NOT NULL
);

CREATE TRIGGER event_seals_cannot_change BEFORE UPDATE ON event_seals
BEGIN
	SELECT RAISE(ABORT, 'Seals cannot be changed.');
END;

CREATE TRIGGER event_seals_cannot_be_deleted BEFORE DELETE ON event_seals
BEGIN
	SELECT RAISE(ABORT, 'Seals cannot be deleted.');
END;
