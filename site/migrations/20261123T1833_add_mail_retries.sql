-- Adds retries so mail coming in or going out is not lost when a step fails for a while.
-- Explained in site/MAIL.md, "When something fails".

-- How many times a reply has been tried. A send that fails for a reason that
-- may pass (the mail service busy or briefly down) is tried again later, up
-- to five times over about two hours, before the message is marked failed.
ALTER TABLE mail_messages ADD COLUMN send_attempts INTEGER NOT NULL DEFAULT 0 CHECK (send_attempts >= 0);

-- Arriving mail is kept whole in the mail bucket under mail/incoming/ before
-- it is filed. If filing fails, the copy stays there and the mail run tries
-- again; this table counts the tries. After the last try the message is
-- listed in the inbox for a person to try again. A row goes when its message
-- is filed.
CREATE TABLE mail_arrival_problems (
	object_key TEXT PRIMARY KEY,
	attempts INTEGER NOT NULL CHECK (attempts >= 1),
	last_error TEXT NOT NULL,
	first_failed_at TEXT NOT NULL,
	next_try_at TEXT,
	gave_up_at TEXT
);
