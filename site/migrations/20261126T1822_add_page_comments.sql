-- Adds comments on the site's other pages, such as laws, cases and nations.
-- Design: docs/editing.md, "Comments on other pages", and the mockups in
-- design/page-comments (Nov. 26, 2026). They work like
-- comments on essay drafts (20261123T0613_add_essay_comments.sql): a thread
-- starts on words someone selected on the page, kept with a little of the
-- text on each side so they can be found again after the page changes;
-- replies belong to the thread; a thread is marked done and can be reopened.
-- A page is named by its path, such as "laws/indian-removal-act-1830" or
-- "nations/cherokee-nation". Only people with comment access or above see
-- them; on a nation's page that is the nation's team and the project's
-- editors. Comments are never changed or deleted; only a thread's resolved
-- fields change. Each comment and each change of state is also in the
-- activity log.
CREATE TABLE page_comments (
	identifier TEXT PRIMARY KEY,
	page_path TEXT NOT NULL CHECK (length(page_path) BETWEEN 1 AND 300),
	-- The page's title when the thread started, for the Comments for you page.
	page_title TEXT,
	-- The thread's first comment; empty for that first comment itself.
	thread_identifier TEXT REFERENCES page_comments (identifier),
	person_identifier TEXT NOT NULL REFERENCES people (identifier),
	body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 5000),
	-- The quick asks on a thread's first comment, as a JSON array of words
	-- from src/lib/essays/comments.ts, such as ["sources","check"].
	asks TEXT NOT NULL DEFAULT '[]',
	-- The words commented on, and up to 32 characters on each side of them.
	quote TEXT,
	quote_prefix TEXT,
	quote_suffix TEXT,
	created_at TEXT NOT NULL,
	resolved_at TEXT,
	resolved_by TEXT REFERENCES people (identifier),
	CHECK ((thread_identifier IS NULL) = (quote IS NOT NULL))
);

CREATE INDEX page_comments_by_page ON page_comments (page_path, created_at);
CREATE INDEX page_comments_by_thread ON page_comments (thread_identifier, created_at);

CREATE TRIGGER page_comments_only_resolved BEFORE UPDATE ON page_comments
WHEN NEW.identifier IS NOT OLD.identifier
	OR NEW.page_path IS NOT OLD.page_path
	OR NEW.page_title IS NOT OLD.page_title
	OR NEW.thread_identifier IS NOT OLD.thread_identifier
	OR NEW.person_identifier IS NOT OLD.person_identifier
	OR NEW.body IS NOT OLD.body
	OR NEW.asks IS NOT OLD.asks
	OR NEW.quote IS NOT OLD.quote
	OR NEW.quote_prefix IS NOT OLD.quote_prefix
	OR NEW.quote_suffix IS NOT OLD.quote_suffix
	OR NEW.created_at IS NOT OLD.created_at
BEGIN
	SELECT RAISE(ABORT, 'A comment cannot be changed; only its thread can be marked done or reopened.');
END;

CREATE TRIGGER page_comments_cannot_be_deleted BEFORE DELETE ON page_comments
BEGIN
	SELECT RAISE(ABORT, 'Comments cannot be deleted.');
END;

-- People chosen with "@ mention" in a comment; the thread shows on their
-- Comments for you page until it is marked done.
CREATE TABLE page_comment_mentions (
	comment_identifier TEXT NOT NULL REFERENCES page_comments (identifier),
	person_identifier TEXT NOT NULL REFERENCES people (identifier),
	PRIMARY KEY (comment_identifier, person_identifier)
);

CREATE INDEX page_comment_mentions_by_person ON page_comment_mentions (person_identifier);

CREATE TRIGGER page_comment_mentions_cannot_change BEFORE UPDATE ON page_comment_mentions
BEGIN
	SELECT RAISE(ABORT, 'A mention cannot be changed.');
END;

CREATE TRIGGER page_comment_mentions_cannot_be_deleted BEFORE DELETE ON page_comment_mentions
BEGIN
	SELECT RAISE(ABORT, 'Mentions cannot be deleted.');
END;

-- Assigning a thread to a person who can see the page's comments, or to
-- Claude or Nemesis. Each assignment is a new row and the newest counts; a
-- row naming no one takes the assignment away.
CREATE TABLE page_comment_assignments (
	identifier TEXT PRIMARY KEY,
	thread_identifier TEXT NOT NULL REFERENCES page_comments (identifier),
	person_identifier TEXT REFERENCES people (identifier),
	helper TEXT CHECK (helper IN ('claude', 'nemesis')),
	assigned_by TEXT NOT NULL REFERENCES people (identifier),
	assigned_at TEXT NOT NULL,
	CHECK (person_identifier IS NULL OR helper IS NULL)
);

CREATE INDEX page_comment_assignments_by_thread ON page_comment_assignments (thread_identifier, assigned_at);
CREATE INDEX page_comment_assignments_by_person ON page_comment_assignments (person_identifier);

CREATE TRIGGER page_comment_assignments_cannot_change BEFORE UPDATE ON page_comment_assignments
BEGIN
	SELECT RAISE(ABORT, 'An assignment cannot be changed.');
END;

CREATE TRIGGER page_comment_assignments_cannot_be_deleted BEFORE DELETE ON page_comment_assignments
BEGIN
	SELECT RAISE(ABORT, 'Assignments cannot be deleted.');
END;
