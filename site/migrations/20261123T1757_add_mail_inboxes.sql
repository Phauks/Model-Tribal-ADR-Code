-- Splits the project inbox into inboxes, shared or personal, each with the people who may read it.
-- Explained in site/MAIL.md, "Inboxes".

-- One inbox for each project address. A shared inbox (such as contact@) is
-- read by everyone on its list; a personal one (such as trevor@) only by its
-- owner. Mail to an address no inbox has goes to the one catch-all inbox.
CREATE TABLE mail_inboxes (
	identifier TEXT PRIMARY KEY,
	-- The part before the @, such as "contact". The domain is MAIL_DOMAIN.
	local_part TEXT NOT NULL UNIQUE CHECK (
		local_part = lower(local_part) AND length(local_part) BETWEEN 1 AND 64 AND local_part NOT GLOB '*[^a-z0-9._-]*'
	),
	name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
	kind TEXT NOT NULL CHECK (kind IN ('shared', 'personal')),
	-- The one person a personal inbox belongs to. Deleting their account
	-- deletes the inbox; its conversations are then removed by the daily
	-- clean-up, unseen by anyone else.
	owner_identifier TEXT REFERENCES people (identifier) ON DELETE CASCADE,
	catch_all INTEGER NOT NULL DEFAULT 0 CHECK (catch_all IN (0, 1)),
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	CHECK ((kind = 'personal') = (owner_identifier IS NOT NULL)),
	CHECK (catch_all = 0 OR kind = 'shared')
);

CREATE UNIQUE INDEX mail_inboxes_one_catch_all ON mail_inboxes (catch_all) WHERE catch_all = 1;

-- Who may read and answer each inbox. A personal inbox has only its owner.
CREATE TABLE mail_inbox_members (
	inbox_identifier TEXT NOT NULL REFERENCES mail_inboxes (identifier) ON DELETE CASCADE,
	person_identifier TEXT NOT NULL REFERENCES people (identifier) ON DELETE CASCADE,
	added_at TEXT NOT NULL,
	PRIMARY KEY (inbox_identifier, person_identifier)
);

CREATE INDEX mail_inbox_members_person ON mail_inbox_members (person_identifier);

-- Which inbox each conversation is in. Null only when its inbox was deleted
-- with its owner's account; nobody sees such a conversation.
ALTER TABLE mail_threads ADD COLUMN inbox_identifier TEXT REFERENCES mail_inboxes (identifier) ON DELETE SET NULL;

CREATE INDEX mail_threads_inbox ON mail_threads (inbox_identifier, folder, last_message_at);

-- The inbox the site had until now: contact@, shared, catching everything
-- else, read by the lead author.
INSERT INTO mail_inboxes (identifier, local_part, name, kind, owner_identifier, catch_all, created_at, updated_at)
VALUES ('contact', 'contact', 'Contact', 'shared', NULL, 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

INSERT INTO mail_inbox_members (inbox_identifier, person_identifier, added_at)
SELECT 'contact', identifier, strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM people WHERE role = 'lead-author' AND status = 'active';

UPDATE mail_threads SET inbox_identifier = 'contact';
