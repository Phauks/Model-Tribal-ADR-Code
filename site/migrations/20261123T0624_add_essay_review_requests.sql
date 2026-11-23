-- Adds requests asking people to review an essay draft or one section of it.
-- Design: docs/editing.md, "Sharing and asking for review". Someone who can
-- edit the essay asks one or more people who can open it to review the whole
-- draft or one section, optionally by a date and with a message. Each person
-- asked marks their own review done; the request closes when all of them
-- have, or when the person who asked (or someone with full access) closes it.
-- Requests are never deleted, and only the done and closed fields change.
-- Each request and each change is also in the activity log.
CREATE TABLE essay_review_requests (
	identifier TEXT PRIMARY KEY,
	essay_identifier TEXT NOT NULL REFERENCES essays (identifier),
	-- The section's heading id on the essay page, and its title when asked;
	-- both empty for the whole essay.
	section_slug TEXT,
	section_title TEXT,
	-- The date to review by, as YYYY-MM-DD, or empty.
	due_on TEXT CHECK (due_on IS NULL OR due_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	message TEXT CHECK (message IS NULL OR length(message) <= 2000),
	-- The saved version the draft was at when asked.
	version_number INTEGER,
	requested_by TEXT NOT NULL REFERENCES people (identifier),
	created_at TEXT NOT NULL,
	closed_at TEXT,
	closed_by TEXT REFERENCES people (identifier),
	CHECK ((section_slug IS NULL) = (section_title IS NULL))
);

CREATE INDEX essay_review_requests_by_essay ON essay_review_requests (essay_identifier, created_at);

-- The people asked, one row each.
CREATE TABLE essay_review_reviewers (
	request_identifier TEXT NOT NULL REFERENCES essay_review_requests (identifier),
	person_identifier TEXT NOT NULL REFERENCES people (identifier),
	done_at TEXT,
	PRIMARY KEY (request_identifier, person_identifier)
);

CREATE INDEX essay_review_reviewers_by_person ON essay_review_reviewers (person_identifier, done_at);

CREATE TRIGGER essay_review_requests_only_closed BEFORE UPDATE ON essay_review_requests
WHEN NEW.identifier IS NOT OLD.identifier
	OR NEW.essay_identifier IS NOT OLD.essay_identifier
	OR NEW.section_slug IS NOT OLD.section_slug
	OR NEW.section_title IS NOT OLD.section_title
	OR NEW.due_on IS NOT OLD.due_on
	OR NEW.message IS NOT OLD.message
	OR NEW.version_number IS NOT OLD.version_number
	OR NEW.requested_by IS NOT OLD.requested_by
	OR NEW.created_at IS NOT OLD.created_at
BEGIN
	SELECT RAISE(ABORT, 'A review request cannot be changed; it can only be closed.');
END;

CREATE TRIGGER essay_review_reviewers_only_done BEFORE UPDATE ON essay_review_reviewers
WHEN NEW.request_identifier IS NOT OLD.request_identifier
	OR NEW.person_identifier IS NOT OLD.person_identifier
BEGIN
	SELECT RAISE(ABORT, 'Only a reviewer''s done time can change.');
END;

CREATE TRIGGER essay_review_requests_cannot_be_deleted BEFORE DELETE ON essay_review_requests
BEGIN
	SELECT RAISE(ABORT, 'Review requests cannot be deleted.');
END;

CREATE TRIGGER essay_review_reviewers_cannot_be_deleted BEFORE DELETE ON essay_review_reviewers
BEGIN
	SELECT RAISE(ABORT, 'Review requests cannot be deleted.');
END;
