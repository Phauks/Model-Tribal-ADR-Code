-- Harder-to-guess passwords (site/COLLABORATION.md, "How sign-in works").
--
-- Wrong passwords are counted for each email address, whether or not an
-- account has that address, so a pause never shows who has an account. After
-- every 10 wrong passwords in a row, password sign-in for the address pauses,
-- for 15 minutes and then twice as long each time, up to a day. After 100 in a
-- row it stays off until the owner signs in another way (a code or a link)
-- and chooses a new password, as NIST SP 800-63B-4, section 3.2.2, asks. A
-- right password, or a new one, clears the count.
CREATE TABLE password_failures (
	email TEXT PRIMARY KEY COLLATE NOCASE,
	-- Wrong passwords in a row.
	consecutive INTEGER NOT NULL DEFAULT 0 CHECK (consecutive >= 0),
	-- When password sign-in may be tried again; empty when it is not paused.
	paused_until TEXT,
	last_failed_at TEXT NOT NULL
);

-- Whether the password's hash also went through the Worker's secret password
-- key (src/lib/server/sign-in-secrets.ts). Hashes made before the key was set
-- are 0, and are upgraded the next time their owner signs in.
ALTER TABLE accounts ADD COLUMN password_keyed INTEGER NOT NULL DEFAULT 0 CHECK (password_keyed IN (0, 1));
