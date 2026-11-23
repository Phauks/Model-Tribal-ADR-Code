-- Writing mail in the project inbox (site/MAIL.md, "Writing"): signatures,
-- saved replies, drafts that save themselves, the pause before a message
-- goes (undo send), and the away message.

-- One signature for each of the inbox's own addresses, added below a new
-- message or reply sent from that address.
CREATE TABLE mail_signatures (
	address TEXT PRIMARY KEY,
	body TEXT NOT NULL,
	updated_by TEXT REFERENCES people (identifier) ON DELETE SET NULL,
	updated_at TEXT NOT NULL
);

-- Answers given often, put into a message with one click. The body may use
-- the merge fields outreach uses, such as {{ contact.name }}.
CREATE TABLE mail_saved_replies (
	identifier TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	body TEXT NOT NULL,
	created_by TEXT REFERENCES people (identifier) ON DELETE SET NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX mail_saved_replies_by_name ON mail_saved_replies (name COLLATE NOCASE);

-- A message being written, saved as the person types. A reply's draft
-- belongs to its conversation (one for each person); a new message's draft
-- has no conversation. Attachments are not kept in drafts.
CREATE TABLE mail_drafts (
	identifier TEXT PRIMARY KEY,
	person_identifier TEXT NOT NULL REFERENCES people (identifier) ON DELETE CASCADE,
	thread_identifier TEXT REFERENCES mail_threads (identifier) ON DELETE CASCADE,
	-- JSON: from, to, cc, bcc, subject, text, and for a reply the mode and the message it answers.
	fields TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX mail_drafts_one_per_reply ON mail_drafts (person_identifier, thread_identifier) WHERE thread_identifier IS NOT NULL;
CREATE INDEX mail_drafts_by_person ON mail_drafts (person_identifier, updated_at);

-- Settings for the whole inbox, one row each: 'undo-seconds' (how long a
-- message waits before it goes, so it can be pulled back) and 'away' (the
-- away message, as JSON).
CREATE TABLE mail_preferences (
	key TEXT PRIMARY KEY,
	value TEXT NOT NULL,
	updated_by TEXT REFERENCES people (identifier) ON DELETE SET NULL,
	updated_at TEXT NOT NULL
);

-- Who has had the away message, so each sender gets it once while it is on.
CREATE TABLE mail_away_replies (
	address TEXT PRIMARY KEY,
	sent_at TEXT NOT NULL
);

-- A sent message waits in mail_messages as 'scheduled' during the pause
-- before it goes; held_for_undo marks that wait, so the conversation page
-- can offer Undo. claimed_at is when a run started sending a message, so a
-- second run (the pause ending, Send now, and the five-minute tick can all
-- try) leaves it alone unless the first one stopped partway.
ALTER TABLE mail_messages ADD COLUMN held_for_undo INTEGER NOT NULL DEFAULT 0 CHECK (held_for_undo IN (0, 1));
ALTER TABLE mail_messages ADD COLUMN claimed_at TEXT;
