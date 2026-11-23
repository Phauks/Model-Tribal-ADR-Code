-- Blocks senders in the project inbox and keeps each message's unsubscribe headers (site/MAIL.md, "Blocking, unsubscribing and exporting").

-- An address, such as someone@example.com, or a whole domain written with
-- an @ in front, such as @example.com. Mail from it goes straight to Spam.
CREATE TABLE mail_blocked_senders (
	pattern TEXT PRIMARY KEY CHECK (pattern = lower(pattern) AND pattern LIKE '%@_%'),
	note TEXT,
	blocked_by TEXT REFERENCES people (identifier) ON DELETE SET NULL,
	blocked_at TEXT NOT NULL
);

-- The List-Unsubscribe and List-Unsubscribe-Post headers of a received
-- message (RFC 2369, RFC 8058), so the inbox can unsubscribe in one click.
ALTER TABLE mail_messages ADD COLUMN list_unsubscribe TEXT;
ALTER TABLE mail_messages ADD COLUMN list_unsubscribe_post TEXT;
