-- Comments from a nation on files people sent about it (docs/uploads.md,
-- "Comments from the nation"; decision record 0038). A nation reviewer reads
-- the files linked to their nation and comments; only the project's
-- reviewers file them. SQLite cannot change a CHECK constraint in place, so
-- upload_messages is rebuilt with the new kind. Nothing refers to its rows.
CREATE TABLE upload_messages_new (
	identifier TEXT PRIMARY KEY,
	upload_identifier TEXT NOT NULL REFERENCES uploads (identifier) ON DELETE CASCADE,
	-- 'question' from a reviewer, 'answer' from the sender, 'note' between
	-- reviewers (the sender never sees notes), 'nation-comment' from a
	-- nation reviewer (reviewers and that nation's reviewers see it; the
	-- sender does not).
	kind TEXT NOT NULL CHECK (kind IN ('question', 'answer', 'note', 'nation-comment')),
	-- Who wrote it; empty for the sender.
	person_identifier TEXT REFERENCES people (identifier),
	body TEXT NOT NULL,
	created_at TEXT NOT NULL,
	CHECK ((kind = 'answer') = (person_identifier IS NULL))
);

INSERT INTO upload_messages_new (identifier, upload_identifier, kind, person_identifier, body, created_at)
SELECT identifier, upload_identifier, kind, person_identifier, body, created_at FROM upload_messages;

DROP TABLE upload_messages;
ALTER TABLE upload_messages_new RENAME TO upload_messages;
CREATE INDEX upload_messages_by_upload ON upload_messages (upload_identifier, created_at);
