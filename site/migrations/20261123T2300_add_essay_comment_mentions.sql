-- Adds @ mentions in comments on essay drafts. Design: docs/editing.md,
-- "Comments", and the approved commenting mockup (essay-editor-mockups/4).
-- Someone writing a comment chooses people who can open the essay with
-- "@ mention"; each one chosen is a row here, and the thread shows on that
-- person's Comments for you page until it is marked done. Like comments,
-- mentions are never changed or deleted.
CREATE TABLE essay_comment_mentions (
	comment_identifier TEXT NOT NULL REFERENCES essay_comments (identifier),
	person_identifier TEXT NOT NULL REFERENCES people (identifier),
	PRIMARY KEY (comment_identifier, person_identifier)
);

CREATE INDEX essay_comment_mentions_by_person ON essay_comment_mentions (person_identifier);

CREATE TRIGGER essay_comment_mentions_cannot_change BEFORE UPDATE ON essay_comment_mentions
BEGIN
	SELECT RAISE(ABORT, 'A mention cannot be changed.');
END;

CREATE TRIGGER essay_comment_mentions_cannot_be_deleted BEFORE DELETE ON essay_comment_mentions
BEGIN
	SELECT RAISE(ABORT, 'Mentions cannot be deleted.');
END;
