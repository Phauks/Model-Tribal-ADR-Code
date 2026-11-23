-- Two-step sign-in with an authenticator app and backup codes, and "Keep me signed in" (site/COLLABORATION.md, "Two-step sign-in").
--
-- The app's shared secret is kept encrypted with a key derived from the
-- Worker's PASSWORD_KEY secret when that is set ("sealed:" prefix), or as it
-- is until then ("plain:" prefix). authenticator_new_secret holds a secret
-- while it is being set up, until a code from the app confirms it.
-- authenticator_last_step is the last 30-second step whose code was used, so
-- no code works twice.
ALTER TABLE accounts ADD COLUMN authenticator_secret TEXT;
ALTER TABLE accounts ADD COLUMN authenticator_new_secret TEXT;
ALTER TABLE accounts ADD COLUMN authenticator_added_at TEXT;
ALTER TABLE accounts ADD COLUMN authenticator_last_step INTEGER;

-- Backup codes, kept only as SHA-256 hashes. Each works once.
CREATE TABLE backup_codes (
	account_identifier TEXT NOT NULL REFERENCES accounts (identifier) ON DELETE CASCADE,
	code_hash TEXT NOT NULL,
	created_at TEXT NOT NULL,
	used_at TEXT,
	PRIMARY KEY (account_identifier, code_hash)
);

-- Whether a session still waits for the second step: 'none' when the account
-- has no authenticator app, 'waiting' after the first step, 'done' after the
-- second. A waiting session reaches nothing but the second-step page.
ALTER TABLE sessions ADD COLUMN second_step TEXT NOT NULL DEFAULT 'none' CHECK (second_step IN ('none', 'waiting', 'done'));
-- Wrong codes typed at the second step; at 5 the session is ended.
ALTER TABLE sessions ADD COLUMN wrong_second_steps INTEGER NOT NULL DEFAULT 0 CHECK (wrong_second_steps >= 0);
-- 1 for a "Keep me signed in" session: 30 days, for accounts without
-- workspace access. Workspace sessions stay at 12 hours.
ALTER TABLE sessions ADD COLUMN lasting INTEGER NOT NULL DEFAULT 0 CHECK (lasting IN (0, 1));
