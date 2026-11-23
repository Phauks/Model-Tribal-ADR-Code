-- Comments from a nation on files people sent about it (docs/uploads.md,
-- "Comments from the nation"; decision record 0038). A nation reviewer reads
-- the files linked to their nation and comments; only the project's
-- reviewers file them. Reviewers and that nation's reviewers see a comment;
-- the sender does not.
CREATE TABLE upload_nation_comments (
	identifier TEXT PRIMARY KEY,
	upload_identifier TEXT NOT NULL REFERENCES uploads (identifier) ON DELETE CASCADE,
	-- The nation the comment speaks for.
	nation_identifier TEXT NOT NULL,
	person_identifier TEXT NOT NULL REFERENCES people (identifier),
	body TEXT NOT NULL,
	created_at TEXT NOT NULL
);

CREATE INDEX upload_nation_comments_by_upload ON upload_nation_comments (upload_identifier, created_at);
