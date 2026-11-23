-- The project inbox (docs/decisions/0040-project-inbox-on-cloudflare.md,
-- site/MAIL.md). Mail to the project's addresses arrives through Cloudflare
-- Email Routing; the raw message and its attachments are kept in the
-- private bucket under mail/, and these tables hold what the workspace
-- lists, searches and acts on. Outreach to nations is sent through a
-- separate mail service (an SMTP mailbox such as Zoho Mail), because
-- Cloudflare Email Service may not be used for unsolicited mail.
--
-- Numbered 0013 because open work holds 0008 to 0012 (0012 is the private
-- address book, whose contacts and contact_methods tables outreach reads).

-- Folders the lead author makes, such as "Nations / Navajo Nation". A
-- folder can sit inside another, at most three deep. Deleting a folder
-- moves its conversations back to the inbox (src/lib/server/mail/store.ts).
CREATE TABLE mail_folders (
	identifier TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	parent_identifier TEXT REFERENCES mail_folders (identifier) ON DELETE CASCADE,
	created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX mail_folders_by_name ON mail_folders (COALESCE(parent_identifier, ''), name);

-- One conversation. A thread lives in one place: one of the four built-in
-- folders, or ('folder') one the lead author made, named by
-- folder_identifier. "Assigned to me", "Reminders" and "Scheduled" are
-- views over these columns.
CREATE TABLE mail_threads (
	identifier TEXT PRIMARY KEY,
	subject TEXT NOT NULL,
	-- The subject without "Re:" and "Fwd:", lower case, for threading replies
	-- that lost their In-Reply-To header.
	normalized_subject TEXT NOT NULL,
	folder TEXT NOT NULL DEFAULT 'inbox' CHECK (folder IN ('inbox', 'archive', 'spam', 'trash', 'folder')),
	folder_identifier TEXT REFERENCES mail_folders (identifier) ON DELETE SET NULL,
	unread INTEGER NOT NULL DEFAULT 1 CHECK (unread IN (0, 1)),
	-- The project address the conversation is with, such as contact@example.org.
	project_address TEXT,
	-- The other side's address, for threading and the address-book panel.
	counterpart_address TEXT,
	counterpart_name TEXT,
	nation_identifier TEXT,
	assignee_identifier TEXT REFERENCES people (identifier) ON DELETE SET NULL,
	message_count INTEGER NOT NULL DEFAULT 0,
	last_message_at TEXT NOT NULL,
	last_inbound_at TEXT,
	last_outbound_at TEXT,
	-- "Remind me": the conversation stays out of the Inbox list until
	-- remind_at, then comes back to the inbox as unread. A reply that arrives
	-- after remind_set_at (other than an automatic reply) brings it back at
	-- once and ends the reminder.
	remind_at TEXT,
	remind_set_at TEXT,
	-- The sender asked not to be written to again; shown until confirmed.
	stop_requested INTEGER NOT NULL DEFAULT 0 CHECK (stop_requested IN (0, 1)),
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
CREATE INDEX mail_threads_by_folder ON mail_threads (folder, last_message_at);
CREATE INDEX mail_threads_by_own_folder ON mail_threads (folder_identifier, last_message_at);
CREATE INDEX mail_threads_by_subject ON mail_threads (normalized_subject, counterpart_address);
CREATE INDEX mail_threads_by_assignee ON mail_threads (assignee_identifier, last_message_at);
CREATE INDEX mail_threads_by_nation ON mail_threads (nation_identifier, last_message_at);
CREATE INDEX mail_threads_by_reminder ON mail_threads (remind_at) WHERE remind_at IS NOT NULL;

-- One message, received or sent. Sent messages also cover drafts and
-- scheduled sends, which wait in the same table until they go.
CREATE TABLE mail_messages (
	identifier TEXT PRIMARY KEY,
	thread_identifier TEXT NOT NULL REFERENCES mail_threads (identifier) ON DELETE CASCADE,
	direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
	status TEXT NOT NULL CHECK (
		status IN ('received', 'draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled')
	),
	-- The Message-ID header without angle brackets, and the id the sending
	-- service returned when it differs.
	message_id TEXT,
	provider_message_id TEXT,
	in_reply_to TEXT,
	-- Message-IDs of the conversation, space-separated, as in the References header.
	reference_ids TEXT,
	from_address TEXT NOT NULL,
	from_name TEXT,
	-- JSON arrays of { "email", "name" }.
	to_list TEXT NOT NULL DEFAULT '[]',
	cc_list TEXT NOT NULL DEFAULT '[]',
	bcc_list TEXT NOT NULL DEFAULT '[]',
	reply_to TEXT,
	subject TEXT NOT NULL,
	-- The plain text, for reading, search and the list's preview line.
	text_body TEXT NOT NULL DEFAULT '',
	snippet TEXT NOT NULL DEFAULT '',
	-- The HTML version, when there is one, is kept in the bucket at html_key.
	html_key TEXT,
	raw_key TEXT,
	size INTEGER NOT NULL DEFAULT 0,
	-- Why the message went to Spam, or null.
	spam_reason TEXT,
	-- An out-of-office or other automatic reply: shown, but it does not
	-- count as an answer for reminders.
	automatic INTEGER NOT NULL DEFAULT 0 CHECK (automatic IN (0, 1)),
	-- Which service sent it: 'cloudflare' or 'smtp' (src/lib/server/mail/carriers.ts).
	carrier TEXT,
	sent_by TEXT REFERENCES people (identifier) ON DELETE SET NULL,
	scheduled_for TEXT,
	sent_at TEXT,
	received_at TEXT,
	-- Delivery as the sending service reports it. "delivered" means the
	-- other side's mail server took the message, not that anyone read it.
	delivery_status TEXT CHECK (
		delivery_status IS NULL OR delivery_status IN
			('delivered', 'deferred', 'bounced', 'failed', 'rejected', 'complained')
	),
	delivery_detail TEXT,
	delivery_at TEXT,
	-- When the recipient chose to use the visible "let us know you got this" link.
	acknowledged_at TEXT,
	outreach_recipient_identifier TEXT,
	error TEXT,
	created_at TEXT NOT NULL
);
CREATE INDEX mail_messages_by_thread ON mail_messages (thread_identifier, created_at);
CREATE INDEX mail_messages_by_message_id ON mail_messages (message_id);
CREATE INDEX mail_messages_by_provider_id ON mail_messages (provider_message_id);
CREATE INDEX mail_messages_waiting ON mail_messages (status, scheduled_for);

CREATE TABLE mail_attachments (
	identifier TEXT PRIMARY KEY,
	message_identifier TEXT NOT NULL REFERENCES mail_messages (identifier) ON DELETE CASCADE,
	filename TEXT NOT NULL,
	media_type TEXT NOT NULL,
	size INTEGER NOT NULL,
	content_id TEXT,
	inline INTEGER NOT NULL DEFAULT 0 CHECK (inline IN (0, 1)),
	bucket_key TEXT NOT NULL
);
CREATE INDEX mail_attachments_by_message ON mail_attachments (message_identifier);

-- Tags: a conversation can have any number of them, whatever folder it is in.
CREATE TABLE mail_tags (
	identifier TEXT PRIMARY KEY,
	name TEXT NOT NULL UNIQUE,
	-- One of the site's tag colors (src/lib/mail.ts), never a raw color.
	color TEXT NOT NULL DEFAULT 'teal' CHECK (color IN ('teal', 'orange', 'gray', 'gold', 'green', 'purple')),
	created_at TEXT NOT NULL
);

CREATE TABLE mail_thread_tags (
	thread_identifier TEXT NOT NULL REFERENCES mail_threads (identifier) ON DELETE CASCADE,
	tag_identifier TEXT NOT NULL REFERENCES mail_tags (identifier) ON DELETE CASCADE,
	PRIMARY KEY (thread_identifier, tag_identifier)
);
CREATE INDEX mail_thread_tags_by_tag ON mail_thread_tags (tag_identifier);

-- Auto-sort rules, run in order on each message that arrives (not on Spam
-- or delivery reports). conditions is a JSON array of { "field",
-- "operator", "value" }; actions is a JSON array of { "action", "value" }
-- (src/lib/server/mail/rules.ts lists both).
CREATE TABLE mail_rules (
	identifier TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	position INTEGER NOT NULL,
	enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
	-- 1: every condition must hold; 0: any one is enough.
	match_all INTEGER NOT NULL DEFAULT 1 CHECK (match_all IN (0, 1)),
	conditions TEXT NOT NULL DEFAULT '[]',
	actions TEXT NOT NULL DEFAULT '[]',
	-- Later rules are not run on a message this rule matched.
	stop_after INTEGER NOT NULL DEFAULT 0 CHECK (stop_after IN (0, 1)),
	match_count INTEGER NOT NULL DEFAULT 0,
	last_matched_at TEXT,
	created_by TEXT REFERENCES people (identifier) ON DELETE SET NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
CREATE INDEX mail_rules_by_position ON mail_rules (position);

-- Notes on a conversation that only the project team sees.
CREATE TABLE mail_notes (
	identifier TEXT PRIMARY KEY,
	thread_identifier TEXT NOT NULL REFERENCES mail_threads (identifier) ON DELETE CASCADE,
	person_identifier TEXT REFERENCES people (identifier) ON DELETE SET NULL,
	body TEXT NOT NULL,
	created_at TEXT NOT NULL
);
CREATE INDEX mail_notes_by_thread ON mail_notes (thread_identifier, created_at);

-- Saved messages with fields such as {{nation.name}}. Every save keeps the
-- earlier version in mail_template_versions.
CREATE TABLE mail_templates (
	identifier TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	subject TEXT NOT NULL,
	body TEXT NOT NULL,
	version INTEGER NOT NULL DEFAULT 1,
	archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
	updated_at TEXT NOT NULL,
	updated_by TEXT REFERENCES people (identifier) ON DELETE SET NULL
);

CREATE TABLE mail_template_versions (
	template_identifier TEXT NOT NULL REFERENCES mail_templates (identifier) ON DELETE CASCADE,
	version INTEGER NOT NULL,
	name TEXT NOT NULL,
	subject TEXT NOT NULL,
	body TEXT NOT NULL,
	saved_at TEXT NOT NULL,
	saved_by TEXT REFERENCES people (identifier) ON DELETE SET NULL,
	PRIMARY KEY (template_identifier, version)
);

-- An outreach batch: one message per recipient, sent slowly through the
-- outreach mail service.
CREATE TABLE outreach_batches (
	identifier TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	template_identifier TEXT REFERENCES mail_templates (identifier) ON DELETE SET NULL,
	template_version INTEGER,
	subject TEXT NOT NULL,
	body TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'done', 'cancelled')),
	per_day INTEGER NOT NULL DEFAULT 40 CHECK (per_day BETWEEN 1 AND 200),
	-- Sending hours in each recipient's own time zone, 0 to 24.
	window_start_hour INTEGER NOT NULL DEFAULT 9 CHECK (window_start_hour BETWEEN 0 AND 23),
	window_end_hour INTEGER NOT NULL DEFAULT 15 CHECK (window_end_hour BETWEEN 1 AND 24),
	weekdays_only INTEGER NOT NULL DEFAULT 1 CHECK (weekdays_only IN (0, 1)),
	follow_up_days INTEGER CHECK (follow_up_days IS NULL OR follow_up_days BETWEEN 1 AND 90),
	ask_acknowledgment INTEGER NOT NULL DEFAULT 0 CHECK (ask_acknowledgment IN (0, 1)),
	created_by TEXT REFERENCES people (identifier) ON DELETE SET NULL,
	created_at TEXT NOT NULL,
	started_at TEXT,
	finished_at TEXT
);

CREATE TABLE outreach_recipients (
	identifier TEXT PRIMARY KEY,
	batch_identifier TEXT NOT NULL REFERENCES outreach_batches (identifier) ON DELETE CASCADE,
	-- The address-book contact, when the recipient came from it.
	contact_identifier TEXT,
	nation_identifier TEXT,
	email TEXT NOT NULL,
	name TEXT NOT NULL,
	-- The merge fields as they were when the recipient was added, as JSON.
	fields TEXT NOT NULL DEFAULT '{}',
	time_zone TEXT NOT NULL DEFAULT 'America/Denver',
	status TEXT NOT NULL DEFAULT 'queued' CHECK (
		status IN ('queued', 'sent', 'skipped', 'failed', 'replied', 'unsubscribed', 'bounced')
	),
	skip_reason TEXT,
	message_identifier TEXT REFERENCES mail_messages (identifier) ON DELETE SET NULL,
	thread_identifier TEXT REFERENCES mail_threads (identifier) ON DELETE SET NULL,
	sent_at TEXT,
	replied_at TEXT,
	UNIQUE (batch_identifier, email)
);
CREATE INDEX outreach_recipients_waiting ON outreach_recipients (batch_identifier, status);

-- Addresses that must not be sent outreach or other mail they did not
-- start. Kept by address, not by contact, and never lifted automatically.
CREATE TABLE mail_suppressions (
	email TEXT PRIMARY KEY,
	reason TEXT NOT NULL CHECK (reason IN ('unsubscribed', 'asked', 'complaint', 'hard-bounce', 'manual')),
	source TEXT,
	note TEXT,
	created_at TEXT NOT NULL
);

-- Delivery reports from the sending services, as they arrive.
CREATE TABLE mail_delivery_events (
	identifier TEXT PRIMARY KEY,
	message_identifier TEXT REFERENCES mail_messages (identifier) ON DELETE SET NULL,
	provider_message_id TEXT,
	recipient TEXT,
	event_type TEXT NOT NULL,
	detail TEXT,
	occurred_at TEXT NOT NULL,
	received_at TEXT NOT NULL
);
CREATE INDEX mail_delivery_events_by_message ON mail_delivery_events (message_identifier);

-- Who did what in the inbox (read, replied, assigned, tagged, filed, archived,
-- deleted, started a batch). Kept apart from the activity log's events
-- table so the inbox needs no rebuild of that table.
CREATE TABLE mail_actions (
	identifier TEXT PRIMARY KEY,
	person_identifier TEXT REFERENCES people (identifier) ON DELETE SET NULL,
	action TEXT NOT NULL,
	thread_identifier TEXT,
	batch_identifier TEXT,
	note TEXT,
	created_at TEXT NOT NULL
);
CREATE INDEX mail_actions_by_thread ON mail_actions (thread_identifier, created_at);

-- Small values the inbox keeps between runs, such as when the last
-- new-mail notice went out.
CREATE TABLE mail_state (
	key TEXT PRIMARY KEY,
	value TEXT NOT NULL
);

-- Full-text search over subject, sender and body (SQLite FTS5, which D1
-- supports). Rows are written with each message.
CREATE VIRTUAL TABLE mail_search USING fts5 (
	subject,
	sender,
	body,
	message_identifier UNINDEXED,
	thread_identifier UNINDEXED,
	tokenize = 'unicode61 remove_diacritics 2'
);

-- Tags most projects start with; the lead author can rename or remove them.
INSERT INTO mail_tags (identifier, name, color, created_at) VALUES
	('tag-correction', 'Correction or removal', 'orange', '2026-11-23T00:00:00Z'),
	('tag-outreach-reply', 'Outreach reply', 'teal', '2026-11-23T00:00:00Z'),
	('tag-advisors', 'Advisors', 'gray', '2026-11-23T00:00:00Z'),
	('tag-permissions', 'Permissions', 'gold', '2026-11-23T00:00:00Z');
