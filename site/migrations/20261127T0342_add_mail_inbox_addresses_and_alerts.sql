-- Adds extra addresses to inboxes and lets each person choose their own new-mail alerts for each inbox.
-- Explained in site/MAIL.md, "Inboxes" and "New-mail alerts". It replaces the single MAIL_NOTICE_ADDRESS notice.

-- More addresses for an inbox, such as info@ and hello@ beside contact@.
-- Mail to one files into its inbox, and a reply goes from the address the
-- mail was sent to. An address belongs to at most one inbox: the code
-- refuses one that is another inbox's main address or extra address. The
-- inbox's main address stays in mail_inboxes.local_part.
CREATE TABLE mail_inbox_addresses (
	local_part TEXT PRIMARY KEY CHECK (
		local_part = lower(local_part) AND length(local_part) BETWEEN 1 AND 64 AND local_part NOT GLOB '*[^a-z0-9._-]*'
	),
	inbox_identifier TEXT NOT NULL REFERENCES mail_inboxes (identifier) ON DELETE CASCADE,
	added_at TEXT NOT NULL
);

CREATE INDEX mail_inbox_addresses_inbox ON mail_inbox_addresses (inbox_identifier);

-- How each person on an inbox hears about its new mail: 'now' (an alert as
-- mail arrives, at most one every 30 minutes), 'daily' (one summary a day)
-- or 'none'. Alerts go to the email the person signs in with and never
-- quote the mail.
ALTER TABLE mail_inbox_members ADD COLUMN alerts TEXT NOT NULL DEFAULT 'now' CHECK (alerts IN ('now', 'daily', 'none'));

-- When the person was last sent an at-once alert for this inbox.
ALTER TABLE mail_inbox_members ADD COLUMN alerted_at TEXT;

-- When the person's daily summary for this inbox last ran. The next one
-- counts the mail that arrived after it, about a day later.
ALTER TABLE mail_inbox_members ADD COLUMN summarized_at TEXT;
