-- Pages about the site, such as the About and Sponsorship pages, are edited
-- on the website like the essays (docs/editing.md). They get their own
-- part, "about", and keep the addresses they have always had. SQLite cannot
-- change a CHECK constraint, so the essays table is made again with the
-- same rows, as migration 0006 did: the rows are copied out, the table is
-- dropped and made again under the same name, and the rows are copied back,
-- so the versions and publications that refer to it find their essays again
-- before the change is committed.
PRAGMA defer_foreign_keys = on;

CREATE TABLE essays_copy AS SELECT identifier, part, created_at, created_by FROM essays;

DROP TABLE essays;

CREATE TABLE essays (
	identifier TEXT PRIMARY KEY CHECK (identifier GLOB '[a-z0-9]*' AND identifier NOT GLOB '*[^a-z0-9-]*'),
	-- The part of the work and section of the website it belongs to.
	part TEXT NOT NULL CHECK (part IN ('foundations', 'essays', 'back-matter', 'about')),
	created_at TEXT NOT NULL,
	created_by TEXT REFERENCES people (identifier)
);

INSERT INTO essays (identifier, part, created_at, created_by)
SELECT identifier, part, created_at, created_by FROM essays_copy;

DROP TABLE essays_copy;
