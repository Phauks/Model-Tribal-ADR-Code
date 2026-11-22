-- Essays written and edited on the website (docs/editing.md, decision record
-- 0021). The text of every saved version is a file in the private
-- sourceDocuments bucket under essays/<id>/versions/, written once and never
-- replaced; these tables say which files exist, who saved each and which
-- version readers see. Saving, restoring, bringing in the git text and
-- publishing each add an entry to the activity log (events).

-- One row per essay. The identifier is the essay's file name without ".md",
-- as in content/essays/ (for example "i-legal-history-timeline"), and is the
-- subject identifier access grants use for kind 'essay'.
CREATE TABLE essays (
	identifier TEXT PRIMARY KEY CHECK (identifier GLOB '[a-z0-9]*' AND identifier NOT GLOB '*[^a-z0-9-]*'),
	-- The part of the work and section of the website it belongs to.
	part TEXT NOT NULL CHECK (part IN ('foundations', 'essays')),
	created_at TEXT NOT NULL,
	created_by TEXT REFERENCES people (identifier)
);

-- Every saved version of every essay, numbered from 1 per essay.
CREATE TABLE essay_versions (
	essay_identifier TEXT NOT NULL REFERENCES essays (identifier),
	number INTEGER NOT NULL CHECK (number >= 1),
	-- The file in the bucket: essays/<id>/versions/<number>-<first 12 of sha256>.md
	object_key TEXT NOT NULL UNIQUE,
	sha256 TEXT NOT NULL,
	bytes INTEGER NOT NULL,
	title TEXT NOT NULL,
	-- The writer's note, such as "Sent to advisors".
	note TEXT,
	-- The version the writer started from; empty for the first.
	based_on INTEGER,
	origin TEXT NOT NULL CHECK (origin IN ('editor', 'git', 'restore')),
	person_identifier TEXT REFERENCES people (identifier),
	created_at TEXT NOT NULL,
	PRIMARY KEY (essay_identifier, number)
);

-- Versions readers see, numbered from 1 per essay. The newest listed one is
-- the essay's page; every listed one stays readable in its history.
CREATE TABLE essay_publications (
	essay_identifier TEXT NOT NULL REFERENCES essays (identifier),
	number INTEGER NOT NULL CHECK (number >= 1),
	version_number INTEGER NOT NULL,
	-- 0 when a publication is held back, for example at a nation's request
	-- (docs/requests.md); the only column that can change.
	listed INTEGER NOT NULL DEFAULT 1 CHECK (listed IN (0, 1)),
	person_identifier TEXT REFERENCES people (identifier),
	published_at TEXT NOT NULL,
	PRIMARY KEY (essay_identifier, number),
	FOREIGN KEY (essay_identifier, version_number) REFERENCES essay_versions (essay_identifier, number)
);

CREATE INDEX essay_publications_listed ON essay_publications (essay_identifier, listed, number);

-- Versions are added, never changed or deleted.
CREATE TRIGGER essay_versions_cannot_change BEFORE UPDATE ON essay_versions
BEGIN
	SELECT RAISE(ABORT, 'Saved versions cannot be changed.');
END;

CREATE TRIGGER essay_versions_cannot_be_deleted BEFORE DELETE ON essay_versions
BEGIN
	SELECT RAISE(ABORT, 'Saved versions cannot be deleted.');
END;

CREATE TRIGGER essay_publications_keep_their_version BEFORE UPDATE OF essay_identifier, number, version_number, person_identifier, published_at ON essay_publications
BEGIN
	SELECT RAISE(ABORT, 'A publication can only be listed or held back.');
END;

CREATE TRIGGER essay_publications_cannot_be_deleted BEFORE DELETE ON essay_publications
BEGIN
	SELECT RAISE(ABORT, 'Publications cannot be deleted.');
END;
