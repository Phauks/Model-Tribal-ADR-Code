-- Adds comments on essay drafts, each tied to the words it is about.
-- Design: docs/editing.md, "Comments". A comment starts a thread on words
-- someone selected in the draft; the row keeps those words with a little of
-- the text before and after them, so the editor can find them again as the
-- text changes (the W3C Web Annotation "text quote" selector). Replies
-- belong to the thread and keep no words of their own. A thread is marked
-- done (resolved) and can be reopened. Comments are never changed or
-- deleted; only a thread's resolved fields change. Each comment and each
-- change of state is also in the activity log.
CREATE TABLE essay_comments (
	identifier TEXT PRIMARY KEY,
	essay_identifier TEXT NOT NULL REFERENCES essays (identifier),
	-- The thread's first comment; empty for that first comment itself.
	thread_identifier TEXT REFERENCES essay_comments (identifier),
	person_identifier TEXT NOT NULL REFERENCES people (identifier),
	body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 5000),
	-- The quick asks on a thread's first comment, as a JSON array of words
	-- from src/lib/essays/comments.ts, such as ["sources","unclear"].
	asks TEXT NOT NULL DEFAULT '[]',
	-- The words commented on, and up to 32 characters on each side of them.
	quote TEXT,
	quote_prefix TEXT,
	quote_suffix TEXT,
	-- The saved version the person was reading when they commented.
	version_number INTEGER,
	created_at TEXT NOT NULL,
	resolved_at TEXT,
	resolved_by TEXT REFERENCES people (identifier),
	CHECK ((thread_identifier IS NULL) = (quote IS NOT NULL))
);

CREATE INDEX essay_comments_by_essay ON essay_comments (essay_identifier, created_at);
CREATE INDEX essay_comments_by_thread ON essay_comments (thread_identifier, created_at);

CREATE TRIGGER essay_comments_only_resolved BEFORE UPDATE ON essay_comments
WHEN NEW.identifier IS NOT OLD.identifier
	OR NEW.essay_identifier IS NOT OLD.essay_identifier
	OR NEW.thread_identifier IS NOT OLD.thread_identifier
	OR NEW.person_identifier IS NOT OLD.person_identifier
	OR NEW.body IS NOT OLD.body
	OR NEW.asks IS NOT OLD.asks
	OR NEW.quote IS NOT OLD.quote
	OR NEW.quote_prefix IS NOT OLD.quote_prefix
	OR NEW.quote_suffix IS NOT OLD.quote_suffix
	OR NEW.version_number IS NOT OLD.version_number
	OR NEW.created_at IS NOT OLD.created_at
BEGIN
	SELECT RAISE(ABORT, 'A comment cannot be changed; only its thread can be marked done or reopened.');
END;

CREATE TRIGGER essay_comments_cannot_be_deleted BEFORE DELETE ON essay_comments
BEGIN
	SELECT RAISE(ABORT, 'Comments cannot be deleted.');
END;
