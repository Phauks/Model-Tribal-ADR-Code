-- News posts are written and published on the website like the essays (docs/editing.md, "News"). They get their own part, "news", shown at /news, and readers can follow News as a whole, so page_updates takes the kind "news" too (src/lib/following.ts). SQLite cannot change a CHECK constraint, so the essays table is made again with the same rows, as migration 0006 and 20261123T0435 did: the rows are copied out, the table is dropped and made again under the same name, and the rows are copied back, so the versions and publications that refer to it find their essays again before the change is committed.
PRAGMA defer_foreign_keys = on;

CREATE TABLE essays_copy AS SELECT identifier, part, created_at, created_by FROM essays;

DROP TABLE essays;

CREATE TABLE essays (
	identifier TEXT PRIMARY KEY CHECK (identifier GLOB '[a-z0-9]*' AND identifier NOT GLOB '*[^a-z0-9-]*'),
	-- The part of the work and section of the website it belongs to.
	part TEXT NOT NULL CHECK (part IN ('foundations', 'essays', 'back-matter', 'about', 'news')),
	created_at TEXT NOT NULL,
	created_by TEXT REFERENCES people (identifier)
);

INSERT INTO essays (identifier, part, created_at, created_by)
SELECT identifier, part, created_at, created_by FROM essays_copy;

DROP TABLE essays_copy;

-- Following News: page_updates is made again the same way, keeping each row's number so the notices people have read stay read.
CREATE TABLE page_updates_copy AS SELECT identifier, address, kind, updated_at FROM page_updates;

DROP TABLE page_updates;

CREATE TABLE page_updates (
	identifier INTEGER PRIMARY KEY AUTOINCREMENT,
	address TEXT NOT NULL,
	-- 'nation', 'code', 'essay' or 'news' (src/lib/following.ts).
	kind TEXT NOT NULL CHECK (kind IN ('nation', 'code', 'essay', 'news')),
	updated_at TEXT NOT NULL
);

INSERT INTO page_updates (identifier, address, kind, updated_at)
SELECT identifier, address, kind, updated_at FROM page_updates_copy;

DROP TABLE page_updates_copy;

CREATE INDEX page_updates_by_address ON page_updates (address, identifier);
