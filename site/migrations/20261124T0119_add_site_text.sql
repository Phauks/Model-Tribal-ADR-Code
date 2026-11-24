-- Adds the tables for editing the site's own wording from the website: every version of a piece of text, each publication, and each rebuild asked for.
-- Also lets the Access page grant a level on site text, by allowing "site-text" as a kind of document in access_grants.
-- Design: docs/site-text.md and decision record 0054.

-- 1. Every saved version of a piece of site text. A piece is named by the
-- build (src/lib/site-text-markers.ts). NULL words mean "the built-in words".
-- Versions are never changed or deleted.
CREATE TABLE site_text_versions (
	identifier INTEGER PRIMARY KEY AUTOINCREMENT,
	text_key TEXT NOT NULL CHECK (length(text_key) = 10),
	words TEXT CHECK (words IS NULL OR length(words) BETWEEN 1 AND 2000),
	-- The built-in words and their file when this version was written, so the
	-- history still reads correctly after the code changes.
	built_in_words TEXT NOT NULL,
	source_file TEXT NOT NULL,
	-- The page the change was made on, if it was made on a page.
	page TEXT,
	person_identifier TEXT NOT NULL REFERENCES people (identifier),
	created_at TEXT NOT NULL
);

CREATE INDEX site_text_versions_by_key ON site_text_versions (text_key, identifier);

CREATE TRIGGER site_text_versions_cannot_change BEFORE UPDATE ON site_text_versions
BEGIN
	SELECT RAISE(ABORT, 'Saved versions of site text cannot be changed.');
END;

CREATE TRIGGER site_text_versions_cannot_be_deleted BEFORE DELETE ON site_text_versions
BEGIN
	SELECT RAISE(ABORT, 'Saved versions of site text cannot be deleted.');
END;

-- 2. Each Publish: who and when. Undoing a publication is a new publication.
CREATE TABLE site_text_publications (
	number INTEGER PRIMARY KEY AUTOINCREMENT,
	person_identifier TEXT NOT NULL REFERENCES people (identifier),
	-- Set when this publication undoes another.
	undoes INTEGER REFERENCES site_text_publications (number),
	published_at TEXT NOT NULL
);

-- Which version of each piece of text a publication put live.
CREATE TABLE site_text_published (
	publication INTEGER NOT NULL REFERENCES site_text_publications (number),
	text_key TEXT NOT NULL,
	version INTEGER NOT NULL REFERENCES site_text_versions (identifier),
	PRIMARY KEY (publication, text_key)
);

CREATE INDEX site_text_published_by_key ON site_text_published (text_key, publication);

CREATE TRIGGER site_text_publications_cannot_change BEFORE UPDATE ON site_text_publications
BEGIN
	SELECT RAISE(ABORT, 'Publications of site text cannot be changed.');
END;

CREATE TRIGGER site_text_publications_cannot_be_deleted BEFORE DELETE ON site_text_publications
BEGIN
	SELECT RAISE(ABORT, 'Publications of site text cannot be deleted.');
END;

CREATE TRIGGER site_text_published_cannot_change BEFORE UPDATE ON site_text_published
BEGIN
	SELECT RAISE(ABORT, 'Publications of site text cannot be changed.');
END;

CREATE TRIGGER site_text_published_cannot_be_deleted BEFORE DELETE ON site_text_published
BEGIN
	SELECT RAISE(ABORT, 'Publications of site text cannot be deleted.');
END;

-- 3. Each time the site asked Cloudflare to rebuild it with published text,
-- and the answer, so a missed rebuild can be retried and shown.
CREATE TABLE site_text_rebuilds (
	identifier INTEGER PRIMARY KEY AUTOINCREMENT,
	publication INTEGER NOT NULL,
	reason TEXT NOT NULL CHECK (reason IN ('published', 'missed')),
	outcome TEXT NOT NULL,
	requested_at TEXT NOT NULL
);

-- 4. Access grants, as in 0002, with "site-text" allowed as a kind. SQLite
-- cannot change a CHECK, so the table is copied out and back.
PRAGMA defer_foreign_keys = true;

CREATE TABLE access_grants_copy AS SELECT * FROM access_grants;
DROP TABLE access_grants;

CREATE TABLE access_grants (
	identifier TEXT PRIMARY KEY,
	person_identifier TEXT NOT NULL REFERENCES people (identifier),
	subject_kind TEXT NOT NULL CHECK (
		subject_kind IN ('nation', 'glossary-term', 'provision', 'essay', 'site-text')
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

INSERT INTO access_grants
	(identifier, person_identifier, subject_kind, subject_identifier, level, note, expires_at, granted_by, granted_at, ended_at, ended_by)
SELECT identifier, person_identifier, subject_kind, subject_identifier, level, note, expires_at, granted_by, granted_at, ended_at, ended_by
FROM access_grants_copy ORDER BY granted_at;

DROP TABLE access_grants_copy;

-- At most one current grant per person and document (or kind).
CREATE UNIQUE INDEX access_grants_current
	ON access_grants (person_identifier, subject_kind, subject_identifier)
	WHERE ended_at IS NULL;

CREATE INDEX access_grants_by_subject
	ON access_grants (subject_kind, subject_identifier)
	WHERE ended_at IS NULL;
