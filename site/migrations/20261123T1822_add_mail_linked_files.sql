-- Adds big files sent from the inbox as expiring download links instead of attachments.
-- Explained in site/MAIL.md, "Big files as links".

-- One file sent as a link. It arrives in pieces (an R2 multipart upload),
-- is checked for viruses like any attachment, and is joined to a message
-- when that message is saved to send. Its link works until expires_at, and
-- the file is then deleted. Nothing records who opened the link.
CREATE TABLE mail_linked_files (
	identifier TEXT PRIMARY KEY,
	person_identifier TEXT REFERENCES people (identifier) ON DELETE SET NULL,
	-- Null until the file goes with a message, and again if that message is
	-- removed, after which the mail run deletes the file within a week.
	message_identifier TEXT REFERENCES mail_messages (identifier) ON DELETE SET NULL,
	filename TEXT NOT NULL CHECK (length(filename) BETWEEN 1 AND 200),
	media_type TEXT NOT NULL,
	size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
	bucket_key TEXT NOT NULL UNIQUE,
	multipart_identifier TEXT,
	status TEXT NOT NULL CHECK (status IN ('sending', 'ready')),
	created_at TEXT NOT NULL,
	-- Set when the file is joined to a message: 30 days after the message goes.
	expires_at TEXT
);

CREATE INDEX mail_linked_files_message ON mail_linked_files (message_identifier);
CREATE INDEX mail_linked_files_expiry ON mail_linked_files (expires_at);

-- The pieces that have arrived, so the upload can be joined and picked up again after a stop.
CREATE TABLE mail_linked_file_pieces (
	file_identifier TEXT NOT NULL REFERENCES mail_linked_files (identifier) ON DELETE CASCADE,
	number INTEGER NOT NULL CHECK (number >= 1),
	size_bytes INTEGER NOT NULL,
	entity_tag TEXT NOT NULL,
	PRIMARY KEY (file_identifier, number)
);
