-- Assigning a comment thread on an essay draft to someone (docs/editing.md,
-- "Comments"; Trevor asked for it on Nov. 23, 2026). A thread can be
-- assigned to a person who can open the essay, or to one of the project's
-- AI helpers, Claude or Nemesis. Each assignment is a new row and the
-- newest one counts; a row naming no one takes the assignment away. Rows
-- are never changed or deleted, so who assigned what stays on record.
CREATE TABLE essay_comment_assignments (
	identifier TEXT PRIMARY KEY,
	thread_identifier TEXT NOT NULL REFERENCES essay_comments (identifier),
	person_identifier TEXT REFERENCES people (identifier),
	helper TEXT CHECK (helper IN ('claude', 'nemesis')),
	assigned_by TEXT NOT NULL REFERENCES people (identifier),
	assigned_at TEXT NOT NULL,
	CHECK (person_identifier IS NULL OR helper IS NULL)
);

CREATE INDEX essay_comment_assignments_by_thread ON essay_comment_assignments (thread_identifier, assigned_at);
CREATE INDEX essay_comment_assignments_by_person ON essay_comment_assignments (person_identifier);

CREATE TRIGGER essay_comment_assignments_cannot_change BEFORE UPDATE ON essay_comment_assignments
BEGIN
	SELECT RAISE(ABORT, 'An assignment cannot be changed.');
END;

CREATE TRIGGER essay_comment_assignments_cannot_be_deleted BEFORE DELETE ON essay_comment_assignments
BEGIN
	SELECT RAISE(ABORT, 'Assignments cannot be deleted.');
END;
